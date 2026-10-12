"""
Проверка моделей базы данных. Заодно — примеры асинхронной работы с базой:

    session.add(obj)                              # добавить
    await session.commit()                        # сохранить
    result = await session.execute(select(...))   # прочитать
    result.scalars().all() / .scalar_one()        # достать объекты

Связанные данные загружаем явно: .options(selectinload(Модель.связь))

Запуск из корня: python -m pytest -c backend/pytest.ini backend/tests -v
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, InvalidRequestError
from sqlalchemy.orm import selectinload

from app.models import (
    Checkpoint, CheckpointMark, CheckpointType, Discipline, Entry, Participant,
    Penalty, Season, SeasonStatus, Stage, Tracker, TrackerAlert,
    TrackerAssignment, TrackerPosition,
)


@pytest.fixture
async def race(session):
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
    session.add_all([season, stage, start, cp1, discipline, person, entry])
    await session.commit()
    return {"season": season, "stage": stage, "cp1": cp1, "entry": entry}


async def test_race_created(session, race):
    # Загружаем сезон вместе с этапами и их КП — так это делается в async
    stmt = (
        select(Season)
        .where(Season.year == 2027)
        .options(selectinload(Season.stages).selectinload(Stage.checkpoints))
    )
    session.expunge_all()  # «забываем» объекты, чтобы честно прочитать из базы
    season = (await session.execute(stmt)).scalar_one()

    assert season.status == SeasonStatus.UPCOMING
    assert [cp.code for cp in season.stages[0].checkpoints] == ["СТАРТ", "КП-1"]


async def test_lazy_loading_is_forbidden(session, race):
    """Если забыть selectinload — получим понятную ошибку, а не зависание."""
    session.expunge_all()
    season = (await session.execute(select(Season))).scalar_one()
    with pytest.raises(InvalidRequestError):
        _ = season.stages


async def test_stage_uses_season_interval(session, race):
    session.expunge_all()
    stmt = select(Stage).options(selectinload(Stage.season))
    stage = (await session.execute(stmt)).scalar_one()
    assert stage.effective_interval_minutes == 20
    assert stage.effective_stale_after_minutes == 45
    stage.tracking_interval_minutes = 5  # учащаем точки на финишном отрезке
    assert stage.effective_interval_minutes == 5


async def test_bib_number_unique_in_season(session, race):
    other = Participant(first_name="Анна", last_name="Сидорова")
    session.add(Entry(season_id=race["season"].id, participant=other, bib_number=14))
    with pytest.raises(IntegrityError):
        await session.commit()


async def test_checkpoint_mark_and_penalty(session, race):
    t = datetime(2027, 3, 1, 1, 30, tzinfo=timezone.utc)
    session.add(CheckpointMark(entry_id=race["entry"].id, checkpoint_id=race["cp1"].id,
                               arrived_at=t, departed_at=t + timedelta(hours=2),
                               entered_by="судья КП-1"))
    session.add(Penalty(entry_id=race["entry"].id, stage_id=race["stage"].id,
                        minutes=10, reason="Нарушение правил"))
    await session.commit()

    session.expunge_all()
    stmt = select(Entry).options(selectinload(Entry.checkpoint_marks), selectinload(Entry.penalties))
    entry = (await session.execute(stmt)).scalar_one()
    assert len(entry.checkpoint_marks) == 1
    assert entry.penalties[0].minutes == 10


async def test_duplicate_position_rejected(session, race):
    tracker = Tracker(imei="300234010000001", label="Трекер 01")
    session.add(TrackerAssignment(tracker=tracker, entry_id=race["entry"].id))
    t = datetime(2027, 3, 1, 2, 0, tzinfo=timezone.utc)
    session.add(TrackerPosition(tracker=tracker, entry_id=race["entry"].id,
                                recorded_at=t, latitude=53.1, longitude=158.7))
    await session.commit()

    # Та же точка пришла второй раз при опросе Iridium — должна быть отклонена.
    session.add(TrackerPosition(tracker_id=tracker.id, entry_id=race["entry"].id,
                                recorded_at=t, latitude=53.1, longitude=158.7))
    with pytest.raises(IntegrityError):
        await session.commit()


async def test_sos_stored_separately(session, race):
    tracker = Tracker(imei="300234010000002")
    session.add(TrackerAlert(tracker=tracker, entry_id=race["entry"].id,
                             occurred_at=datetime.now(timezone.utc)))
    await session.commit()
    alerts = await session.scalar(select(func.count()).select_from(TrackerAlert))
    positions = await session.scalar(select(func.count()).select_from(TrackerPosition))
    assert alerts == 1
    assert positions == 0
