"""Команда импорта: аргументы, отчёт, ошибки и транзакция на PostgreSQL."""

import os
import subprocess
import sys
from collections import Counter
from copy import deepcopy
from pathlib import Path

import app.db
import pytest
from app.db import Base
from app.models import Penalty, Race, StageResult
from app.services.protocol_import import ProtocolImportResult
from asyncpg import PostgresError
from pydantic import BaseModel, ValidationError
from scripts import import_protocol as cli
from scripts.parse_protocol import parse_protocol
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import async_sessionmaker

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = PROJECT_ROOT / "backend" / "scripts" / "import_protocol.py"


@pytest.fixture
def json_path(tmp_path):
    path = tmp_path / "протокол гонки.json"
    path.write_text('{"source_filename": "Avacha-2026.pdf"}', encoding="utf-8")
    return path


@pytest.fixture(scope="module")
def archive_document():
    return parse_protocol(PROJECT_ROOT / "docs" / "Total_result_Avacha-2026.pdf")


@pytest.fixture
def document(archive_document):
    return deepcopy(archive_document)


@pytest.fixture
def cli_database(engine, monkeypatch):
    monkeypatch.setattr(app.db, "engine", engine)
    monkeypatch.setattr(
        app.db, "SessionLocal", async_sessionmaker(engine, expire_on_commit=False)
    )


@pytest.mark.parametrize("repeat", [False, True])
def test_command_reports_success_and_warnings(json_path, monkeypatch, capsys, repeat):
    created = Counter(
        races=1,
        stages=6,
        disciplines=3,
        participants=21,
        race_participants=21,
        protocols=18,
        stage_results=118,
        penalties=3,
    )
    if repeat:
        created.clear()

    async def run_import(document):
        assert document == {"source_filename": "Avacha-2026.pdf"}
        return ProtocolImportResult(
            race_id=42,
            created=created,
            skipped_stage_results=8,
            warnings=["В протоколе не найдено поле: Погодные условия"],
        )

    monkeypatch.setattr(cli, "run_import", run_import)
    assert cli.main(["--json", str(json_path)]) == 0
    output = capsys.readouterr()
    assert "Импорт завершён. ID гонки: 42" in output.out
    for label, expected in [
        ("Гонки", 1),
        ("Этапы", 6),
        ("Дисциплины", 3),
        ("Спортсмены", 21),
        ("Участия в гонке", 21),
        ("Протоколы", 18),
        ("Результаты этапов", 118),
        ("Штрафы", 3),
    ]:
        assert f"  {label}: {0 if repeat else expected}\n" in output.out
    assert "Пропущено пустых результатов после DNF/DNS: 8" in output.out
    assert ("Все записи уже существуют" in output.out) is repeat
    assert output.err == (
        "Предупреждение: В протоколе не найдено поле: Погодные условия\n"
    )


@pytest.mark.parametrize(
    "invalid", ["missing", "directory", "syntax", "encoding", "list", "null"]
)
def test_invalid_file_does_not_start_import(tmp_path, monkeypatch, capsys, invalid):
    path = tmp_path / "protocol.json"
    if invalid == "directory":
        path.mkdir()
    elif invalid == "encoding":
        path.write_bytes(b"\xff")
    elif invalid != "missing":
        path.write_text(
            {"syntax": "{", "list": "[]", "null": "null"}[invalid], encoding="utf-8"
        )

    async def unexpected_import(document):
        pytest.fail("Импорт не должен начинаться при ошибке чтения JSON")

    monkeypatch.setattr(cli, "run_import", unexpected_import)
    assert cli.main(["--json", str(path)]) == 1
    output = capsys.readouterr()
    assert output.out == ""
    assert "Ошибка чтения JSON:" in output.err
    assert "Traceback" not in output.err


def test_json_with_utf8_bom_is_accepted(tmp_path, monkeypatch):
    path = tmp_path / "protocol.json"
    path.write_text('{"race": {"year": 2026}}', encoding="utf-8-sig")

    async def run_import(document):
        assert document == {"race": {"year": 2026}}
        return ProtocolImportResult(1, Counter(), 8, [])

    monkeypatch.setattr(cli, "run_import", run_import)
    assert cli.main(["--json", str(path)]) == 0


@pytest.mark.parametrize(
    ("failure", "message"),
    [
        ("conflict", "Ошибка импорта: Участник №12: штрафы в БД не совпадают"),
        ("validation", "postgres_port:"),
        ("database", "Ошибка БД:"),
        ("postgres", "Ошибка БД:"),
        ("connection", "Ошибка БД:"),
    ],
)
def test_import_errors_return_failure_without_success_report(
    json_path, monkeypatch, capsys, failure, message
):
    secret = "do-not-print-this-password"

    async def run_import(document):
        if failure == "conflict":
            raise ValueError("Участник №12: штрафы в БД не совпадают с JSON")
        if failure == "validation":

            class InvalidSettings(BaseModel):
                postgres_port: int

            InvalidSettings.model_validate({"postgres_port": secret})
        error_class = {
            "database": SQLAlchemyError,
            "postgres": PostgresError,
            "connection": OSError,
        }[failure]
        raise error_class(secret)

    monkeypatch.setattr(cli, "run_import", run_import)
    assert cli.main(["--json", str(json_path)]) == 1
    output = capsys.readouterr()
    assert output.out == ""
    assert message in output.err
    assert secret not in output.err
    assert "Traceback" not in output.err


@pytest.mark.parametrize(
    ("mode", "expected_code", "message"),
    [
        ("help", 0, "--json"),
        ("no_arguments", 2, "--json"),
        ("invalid_file", 1, "Ошибка чтения JSON:"),
        ("invalid_settings", 1, "postgres_port:"),
    ],
)
def test_script_runs_from_outside_repository(tmp_path, mode, expected_code, message):
    path = tmp_path / "протокол гонки.json"
    path.write_text("{" if mode == "invalid_file" else "{}", encoding="utf-8")
    arguments = []
    if mode == "help":
        arguments = ["--help"]
    elif mode != "no_arguments":
        arguments = ["--json", str(path)]
    env = os.environ.copy()
    env.pop("PYTHONPATH", None)
    env["POSTGRES_PORT"] = "not-a-port"
    env["POSTGRES_PASSWORD"] = "do-not-print-this-password"

    result = subprocess.run(
        [sys.executable, str(SCRIPT), *arguments],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        timeout=20,
    )
    assert result.returncode == expected_code
    output = result.stdout + result.stderr
    assert message in output
    assert "Traceback" not in output
    assert "do-not-print-this-password" not in output
    if mode != "help":
        assert result.stdout == ""


async def test_command_commits_import_and_reuses_it_on_repeat(
    cli_database, session, document
):
    first = await cli.run_import(document)
    async with session.begin():
        assert await session.scalar(select(func.count()).select_from(Race)) == 1
        assert (
            await session.scalar(select(func.count()).select_from(StageResult)) == 118
        )
        assert await session.scalar(select(func.count()).select_from(Penalty)) == 3
    second = await cli.run_import(document)

    assert first.created["stage_results"] == 118
    assert first.created["penalties"] == 3
    assert second.race_id == first.race_id
    assert second.created == {}
    assert second.skipped_stage_results == 8


@pytest.mark.parametrize("failure", ["validation", "flush", "commit"])
async def test_command_rolls_back_failed_import(
    cli_database, session, document, failure
):
    expected_error = IntegrityError
    if failure == "validation":
        document["participants"][0]["stage_results"][0]["final_time_seconds"] = 1
        expected_error = ValidationError
    else:
        async with session.begin():
            if failure == "flush":
                constraint = "CHECK (seconds <> 3)"
            else:
                constraint = "UNIQUE (seconds) DEFERRABLE INITIALLY DEFERRED"
                participant = next(
                    p for p in document["participants"] if p["start_number"] == 18
                )
                participant["penalties"].append(deepcopy(participant["penalties"][0]))
                participant["summary"]["total_penalty_seconds"] = 240
            # Только временная тестовая схема; дефект commit проверяется в PostgreSQL.
            await session.execute(
                text(
                    "ALTER TABLE penalties ADD CONSTRAINT "
                    f"test_reject_penalty {constraint}"
                )
            )

    with pytest.raises(expected_error):
        await cli.run_import(document)
    for table in Base.metadata.sorted_tables:
        assert await session.scalar(select(func.count()).select_from(table)) == 0
