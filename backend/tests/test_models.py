"""
Проверка моделей базы данных. Заодно — примеры асинхронной работы с базой:

    session.add(obj)                              # добавить
    await session.commit()                        # сохранить
    result = await session.execute(select(...))   # прочитать
    result.scalars().all() / .scalar_one()        # достать объекты

Связанные данные загружаем явно: .options(selectinload(Модель.связь))

Запуск из корня: python -m pytest -c backend/pytest.ini backend/tests -v
"""

from datetime import date, datetime, timezone

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError, InvalidRequestError
from sqlalchemy.orm import selectinload

from app.models import (
    ChangeAction, Checkpoint, CheckpointRole, Discipline, Equipment, Participant, Penalty,
    Protocol, ProtocolStatus, Race, RaceParticipant, ResultChangeLog, Stage, StageCheckpoint,
    StageResult, StageResultStatus, TrackerAlert, TrackerAssignment, TrackerDevice,
    TrackerPosition,
)


def hms(value: str) -> int:
    """'02:10:02' → секунды."""
    h, m, s = (int(x) for x in value.split(":"))
    return h * 3600 + m * 60 + s


@pytest.fixture
async def race(session):
    """Мини-гонка по мотивам протокола 2026: дисциплина, этап, КП, участник."""
    race = Race(name="Берингия. Авача 2026", year=2026,
                start_date=date(2026, 2, 6), end_date=date(2026, 2, 15))
    sled = Discipline(code="sled_8plus", name="Нарта — длинная дистанция, более 8 собак",
                      equipment=Equipment.SLED, dogs_min=9)
    stage = Stage(race=race, number=1, distance_km=33.7)
    base = Checkpoint(name="Биатлонный комплекс", latitude=53.05, longitude=158.65)
    kordon = Checkpoint(name="Центральный кордон", latitude=53.20, longitude=158.80)
    stage.stage_checkpoints = [
        StageCheckpoint(checkpoint=base, order_index=0, role=CheckpointRole.START, km_from_start=0),
        StageCheckpoint(checkpoint=kordon, order_index=1, label="КП-1", km_from_start=15.2,
                        required_rest_minutes=60),
        StageCheckpoint(checkpoint=base, order_index=2, role=CheckpointRole.FINISH, km_from_start=33.7),
    ]
    person = Participant(last_name="Шевчук", first_name="Георгий", middle_name="Геннадьевич",
                         birth_year=1993)
    entry = RaceParticipant(race=race, participant=person, discipline=sled,
                            start_number=18, region="Камчатский край", dogs_count=10)
    protocol = Protocol(stage=stage, discipline=sled)
    session.add_all([race, sled, stage, person, entry, protocol])
    await session.commit()
    return {"race": race, "discipline": sled, "stage": stage, "kordon": kordon,
            "entry": entry, "protocol": protocol}


# ── Гонка, этапы, КП ────────────────────────────────────────────────────────

async def test_stage_with_reused_checkpoint(session, race):
    """Одно физическое место — старт и финиш этапа; порядок КП сохраняется."""
    session.expunge_all()  # «забываем» объекты, чтобы честно прочитать из базы
    stmt = select(Stage).options(
        selectinload(Stage.stage_checkpoints).selectinload(StageCheckpoint.checkpoint)
    )
    stage = (await session.execute(stmt)).scalar_one()
    names = [sc.checkpoint.name for sc in stage.stage_checkpoints]
    assert names == ["Биатлонный комплекс", "Центральный кордон", "Биатлонный комплекс"]
    assert stage.stage_checkpoints[-1].role == CheckpointRole.FINISH
    assert await session.scalar(select(func.count()).select_from(Checkpoint)) == 2


async def test_checkpoint_reused_in_next_year(session, race):
    """Тот же Центральный кордон на этапе другой гонки — без дублирования места."""
    race_2027 = Race(name="Берингия. Авача 2027", year=2027)
    stage = Stage(race=race_2027, number=3)
    stage.stage_checkpoints = [StageCheckpoint(checkpoint_id=race["kordon"].id, order_index=0,
                                               role=CheckpointRole.START)]
    session.add(race_2027)
    await session.commit()
    used = await session.scalar(
        select(func.count()).select_from(StageCheckpoint)
        .where(StageCheckpoint.checkpoint_id == race["kordon"].id)
    )
    assert used == 2


async def test_lazy_loading_is_forbidden(session, race):
    """Если забыть selectinload — понятная ошибка, а не скрытый запрос."""
    session.expunge_all()
    loaded = (await session.execute(select(Race))).scalar_one()
    with pytest.raises(InvalidRequestError):
        _ = loaded.stages


async def test_stage_uses_race_interval(session, race):
    session.expunge_all()
    stage = (await session.execute(select(Stage).options(selectinload(Stage.race)))).scalar_one()
    assert stage.effective_interval_minutes == 20
    assert stage.effective_stale_after_minutes == 45
    stage.tracking_interval_minutes = 5   # учащаем точки на финишном отрезке
    assert stage.effective_interval_minutes == 5


async def test_enum_stored_as_value(session, race):
    """В базе — значение ("upcoming"), а не имя элемента ("UPCOMING")."""
    raw = await session.scalar(text("SELECT status FROM races"))
    assert raw == "upcoming"


# ── Участники ──────────────────────────────────────────────────────────────

async def test_start_number_unique_in_race(session, race):
    other = Participant(last_name="Попов", first_name="Алексей", birth_year=1972)
    session.add(RaceParticipant(race_id=race["race"].id, participant=other,
                                discipline_id=race["discipline"].id, start_number=18))
    with pytest.raises(IntegrityError):
        await session.commit()


async def test_same_person_in_two_races(session, race):
    """Один человек — одна запись Participant, участия в разных годах."""
    race_2027 = Race(name="Берингия. Авача 2027", year=2027)
    session.add(RaceParticipant(race=race_2027, participant_id=race["entry"].participant_id,
                                discipline_id=race["discipline"].id, start_number=1))
    await session.commit()
    count = await session.scalar(
        select(func.count()).select_from(RaceParticipant)
        .where(RaceParticipant.participant_id == race["entry"].participant_id)
    )
    assert count == 2


# ── Протоколы и результаты ──────────────────────────────────────────────────

async def test_result_with_penalty(session, race):
    """Как в протоколе: время этапа включает штраф; храним чистое + штраф = итог."""
    final = hms("02:10:02")
    result = StageResult(protocol_id=race["protocol"].id, race_participant_id=race["entry"].id,
                         net_time_seconds=final - 120, penalty_seconds=120,
                         final_time_seconds=final, dogs_at_start=10, dogs_at_finish=10)
    result.penalties = [Penalty(seconds=120, reason="Штрафное время", rule_reference="П.14.11.14")]
    session.add(result)
    await session.commit()

    session.expunge_all()
    stmt = select(StageResult).options(selectinload(StageResult.penalties))
    loaded = (await session.execute(stmt)).scalar_one()
    assert loaded.final_time_seconds == hms("02:10:02")
    assert sum(p.seconds for p in loaded.penalties) == loaded.penalty_seconds


async def test_final_time_must_equal_net_plus_penalty(session, race):
    session.add(StageResult(protocol_id=race["protocol"].id, race_participant_id=race["entry"].id,
                            net_time_seconds=1000, penalty_seconds=60, final_time_seconds=999))
    with pytest.raises(IntegrityError):
        await session.commit()


async def test_dnf_has_no_time(session, race):
    """DNF/DNS — без времени; участник при этом остаётся в протоколе."""
    session.add(StageResult(protocol_id=race["protocol"].id, race_participant_id=race["entry"].id,
                            status=StageResultStatus.DNF))
    await session.commit()
    session.add(StageResult(protocol_id=race["protocol"].id, race_participant_id=race["entry"].id,
                            status=StageResultStatus.DNS, net_time_seconds=10, final_time_seconds=10))
    with pytest.raises(IntegrityError):   # и дубль строки, и время у DNS запрещены
        await session.commit()


async def test_dogs_cannot_increase_during_stage(session, race):
    session.add(StageResult(protocol_id=race["protocol"].id, race_participant_id=race["entry"].id,
                            net_time_seconds=100, final_time_seconds=100,
                            dogs_at_start=9, dogs_at_finish=10))
    with pytest.raises(IntegrityError):
        await session.commit()


async def test_final_protocol_requires_finalized_at(session, race):
    race["protocol"].status = ProtocolStatus.FINAL
    with pytest.raises(IntegrityError):
        await session.commit()


async def test_post_final_correction_requires_basis(session, race):
    """Правка окончательного протокола — только с основанием и утвердившим."""
    # id запоминаем заранее: после rollback() объекты «устаревают»,
    # а повторно читать их из базы неявно в async нельзя.
    protocol_id = race["protocol"].id
    session.add(ResultChangeLog(protocol_id=protocol_id, entity="stage_result",
                                action=ChangeAction.UPDATE, field="net_time_seconds",
                                old_value="7802", new_value="7800", changed_by="секретарь",
                                is_post_final=True))
    with pytest.raises(IntegrityError):
        await session.commit()
    await session.rollback()

    session.add(ResultChangeLog(protocol_id=protocol_id, entity="stage_result",
                                action=ChangeAction.UPDATE, field="net_time_seconds",
                                old_value="7802", new_value="7800", changed_by="секретарь",
                                is_post_final=True, reason="Решение ГСК №3",
                                approved_by="Главный судья"))
    await session.commit()


async def test_total_is_sum_of_stages_real_2026_data(session):
    """Протокол 2026, Шевчук Г. Г.: сумма шести этапов = общий результат 18:25:10."""
    stage_times = ["02:10:02", "03:42:14", "04:37:54", "02:34:30", "03:46:33", "01:33:57"]
    assert sum(hms(t) for t in stage_times) == hms("18:25:10")


# ── Трекинг ────────────────────────────────────────────────────────────────

async def test_duplicate_position_rejected(session, race):
    device = TrackerDevice(imei="300234010000001", name="Трекер 01")
    session.add(TrackerAssignment(tracker_device=device, race_participant_id=race["entry"].id))
    t = datetime(2026, 2, 6, 2, 0, tzinfo=timezone.utc)
    session.add(TrackerPosition(tracker_device=device, race_participant_id=race["entry"].id,
                                external_point_id="p-1", position_at=t,
                                latitude=53.1, longitude=158.7, battery_percent=87))
    await session.commit()

    # Та же точка пришла повторно при опросе Iridium — должна быть отклонена.
    session.add(TrackerPosition(tracker_device_id=device.id, external_point_id="p-1",
                                position_at=datetime(2026, 2, 6, 2, 1, tzinfo=timezone.utc),
                                latitude=53.1, longitude=158.7))
    with pytest.raises(IntegrityError):
        await session.commit()


async def test_sos_stored_separately(session, race):
    device = TrackerDevice(imei="300234010000002")
    session.add(TrackerAlert(tracker_device=device, race_participant_id=race["entry"].id,
                             occurred_at=datetime.now(timezone.utc)))
    await session.commit()
    assert await session.scalar(select(func.count()).select_from(TrackerAlert)) == 1
    assert await session.scalar(select(func.count()).select_from(TrackerPosition)) == 0
