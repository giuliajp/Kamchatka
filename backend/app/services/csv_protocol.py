"""
Загрузка протокола из CSV (задача 3.4) — во время гонки, после каждого этапа.

Судьи ведут протокол в Excel. Организатор сохраняет лист как CSV («Файл → Сохранить как →
CSV (разделители — точки с запятой)») и загружает в админке. Руками ничего не вводится.

Понимаем два вида таблицы:
1. Как лист судей 2026 года: строки «Дисциплина … Нарта-длинная дистанция 8 собак»,
   под ними шапка «Стартовый номер; ФИО; Год рождения; Субъект РФ; Этап 1 длина 33,7 км; …»
   и строки участников. Лишние колонки (скорость, средняя скорость, общий результат) пропускаем.
2. Одна шапка на весь файл с колонкой «Дисциплина» в каждой строке.

Колонки ищем по названию, порядок любой:
- «Стартовый номер», «ФИО», «Год рождения», «Субъект РФ» или «Регион», «Дисциплина»;
- «Этап N …» — результат этапа: ЧЧ:ММ:СС, DNF, DNS, DSQ или пусто (этап ещё не прошёл);
- «Собак на старте N», «Собак на финише N» — необязательно;
- «Место» — место в дисциплине после последнего пройденного этапа (судейское);
- «Примечания» — штрафы вида «штр.вр. 2 мин. п.П.14.11.14»; либо колонки «Штраф» и «Пункт».

Правила:
- Пустая ячейка ничего не меняет и ничего не удаляет.
- Изменения уже существующих строк пишутся в журнал правок с основанием «Импорт <файл>».
- Утверждённый (окончательный) протокол файлом не меняется — только особой процедурой.
- Есть хоть одна ошибка — не сохраняется ничего, в ответе список ошибок с номерами строк.
"""

from __future__ import annotations

import csv
import io
import re
from collections import Counter
from dataclasses import dataclass, field

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    ChangeAction, Discipline, Participant, Penalty, Protocol, Race, RaceParticipant,
    ResultChangeLog, Stage, StageResult,
)
from app.services.results import (
    ResultError, apply_result_change, check_result_fields, get_or_create_protocol,
    log_created_result, parse_duration, parse_result_cell, refresh_entry_status,
)

MAX_FILE_BYTES = 2 * 1024 * 1024
_PENALTY_NOTE = re.compile(
    r"штр\.?\s*вр\.?\s*(?P<amount>\d+)\s*(?P<unit>мин|сек)\.?\s*п[.,]?\s*П\.?\s*(?P<rule>\d+(?:\.\d+)+)",
    re.IGNORECASE,
)
_PENALTY_AMOUNT = re.compile(r"^(?P<amount>\d+)\s*(?P<unit>мин|сек)\.?$", re.IGNORECASE)


class CsvImportError(ValueError):
    def __init__(self, errors: list[str]):
        super().__init__("; ".join(errors[:3]))
        self.errors = errors


@dataclass
class ImportReport:
    rows: int = 0
    counts: Counter = field(default_factory=Counter)
    warnings: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        keys = ("participants_created", "results_created", "results_updated", "results_unchanged",
                "penalties_changed", "protocols_created")
        return {"rows": self.rows, **{k: self.counts.get(k, 0) for k in keys},
                "warnings": self.warnings}


# ── Чтение файла ───────────────────────────────────────────────────────

def decode(content: bytes) -> str:
    for encoding in ("utf-8-sig", "cp1251"):     # русский Excel часто сохраняет в cp1251
        try:
            return content.decode(encoding)
        except UnicodeDecodeError:
            continue
    raise CsvImportError(["Не удалось прочитать файл: сохраните его как CSV в UTF-8 или Windows-1251"])


def read_rows(content: bytes) -> list[list[str]]:
    if len(content) > MAX_FILE_BYTES:
        raise CsvImportError(["Файл больше 2 МБ — это не протокол"])
    text = decode(content)
    sample = "\n".join(text.splitlines()[:20])
    delimiter = max((";", ",", "\t"), key=sample.count)
    return [[cell.strip() for cell in row] for row in csv.reader(io.StringIO(text), delimiter=delimiter)]


def normalize(text: str) -> str:
    return re.sub(r"[^0-9a-zа-я]", "", text.lower().replace("ё", "е"))


@dataclass
class Header:
    number: int
    name: int | None = None
    birth: int | None = None
    region: int | None = None
    discipline: int | None = None
    place: int | None = None
    note: int | None = None
    penalty: int | None = None
    rule: int | None = None
    stages: dict[int, int] = field(default_factory=dict)          # номер этапа → колонка
    dogs_start: dict[int, int] = field(default_factory=dict)
    dogs_finish: dict[int, int] = field(default_factory=dict)


def parse_header(row: list[str]) -> Header | None:
    lowered = [cell.lower().replace("ё", "е") for cell in row]
    number = next((i for i, c in enumerate(lowered) if "стартов" in c), None)
    if number is None or not any(c == "фио" or c.startswith("фио") for c in lowered):
        return None
    header = Header(number=number)
    for i, cell in enumerate(lowered):
        if cell.startswith("фио"):
            header.name = i
        elif "год рожд" in cell:
            header.birth = i
        elif "субъект" in cell or cell.startswith("регион"):
            header.region = i
        elif cell.startswith("дисциплина"):
            header.discipline = i
        elif cell == "место":
            header.place = i
        elif cell.startswith("примечан"):
            header.note = i
        elif cell.startswith("штраф"):
            header.penalty = i
        elif cell.startswith("пункт"):
            header.rule = i
        elif match := re.match(r"^собак\D*старт\D*(\d+)", cell):
            header.dogs_start[int(match.group(1))] = i
        elif match := re.match(r"^собак\D*финиш\D*(\d+)", cell):
            header.dogs_finish[int(match.group(1))] = i
        elif match := re.match(r"^этап\s*(\d+)", cell):
            header.stages.setdefault(int(match.group(1)), i)
    return header


def cell(row: list[str], index: int | None) -> str:
    return row[index].strip() if index is not None and index < len(row) else ""


def parse_int(text: str, what: str) -> int | None:
    if not text:
        return None
    try:
        return int(float(text.replace(",", ".")))
    except ValueError:
        raise ResultError(f"{what}: «{text}» — ожидается число") from None


def parse_penalties(row: list[str], header: Header) -> list[tuple[int, str | None, str]] | None:
    """[(секунды, пункт правил, текст)] или None — в файле нет колонок со штрафами."""
    if header.penalty is not None:
        amount = cell(row, header.penalty)
        if not amount or amount in ("0", "00:00:00"):
            return []
        match = _PENALTY_AMOUNT.match(amount)
        seconds = (int(match["amount"]) * (60 if match["unit"].lower() == "мин" else 1)
                   if match else parse_duration(amount))
        rule = cell(row, header.rule) or None
        return [(seconds, rule, amount)]
    if header.note is not None:
        note = cell(row, header.note)
        found = [(int(m["amount"]) * (60 if m["unit"].lower() == "мин" else 1), f"П.{m['rule']}", note)
                 for m in _PENALTY_NOTE.finditer(note)]
        if not found and "штр" in note.lower():
            raise ResultError(f"Не удалось распознать штраф: «{note}»")
        return found
    return None


# ── Перенос в базу ─────────────────────────────────────────────────────

async def import_csv(session: AsyncSession, race: Race, content: bytes, *, filename: str,
                     changed_by: str) -> ImportReport:
    """Перенести CSV в базу. При ошибках — CsvImportError; коммит/откат — на вызывающем коде."""
    rows = read_rows(content)
    reason = f"Импорт {filename}"
    report = ImportReport()
    errors: list[str] = []

    stages = {s.number: s for s in await session.scalars(select(Stage).where(Stage.race_id == race.id))}
    disciplines = list(await session.scalars(select(Discipline)))
    by_name = {normalize(d.name): d for d in disciplines} | {normalize(d.code): d for d in disciplines}
    entries = {e.start_number: e for e in await session.scalars(
        select(RaceParticipant).where(RaceParticipant.race_id == race.id))}
    people = {p.id: p for p in await session.scalars(
        select(Participant).where(Participant.id.in_([e.participant_id for e in entries.values()] or [0])))}
    protocols: dict[tuple[int, int], Protocol] = {}
    touched: dict[int, RaceParticipant] = {}
    seen_numbers: set[int] = set()

    def find_discipline(text: str) -> Discipline | None:
        key = normalize(text)
        if key in by_name:
            return by_name[key]
        if "лыж" in key:
            return next((d for d in disciplines if d.equipment.value == "ski"), None)
        if "более8" in key or "8+" in text:
            return next((d for d in disciplines if d.dogs_min > 8), None)
        if "8" in key:
            return next((d for d in disciplines if d.equipment.value == "sled" and d.dogs_max == 8), None)
        return None

    header: Header | None = None
    block_discipline: Discipline | None = None
    for line_no, row in enumerate(rows, start=1):
        if not any(row):
            continue
        new_header = parse_header(row)
        if new_header is not None:
            header = new_header
            continue
        first = next((c for c in row if c), "")
        if first.lower().startswith("дисциплина") and (header is None or not cell(row, header.number).isdigit()):
            name = next((c for c in row[row.index(first) + 1:] if c), "")
            block_discipline = find_discipline(name)
            if block_discipline is None:
                errors.append(f"Строка {line_no}: неизвестная дисциплина «{name}»")
            continue
        if header is None or not cell(row, header.number).isdigit():
            continue                                  # вторая строка шапки, подписи, итоги

        number = int(cell(row, header.number))
        context = f"Строка {line_no}, №{number}"
        report.rows += 1
        try:
            if number in seen_numbers:
                raise ResultError("номер повторяется в файле")
            seen_numbers.add(number)
            discipline = (find_discipline(cell(row, header.discipline))
                          if header.discipline is not None else block_discipline)
            if discipline is None:
                raise ResultError("не указана или не распознана дисциплина")
            entry = entries.get(number)
            full_name = " ".join(cell(row, header.name).split())
            if entry is None:
                parts = full_name.split()
                if len(parts) not in (2, 3):
                    raise ResultError("нового участника нужно указать как «Фамилия Имя [Отчество]»")
                birth = parse_int(cell(row, header.birth), "Год рождения")
                person = await session.scalar(select(Participant).where(
                    func.lower(Participant.last_name) == parts[0].lower(),
                    func.lower(Participant.first_name) == parts[1].lower(),
                    Participant.birth_year == birth).limit(1)) if birth else None
                if person is None:
                    person = Participant(last_name=parts[0], first_name=parts[1],
                                         middle_name=parts[2] if len(parts) == 3 else None, birth_year=birth)
                    session.add(person)
                    await session.flush()
                entry = RaceParticipant(race_id=race.id, participant_id=person.id, start_number=number,
                                        discipline_id=discipline.id, region=cell(row, header.region) or None)
                session.add(entry)
                await session.flush()
                entries[number], people[person.id] = entry, person
                report.counts["participants_created"] += 1
            else:
                person = people[entry.participant_id]
                if full_name and normalize(" ".join(full_name.split()[:2])) != \
                        normalize(f"{person.last_name} {person.first_name}"):
                    raise ResultError(f"в базе под этим номером {person.full_name}, в файле — {full_name}")
                if entry.discipline_id != discipline.id:
                    raise ResultError("дисциплина в файле не совпадает с заявкой участника")
                region = cell(row, header.region)
                if region and region != entry.region:
                    entry.region = region

            latest: StageResult | None = None
            for stage_number in sorted(header.stages):
                parsed = parse_result_cell(cell(row, header.stages[stage_number]))
                if parsed is None:
                    continue
                stage = stages.get(stage_number)
                if stage is None:
                    raise ResultError(f"этап {stage_number} не создан — добавьте его в разделе «Этапы»")
                status, seconds = parsed
                fields = {"status": status, "final_time_seconds": seconds}
                for key, columns in (("dogs_at_start", header.dogs_start), ("dogs_at_finish", header.dogs_finish)):
                    value = parse_int(cell(row, columns.get(stage_number)), "Число собак")
                    if value is not None:
                        fields[key] = value
                key = (stage.id, discipline.id)
                if key not in protocols:
                    protocols[key], created = await get_or_create_protocol(session, stage, discipline.id)
                    report.counts["protocols_created"] += created
                protocol = protocols[key]
                latest = await upsert_result(session, protocol, entry, fields, report,
                                             changed_by=changed_by, reason=reason, stage_number=stage_number)

            if latest is not None:
                extra = {}
                place = parse_int(cell(row, header.place), "Место")
                if place is not None:
                    extra["place"] = place
                note = cell(row, header.note)
                if header.note is not None and note and note != "0":
                    extra["note"] = note
                if extra:
                    protocol = await session.get(Protocol, latest.protocol_id)
                    await upsert_result(session, protocol, entry, extra, report, changed_by=changed_by,
                                        reason=reason, stage_number=None, existing=latest)

            penalties = parse_penalties(row, header)
            if penalties is not None:
                await sync_penalties(session, entry, penalties, report, changed_by=changed_by, reason=reason)
            touched[entry.id] = entry
        except ResultError as error:
            errors.append(f"{context}: {error}")

    if report.rows == 0 and not errors:
        errors.append("В файле не найдено ни одного участника: нужна шапка с колонками "
                      "«Стартовый номер» и «ФИО»")
    if errors:
        raise CsvImportError(errors)
    await session.flush()
    for entry in touched.values():
        await refresh_entry_status(session, entry)
    await session.flush()
    report.warnings = list(dict.fromkeys(report.warnings))
    return report


def warn_published(report: ImportReport, protocol: Protocol) -> None:
    if protocol.published_at is not None:
        report.warnings.append(f"Протокол {protocol.id} уже опубликован — изменения в нём сразу видны "
                               "в приложении и записаны в журнал правок")


async def upsert_result(session: AsyncSession, protocol: Protocol, entry: RaceParticipant, fields: dict,
                        report: ImportReport, *, changed_by: str, reason: str, stage_number: int | None,
                        existing: StageResult | None = None) -> StageResult:
    result = existing or await session.scalar(select(StageResult).where(
        StageResult.protocol_id == protocol.id, StageResult.race_participant_id == entry.id))
    if result is None:
        check_result_fields(fields)
        if protocol.is_final:
            raise ResultError(f"протокол этапа {stage_number} утверждён — используйте исправление в админке")
        result = StageResult(protocol_id=protocol.id, race_participant_id=entry.id,
                             net_time_seconds=fields.get("final_time_seconds"), **fields)
        session.add(result)
        await session.flush()
        if protocol.published_at is not None:
            log_created_result(session, result, changed_by=changed_by, reason=reason)
        warn_published(report, protocol)
        report.counts["results_created"] += 1
        return result
    differs = any(getattr(result, k) != v for k, v in fields.items())
    if not differs:
        if stage_number is not None:
            report.counts["results_unchanged"] += 1
        return result
    if protocol.is_final:
        raise ResultError("протокол утверждён — файл его не меняет, используйте исправление в админке")
    apply_result_change(session, result, fields, changed_by=changed_by, reason=reason)
    warn_published(report, protocol)
    if stage_number is not None:
        report.counts["results_updated"] += 1
    return result


async def sync_penalties(session: AsyncSession, entry: RaceParticipant,
                         wanted: list[tuple[int, str | None, str]], report: ImportReport, *,
                         changed_by: str, reason: str) -> None:
    current = list(await session.scalars(select(Penalty).where(Penalty.race_participant_id == entry.id)))
    if Counter((p.seconds, p.rule_reference) for p in current) == Counter((s, r) for s, r, _ in wanted):
        return
    for penalty in current:
        session.add(ResultChangeLog(
            protocol_id=None, entity="penalty", entity_id=penalty.id, race_participant_id=entry.id,
            action=ChangeAction.DELETE, old_value=f"{penalty.seconds} c {penalty.rule_reference or ''}".strip(),
            changed_by=changed_by, reason=reason))
        await session.delete(penalty)
    for seconds, rule, text in wanted:
        penalty = Penalty(race_participant_id=entry.id, seconds=seconds, rule_reference=rule, reason=text)
        session.add(penalty)
        await session.flush()
        session.add(ResultChangeLog(
            protocol_id=None, entity="penalty", entity_id=penalty.id, race_participant_id=entry.id,
            action=ChangeAction.CREATE, new_value=f"{seconds} c {rule or ''}".strip(),
            changed_by=changed_by, reason=reason))
    report.counts["penalties_changed"] += 1
