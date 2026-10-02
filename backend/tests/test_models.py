"""
Проверка моделей базы данных.

Запуск из папки backend:
    pytest -v

Тесты создают временную базу в памяти — ваши данные не трогают.
Заготовка app берётся из conftest.py.
"""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import (
    Checkpoint, CheckpointMark, CheckpointType, Discipline, Entry, Participant,
    Penalty, Season, SeasonStatus, Stage, Tracker, TrackerAlert,
    TrackerAssignment, TrackerPosition,
)


@pytest.fixture
def race(app):
    """Мини-гонка: сезон, этап с двумя КП, один участник."""
    season = Season(year=2027, title="Авача-2027", is_current=True)
    stage = Stage(season=season, number=1, name="Этап 1", distance_km=60)
    start = Checkpoint(stage=stage, order_index=0, code="СТАРТ", name="Старт",
                       type=CheckpointType.START, latitude=53.05, longitude=158.65)
    cp1 = Checkpoint(stage=stage, order_index=1, code="КП-1", name="Налычево",
                     latitude=53.20, longitude=158.80, required_rest_minutes=120)
    discipline = Discipline(code="12dogs", name="Упряжка 12 собак")
    person = Participant(first_name="Иван", last_name="Петров", region="Камчатский край")
    entry = Entry(season=season, participant=person, discipline=discipline,
                  bib_number=14, dogs_count=12)
    db.session.add_all([season, stage, start, cp1, discipline, person, entry])
    db.session.commit()
    return {"season": season, "stage": stage, "start": start, "cp1": cp1, "entry": entry}


def test_race_created(race):
    season = race["season"]
    assert season.status == SeasonStatus.UPCOMING
    assert [cp.code for cp in season.stages[0].checkpoints] == ["СТАРТ", "КП-1"]
    assert race["entry"].participant.full_name == "Иван Петров"


def test_stage_uses_season_interval(race):
    stage = race["stage"]
    assert stage.effective_interval_minutes == 20
    assert stage.effective_stale_after_minutes == 45
    stage.tracking_interval_minutes = 5  # учащаем точки на финишном отрезке
    assert stage.effective_interval_minutes == 5


def test_bib_number_unique_in_season(race):
    other = Participant(first_name="Анна", last_name="Сидорова")
    db.session.add(Entry(season=race["season"], participant=other, bib_number=14))
    with pytest.raises(IntegrityError):
        db.session.commit()


def test_checkpoint_mark_and_penalty(race):
    t = datetime(2027, 3, 1, 1, 30, tzinfo=timezone.utc)
    db.session.add(CheckpointMark(entry=race["entry"], checkpoint=race["cp1"],
                                  arrived_at=t, departed_at=t + timedelta(hours=2),
                                  entered_by="судья КП-1"))
    db.session.add(Penalty(entry=race["entry"], stage=race["stage"],
                           minutes=10, reason="Нарушение правил"))
    db.session.commit()
    assert len(race["entry"].checkpoint_marks) == 1
    assert race["entry"].penalties[0].minutes == 10


def test_duplicate_position_rejected(race):
    tracker = Tracker(imei="300234010000001", label="Трекер 01")
    db.session.add(TrackerAssignment(tracker=tracker, entry=race["entry"]))
    t = datetime(2027, 3, 1, 2, 0, tzinfo=timezone.utc)
    db.session.add(TrackerPosition(tracker=tracker, entry=race["entry"],
                                   recorded_at=t, latitude=53.1, longitude=158.7))
    db.session.commit()

    # Та же точка пришла второй раз при опросе Iridium — должна быть отклонена.
    db.session.add(TrackerPosition(tracker=tracker, entry=race["entry"],
                                   recorded_at=t, latitude=53.1, longitude=158.7))
    with pytest.raises(IntegrityError):
        db.session.commit()


def test_sos_stored_separately(race):
    tracker = Tracker(imei="300234010000002")
    db.session.add(TrackerAlert(tracker=tracker, entry=race["entry"],
                                occurred_at=datetime.now(timezone.utc)))
    db.session.commit()
    assert TrackerAlert.query.count() == 1
    assert TrackerPosition.query.count() == 0
