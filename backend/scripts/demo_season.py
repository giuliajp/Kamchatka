"""
Демонстрационный сезон «Гонка Авача 2027» — для показа приложения заказчику.

Заполняет базу так, чтобы все экраны выглядели как в макетах:
- 6 этапов: 1–2 завершены (протоколы опубликованы, этап 1 утверждён), этап 3 идёт сейчас
  (участники на карте, отметки судей на КП, один трекер просрочен, один SOS),
  этап 4 стартует через 2 дня (обратный отсчёт), 5–6 впереди;
- маршруты с профилем высот, КП и обязательные остановки;
- участники с фото, биографией, породой собак, болельщиками и «+N за сутки», штраф;
- программа по дням (гонка, культурная программа, мастер-классы, встречи) с фото,
  зрительские локации, «Гостям», FAQ, контакты.

Даты считаются от текущего момента: этап 3 всегда «идёт сейчас».
Перезапуск удаляет прежний демо-сезон и создаёт его заново.

Из корня проекта, с включённым окружением:
    python backend/scripts/demo_season.py
Чтобы участники двигались по карте во время показа (каждую минуту новая точка):
    python backend/scripts/demo_season.py --live
Удалить демо-сезон:
    python backend/scripts/demo_season.py --remove

На сервере заказчика (ENVIRONMENT=production) скрипт не запускается.
"""

from __future__ import annotations

import argparse
import asyncio
import math
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

DEMO_YEAR = 2027
DEMO_NAME = "Гонка Авача 2027"
DEMO_IMEI = "999"                    # IMEI демо-трекеров начинаются с 999
FAN_ID_BASE = 900_000_000            # id «болельщиков» VK в демо
KAMCHATKA = timezone(timedelta(hours=12))
IMG = "/api/demo-media/"     # картинки демо — в backend/scripts/demo_media

# Нитки маршрутов: (широта, долгота) опорных точек. Камчатка, окрестности Елизово.
ROUTES = [
    ("Елизово — Пиначево", [(53.185, 158.385), (53.215, 158.47), (53.27, 158.55), (53.32, 158.66), (53.345, 158.745)]),
    ("Пиначево — Раздольный", [(53.345, 158.745), (53.30, 158.62), (53.24, 158.50), (53.17, 158.33), (53.12, 158.25)]),
    ("Раздольный — Сокоч", [(53.12, 158.25), (53.06, 158.12), (53.00, 157.98), (52.93, 157.86), (52.87, 157.75)]),
    ("Сокоч — Начики", [(52.87, 157.75), (52.90, 157.62), (52.95, 157.50), (53.02, 157.40), (53.08, 157.33)]),
    ("Начики — Пиначево", [(53.08, 157.33), (53.15, 157.55), (53.22, 157.85), (53.30, 158.25), (53.345, 158.745)]),
    ("Пиначево — Елизово", [(53.345, 158.745), (53.30, 158.62), (53.25, 158.52), (53.21, 158.44), (53.185, 158.385)]),
]
# (дней от сейчас, час старта по Камчатке) для этапов 1–6; этап 3 — «идёт» (старт 4 ч назад).
STAGE_DAYS = [-2, -1, None, 2, 3, 4]

PEOPLE = [  # номер, фамилия, имя, дисциплина, регион, собак, скорость (км/ч), болельщики, фото
    (21, "Семёнов", "Иван", "sled_8", "Камчатский край", 8, 13.6, 1430, IMG + "f9ed3.jpg"),
    (14, "Иванова", "Алиса", "sled_8plus", "Камчатский край", 12, 13.2, 1240, IMG + "alisa.jpg"),
    (3, "Крылова", "Елена", "ski_2", "Магаданская область", 2, 9.8, 933, IMG + "c053b.jpg"),
    (9, "Морозов", "Алексей", "sled_8", "Камчатский край", 8, 12.9, 992, None),
    (12, "Юсупов-Сумароков", "Матвей", "sled_8", "Хабаровский край", 8, 12.4, 562, None),
    (1, "Иванов", "Иван", "sled_8plus", "Камчатский край", 10, 12.8, 488, None),
    (8, "Павлова", "Анна", "ski_2", "Камчатский край", 2, 9.4, 351, None),
    (5, "Васильев", "Сергей", "sled_8", "Чукотский АО", 8, 12.1, 274, None),
    (7, "Петрова", "Ирина", "sled_8plus", "Камчатский край", 11, 12.2, 305, None),
    (11, "Соколова", "Наталья", "ski_2", "Сахалинская область", 2, 9.0, 198, None),
    (16, "Орлов", "Владислав", "sled_8", "Иркутская область", 8, 11.8, 157, None),
    (18, "Морозов", "Валентин", "sled_8plus", "Камчатский край", 9, 12.6, 226, None),
    (22, "Смирнов", "Игорь", "sled_8", "Камчатский край", 8, 11.5, 143, None),
    (4, "Белова", "Ольга", "ski_2", "Магаданская область", 2, 8.8, 96, None),
]
BIO = ("Алиса родилась в Усть-Большерецке, на западном побережье Камчатки, в семье лесника и школьной "
       "учительницы. Первого щенка лайки ей подарил дед на десятилетие.\n\nСегодня у Алисы 12 ездовых "
       "лаек. Вожак упряжки, опытная сука Нерпа, ведёт стаю уже пятый сезон. Алиса сама выращивает щенков "
       "и тренирует собак круглый год.\n\nВ 2024 году она взяла бронзу на дистанции 10 км, а в 2025-м "
       "выиграла свою первую «Авачу» в классе упряжек из 12 собак. Сейчас она готовится защищать титул.")
DNF_STAGE2 = 11          # сошла на этапе 2
OVERDUE = 9              # трекер не передаёт данные дольше порога
SOS = 7                  # активный тревожный сигнал (виден только в админке)
PENALTY = (1, 300, "Нарушение правил старта", "П.14.11.14")


def haversine(a, b) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def build_route(points, seed: int):
    """Плавная нитка трассы с высотами: [(lat, lon, ele)] и длины от старта."""
    rnd = random.Random(seed)
    line = []
    for (a, b) in zip(points, points[1:]):
        for i in range(25):
            t = i / 25
            wobble = 0.004 * math.sin(t * math.pi * 2 + rnd.random())
            line.append((a[0] + (b[0] - a[0]) * t + wobble, a[1] + (b[1] - a[1]) * t - wobble))
    line.append(points[-1])
    out, km = [], [0.0]
    for i, (lat, lon) in enumerate(line):
        t = i / (len(line) - 1)
        ele = 80 + 320 * math.sin(t * math.pi) ** 1.5 + 60 * math.sin(t * math.pi * 6 + seed)
        out.append((lat, lon, round(ele)))
        if i:
            km.append(km[-1] + haversine(line[i - 1], line[i]))
    return out, km


def point_at(route, kms, distance):
    for i in range(1, len(kms)):
        if kms[i] >= distance:
            share = (distance - kms[i - 1]) / max(kms[i] - kms[i - 1], 1e-9)
            a, b = route[i - 1], route[i]
            return a[0] + (b[0] - a[0]) * share, a[1] + (b[1] - a[1]) * share
    return route[-1][0], route[-1][1]


def kamchatka(day_offset: int, hour: int, now: datetime) -> datetime:
    local = now.astimezone(KAMCHATKA)
    return (local + timedelta(days=day_offset)).replace(hour=hour, minute=0, second=0, microsecond=0) \
        .astimezone(timezone.utc)


async def remove_demo(session) -> None:
    from sqlalchemy import delete, select

    from app.models import (
        Checkpoint, ProgramEvent, Race, SpectatorLocation, SupportSubscription, TrackerAlert, TrackerAssignment,
        TrackerDevice, TrackerPosition,
    )

    devices = select(TrackerDevice.id).where(TrackerDevice.imei.like(f"{DEMO_IMEI}%"))
    await session.execute(delete(TrackerAlert).where(TrackerAlert.tracker_device_id.in_(devices)))
    await session.execute(delete(TrackerPosition).where(TrackerPosition.tracker_device_id.in_(devices)))
    await session.execute(delete(TrackerAssignment).where(TrackerAssignment.tracker_device_id.in_(devices)))
    await session.execute(delete(TrackerDevice).where(TrackerDevice.imei.like(f"{DEMO_IMEI}%")))
    await session.execute(delete(SupportSubscription).where(SupportSubscription.vk_user_id >= FAN_ID_BASE))
    race_id = await session.scalar(select(Race.id).where(Race.year == DEMO_YEAR))
    if race_id is not None:
        # Сначала программа и локации: они ссылаются на этапы гонки.
        await session.execute(delete(ProgramEvent).where(ProgramEvent.race_id == race_id))
        await session.execute(delete(SpectatorLocation).where(SpectatorLocation.race_id == race_id))
        await session.execute(delete(Race).where(Race.id == race_id))   # остальное удалит база (CASCADE)
    await session.execute(delete(Checkpoint).where(Checkpoint.name.like("Демо: %")))
    # Демо-спортсмены без заявок в других сезонах.
    from sqlalchemy import or_, and_
    from app.models import Participant, RaceParticipant
    names = or_(*[and_(Participant.last_name == p[1], Participant.first_name == p[2]) for p in PEOPLE])
    await session.execute(delete(Participant).where(names, Participant.id.not_in(select(RaceParticipant.participant_id))))


async def create_demo(session, now: datetime) -> str:
    from sqlalchemy import insert, select, update

    from app.models import (
        AlertType, Checkpoint, CheckpointPass, CheckpointRole, Discipline, FaqItem, GuestInfoItem,
        OrganizerContact, Participant, Penalty, ProgramEvent, Protocol, ProtocolStatus, Race,
        RaceParticipant, RaceParticipantStatus, RaceStatus, SpectatorLocation, Stage, StageCheckpoint,
        StageResult, StageResultStatus, StageStatus, SupportSubscription, TrackerAlert, TrackerAssignment,
        TrackerDevice, TrackerPosition,
    )

    rnd = random.Random(2027)
    disciplines = {d.code: d for d in await session.scalars(select(Discipline))}
    missing = {p[3] for p in PEOPLE} - set(disciplines)
    if missing:
        return f"Ошибка: нет дисциплин {missing} — выполните миграции"

    await session.execute(update(Race).values(is_current=False))
    race = Race(name=DEMO_NAME, year=DEMO_YEAR, status=RaceStatus.LIVE, is_current=True,
                location="Камчатский край, Елизовский район")
    session.add(race)
    await session.flush()

    # ── Этапы, маршруты, КП ──
    stages, routes = [], []
    for number, ((title, anchors), day) in enumerate(zip(ROUTES, STAGE_DAYS), start=1):
        route, kms = build_route(anchors, number)
        if day is None:
            start = (now - timedelta(hours=4)).astimezone(KAMCHATKA).replace(minute=0, second=0, microsecond=0)
            start, status = start.astimezone(timezone.utc), StageStatus.LIVE
        else:
            start = kamchatka(day, 9, now)
            status = StageStatus.FINISHED if day < 0 else StageStatus.PLANNED
        stage = Stage(race_id=race.id, number=number, name=title, distance_km=round(kms[-1], 1),
                      start_at=start, finish_at=start + timedelta(hours=9), status=status,
                      description=f"Этап {number}: {title}. Трасса по долинам рек и перевалам, "
                                  "участки с глубоким снегом и наледями.",
                      route_geojson={"type": "LineString", "coordinates": [[lon, lat, ele] for lat, lon, ele in route]},
                      route_updated_at=now, route_source_filename=f"etap{number}.gpx")
        session.add(stage)
        stages.append(stage)
        routes.append((route, kms))
    await session.flush()
    # Ссылки «Скачать протокол .pdf» (в демо — протокол 2026 года) и архив прошлого сезона.
    race.protocol_pdf_url = IMG + "protocol-2026.pdf"
    for stage in stages[:2]:
        stage.protocol_pdf_url = IMG + "protocol-2026.pdf"
    await session.execute(update(Race).where(Race.year == DEMO_YEAR - 1, Race.protocol_pdf_url.is_(None))
                          .values(protocol_pdf_url=IMG + "protocol-2026.pdf"))
    race.start_date = stages[0].start_at.astimezone(KAMCHATKA).date()
    race.end_date = stages[-1].start_at.astimezone(KAMCHATKA).date()

    checkpoints: dict[int, list[StageCheckpoint]] = {}
    for stage, (route, kms) in zip(stages, routes):
        items = []
        plan = [(0.0, CheckpointRole.START, "Старт", 0), (0.3, CheckpointRole.CHECKPOINT, "КП-1", 0),
                (0.55, CheckpointRole.CHECKPOINT, "КП-2", 60), (0.8, CheckpointRole.CHECKPOINT, "КП-3", 30),
                (1.0, CheckpointRole.FINISH, "Финиш", 0)]
        for index, (share, role, label, rest) in enumerate(plan):
            lat, lon = point_at(route, kms, kms[-1] * share)
            place = Checkpoint(name=f"Демо: этап {stage.number}, {label}", latitude=lat, longitude=lon)
            session.add(place)
            await session.flush()
            item = StageCheckpoint(stage_id=stage.id, checkpoint_id=place.id, order_index=index, role=role,
                                   label=label, km_from_start=round(kms[-1] * share, 1), required_rest_minutes=rest,
                                   segment_description=None if index == 0 else
                                   ["", "Пологий подъём вдоль реки, плотный накат.",
                                    "Перевал: крутой подъём и длинный спуск, ветер.",
                                    "Лесной участок с наледями — снижайте скорость.",
                                    "Финишная прямая по открытой тундре."][index])
            session.add(item)
            items.append(item)
        checkpoints[stage.id] = items
    await session.flush()

    # ── Участники ──
    entries = {}
    for number, last, first, code, region, dogs, speed, fans, photo in PEOPLE:
        person = Participant(last_name=last, first_name=first, birth_year=rnd.randint(1972, 2002), photo_url=photo,
                             bio=BIO if number == 14 else f"{first} {last} выступает на «Аваче» "
                                                         f"{rnd.randint(2, 7)}-й сезон. Упряжка — собственного разведения.")
        session.add(person)
        await session.flush()
        entry = RaceParticipant(race_id=race.id, participant_id=person.id, discipline_id=disciplines[code].id,
                                start_number=number, region=region, dogs_count=dogs,
                                dog_breed="Ездовые лайки" if code != "ski_2" else "Аляскинские хаски",
                                status=RaceParticipantStatus.ACTIVE)
        session.add(entry)
        entries[number] = (entry, speed, fans, person)
    await session.flush()

    # ── Завершённые этапы: протоколы и отметки КП ──
    for stage, (route, kms) in zip(stages[:2], routes[:2]):
        protocols = {}
        for code, discipline in disciplines.items():
            protocol = Protocol(stage_id=stage.id, discipline_id=discipline.id, published_at=stage.finish_at,
                                weather="Ясно, −18 °C, ветер 4 м/с", chief_judge="Главный судья Отбеткин П. В.",
                                chief_secretary="Главный секретарь Котова Е. А.")
            if stage.number == 1:
                protocol.status, protocol.finalized_at = ProtocolStatus.FINAL, stage.finish_at + timedelta(hours=3)
                protocol.finalized_by = "Главный судья Отбеткин П. В."
            session.add(protocol)
            protocols[code] = protocol
        await session.flush()
        for number, (entry, speed, _fans, _p) in entries.items():
            code = next(c for c, d in disciplines.items() if d.id == entry.discipline_id)
            if stage.number == 2 and number == DNF_STAGE2:
                session.add(StageResult(protocol_id=protocols[code].id, race_participant_id=entry.id,
                                        status=StageResultStatus.DNF, note="Травма собаки на КП-2"))
                entry.status = RaceParticipantStatus.DNF
                continue
            pace = speed * rnd.uniform(0.93, 1.05)
            seconds = int(kms[-1] / pace * 3600) + 60 * sum(c.required_rest_minutes for c in checkpoints[stage.id])
            session.add(StageResult(protocol_id=protocols[code].id, race_participant_id=entry.id,
                                    status=StageResultStatus.FINISHED, final_time_seconds=seconds,
                                    net_time_seconds=seconds, dogs_at_start=entry.dogs_count,
                                    dogs_at_finish=entry.dogs_count - (1 if rnd.random() < 0.2 else 0)))
            clock = stage.start_at
            for cp in checkpoints[stage.id][1:]:
                previous = next(c for c in checkpoints[stage.id] if c.order_index == cp.order_index - 1)
                clock += timedelta(hours=(cp.km_from_start - previous.km_from_start) / pace)
                session.add(CheckpointPass(race_participant_id=entry.id, stage_checkpoint_id=cp.id, arrived_at=clock,
                                           departed_at=clock + timedelta(minutes=cp.required_rest_minutes)
                                           if cp.required_rest_minutes else None, entered_by="Судья КП"))
                clock += timedelta(minutes=cp.required_rest_minutes)
    number, seconds, reason, rule = PENALTY
    session.add(Penalty(race_participant_id=entries[number][0].id, seconds=seconds, reason=reason, rule_reference=rule))

    # ── Этап 3 идёт: трекеры, точки, отметки, просрочка, SOS ──
    live, (route, kms) = stages[2], routes[2]
    for number, (entry, speed, _fans, _p) in entries.items():
        if number == DNF_STAGE2:
            continue
        device = TrackerDevice(imei=f"{DEMO_IMEI}{number:012d}", name=f"Трекер №{number}", is_active=True)
        session.add(device)
        await session.flush()
        session.add(TrackerAssignment(tracker_device_id=device.id, race_participant_id=entry.id,
                                      valid_from=now - timedelta(days=3)))
        pace = speed * rnd.uniform(0.72, 1.08)       # разброс — участники растянуты по трассе
        last_age = 55 if number == OVERDUE else rnd.randint(3, 17)
        last_at = now - timedelta(minutes=last_age)
        moment, battery = live.start_at, rnd.randint(85, 100)
        rest_left = {cp.id: cp.required_rest_minutes for cp in checkpoints[live.id]}
        travelled, previous_km, previous_time = 0.0, 0.0, live.start_at
        while moment <= last_at:
            hours = (moment - previous_time).total_seconds() / 3600
            travelled = min(previous_km + pace * hours, kms[-1] * 0.97)
            for cp in checkpoints[live.id][1:-1]:          # обязательный отдых на КП
                if previous_km < cp.km_from_start <= travelled and rest_left[cp.id]:
                    arrived = previous_time + timedelta(hours=(cp.km_from_start - previous_km) / pace)
                    session.add(CheckpointPass(
                        race_participant_id=entry.id, stage_checkpoint_id=cp.id, arrived_at=arrived,
                        departed_at=arrived + timedelta(minutes=cp.required_rest_minutes)
                        if arrived + timedelta(minutes=cp.required_rest_minutes) < now else None,
                        entered_by="Судья КП"))
                    travelled = cp.km_from_start
                    moment = max(moment, arrived + timedelta(minutes=rest_left[cp.id]))
                    rest_left[cp.id] = 0
                elif previous_km < cp.km_from_start <= travelled:
                    arrived = previous_time + timedelta(hours=(cp.km_from_start - previous_km) / pace)
                    session.add(CheckpointPass(race_participant_id=entry.id, stage_checkpoint_id=cp.id,
                                               arrived_at=arrived, entered_by="Судья КП"))
            lat, lon = point_at(route, kms, travelled)
            stamp = min(moment, last_at)
            session.add(TrackerPosition(tracker_device_id=device.id, race_participant_id=entry.id,
                                        stage_id=live.id, position_at=stamp, latitude=lat,
                                        longitude=lon, battery_percent=battery))
            battery = max(battery - rnd.randint(1, 3), 15)
            previous_km, previous_time = travelled, stamp
            if stamp == last_at:
                break
            moment = min(moment + timedelta(minutes=20), last_at)
        if number == SOS:
            session.add(TrackerAlert(tracker_device_id=device.id, race_participant_id=entry.id, type=AlertType.SOS,
                                     occurred_at=last_at, latitude=lat, longitude=lon))

    # ── Болельщики («Болею за», +N за сутки) ──
    rows, fan_id = [], FAN_ID_BASE
    for number, (entry, _speed, fans, _p) in entries.items():
        fresh = max(fans // 15, 3)
        for i in range(fans):
            age = timedelta(hours=rnd.uniform(1, 23)) if i < fresh else timedelta(days=rnd.uniform(1.1, 25))
            rows.append({"vk_user_id": fan_id, "race_participant_id": entry.id, "created_at": now - age,
                         "notifications_enabled": True})
            fan_id += 1
    for start in range(0, len(rows), 2000):
        await session.execute(insert(SupportSubscription), rows[start:start + 2000])

    # ── Зрительские локации и программа ──
    def local(day: int, hour: int, minute: int = 0) -> datetime:
        return kamchatka(day, hour, now) + timedelta(minutes=minute)

    loc = {}
    for key, kind, name, lat, lon, stage, images, text in [
        ("start", "start", "Старт в Елизово", 53.185, 158.385, stages[0], [IMG + "d6d50.jpg", IMG + "02447.jpg"],
         "Стартовая поляна у спортивного комплекса. Трибуны, горячий чай, сувениры."),
        ("finish", "finish", "Финиш в Пиначево", 53.345, 158.745, stages[0], [IMG + "9eae6.jpg", IMG + "d7616.jpg"],
         "Финишный городок в посёлке Пиначево. Встреча упряжек и награждение."),
        ("kvtc", "festival", "Камчатский выставочно-туристический центр (КВТЦ)", 53.06, 158.62, None,
         [IMG + "b1cb4.jpg", IMG + "f31e1.jpg"], "Фестивальная площадка: мастер-классы, ярмарка, встречи с каюрами."),
        ("view", "viewpoint", "Смотровая площадка у Авачинской сопки", 53.25, 158.52, None,
         [IMG + "efbd4.jpg", IMG + "67f5d.jpg"], "Лучшее место для фото упряжек на фоне вулканов."),
        ("kp", "checkpoint", "КП-2 «Перевал»", *point_at(*routes[2], routes[2][1][-1] * 0.55), stages[2],
         [IMG + "b5483.jpg"], "Контрольный пункт с обязательной остановкой. Зрителям — только в отведённой зоне."),
    ]:
        item = SpectatorLocation(race_id=race.id, stage_id=stage.id if stage else None, location_type=kind,
                                 name=name, latitude=lat, longitude=lon, description=text, image_urls=images,
                                 address="Камчатский край" if kind != "festival" else "г. Петропавловск-Камчатский",
                                 how_to_get_there="Трансфер от КВТЦ каждый час с 8:00. На своей машине — "
                                                  "парковка у зоны старта.", is_published=True)
        session.add(item)
        loc[key] = item
    await session.flush()

    events = []
    for stage, (route, kms) in zip(stages, routes):
        events.append(("stage_start", stage, f"Старт этапа {stage.number}: {stage.name}", stage.start_at,
                       None, loc["start"] if stage.number == 1 else None, [IMG + "d6d50.jpg"]))
        events.append(("stage_finish", stage, f"Финиш этапа {stage.number}", stage.start_at + timedelta(hours=6),
                       stage.start_at + timedelta(hours=9), loc["finish"] if stage.number in (1, 5) else None,
                       [IMG + "9eae6.jpg"]))
    for day in range(-2, 5):
        events += [
            ("festival", None, "Обряд встречи гостей", local(day, 11), local(day, 12), loc["kvtc"],
             [IMG + "b1cb4.jpg"]),
            ("master_class", None, "Мастер-классы для детей: упряжь и уход за собаками", local(day, 13),
             local(day, 15), loc["kvtc"], [IMG + "f31e1.jpg"]),
            ("meeting", None, "Встреча с каюрами", local(day, 18), local(day, 19, 30), loc["kvtc"],
             [IMG + "547f5.jpg"]),
        ]
    events.append(("festival", None, "Торжественное награждение победителей", local(4, 19), local(4, 21),
                   loc["kvtc"], [IMG + "f9ed3.jpg"]))
    for kind, stage, title, start, end, place, images in events:
        session.add(ProgramEvent(race_id=race.id, stage_id=stage.id if stage else None, event_type=kind,
                                 title=title, start_at=start, end_at=end, location_id=place.id if place else None,
                                 description="Вход свободный. Следите за изменениями в разделе «Программа».",
                                 image_urls=images, is_published=True))

    # ── «Гостям», FAQ, контакты (общие для всех сезонов: создаём, только если пусто) ──
    if not await session.scalar(select(GuestInfoItem.id).limit(1)):
        for order, (section, title, text) in enumerate([
            ("how_to_get_there", "Самолётом", "Аэропорт Елизово (PKC). Далее — трансфер или такси до места старта."),
            ("how_to_get_there", "На автомобиле", "Парковка у зоны старта."),
            ("how_to_get_there", "Карта зрительских локаций",
             "В разделе «Программа» находится карта зрительских локаций с маршрутом на Яндекс Картах."),
            ("what_to_bring", None, "Тёплая и непромокаемая верхняя одежда, термобельё"),
            ("what_to_bring", None, "Зимняя обувь с нескользящей подошвой"),
            ("what_to_bring", None, "Запасные перчатки, шапка, шарф"),
            ("what_to_bring", None, "Термос с горячим питьём и перекус"),
            ("what_to_bring", None, "Заряженный телефон и портативное зарядное устройство"),
            ("safety", None, "Наблюдайте за гонкой только в отмеченных зонах для зрителей."),
            ("safety", None, "Не выходите на трассу, пока упряжки в движении."),
            ("safety", None, "Не трогайте собак без разрешения каюра."),
            ("safety", None, "Не допускайте переохлаждения. В экстренной ситуации звоните в службу спасения 112."),
        ]):
            session.add(GuestInfoItem(section=section, title=title, text=text, sort_order=order, is_published=True))
    if not await session.scalar(select(FaqItem.id).limit(1)):
        for order, (q, a) in enumerate([
            ("Можно ли приезжать с детьми?", "Да, но в зонах для зрителей. Одевайте детей теплее и не оставляйте "
                                             "без присмотра рядом с трассой."),
            ("Нужен ли билет?", "Нет, все зрительские зоны и фестивальная программа — бесплатно."),
            ("Где можно согреться?", "В шатрах на старте и финише и в КВТЦ: горячий чай и обогрев."),
            ("Можно ли снимать на дрон?", "Только с разрешения организаторов: дрон пугает собак."),
        ]):
            session.add(FaqItem(question=q, answer=a, sort_order=order, is_published=True))
    if not await session.scalar(select(OrganizerContact.id).limit(1)):
        session.add(OrganizerContact(title="Горячая линия для гостей в дни гонки", phone="+7 000 000-00-00",
                                     sort_order=0, is_published=True))
    await session.flush()
    return (f"Создан «{DEMO_NAME}»: 6 этапов (этап 3 идёт сейчас), {len(entries)} участников, "
            f"{len(rows)} болельщиков, {len(events)} событий программы. Сезон сделан текущим.")


async def tick(factory) -> int:
    """Каждый вызов: новая точка у участников идущего этапа (кроме «просроченного»)."""
    from sqlalchemy import select

    from app.models import Race, RaceParticipant, Stage, StageStatus, TrackerAssignment, TrackerDevice, TrackerPosition
    from app.models.base import utcnow

    async with factory.begin() as session:
        race = await session.scalar(select(Race).where(Race.year == DEMO_YEAR))
        stage = race and await session.scalar(select(Stage).where(Stage.race_id == race.id,
                                                                   Stage.status == StageStatus.LIVE))
        if not stage:
            return 0
        coords = stage.route_geojson["coordinates"]
        route = [(c[1], c[0], c[2]) for c in coords]
        kms = [0.0]
        for a, b in zip(route, route[1:]):
            kms.append(kms[-1] + haversine(a, b))
        rows = await session.execute(
            select(TrackerDevice, RaceParticipant).join(TrackerAssignment, TrackerAssignment.tracker_device_id ==
                                                        TrackerDevice.id)
            .join(RaceParticipant, RaceParticipant.id == TrackerAssignment.race_participant_id)
            .where(TrackerDevice.imei.like(f"{DEMO_IMEI}%"), RaceParticipant.race_id == race.id))
        moved = 0
        for device, entry in rows.all():
            if entry.start_number == OVERDUE:
                continue
            last = await session.scalar(select(TrackerPosition).where(TrackerPosition.tracker_device_id == device.id)
                                        .order_by(TrackerPosition.position_at.desc()).limit(1))
            if last is None:
                continue
            nearest = min(range(len(route)), key=lambda i: haversine(route[i], (last.latitude, last.longitude)))
            target = min(kms[nearest] + random.uniform(1.0, 2.5), kms[-1] * 0.99)
            lat, lon = point_at(route, kms, target)
            session.add(TrackerPosition(tracker_device_id=device.id, race_participant_id=entry.id, stage_id=stage.id,
                                        position_at=utcnow(), latitude=lat, longitude=lon,
                                        battery_percent=max((last.battery_percent or 50) - 1, 15)))
            moved += 1
        return moved


async def main_async(args) -> int:
    backend = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(backend))
    from app.config import get_settings
    from app.db import SessionLocal, engine
    from app.models.base import utcnow

    if get_settings().is_production:
        print("Ошибка: демо-данные нельзя создавать на рабочем сервере (ENVIRONMENT=production)")
        return 1
    try:
        if args.live:
            print("Участники двигаются: новая точка каждую минуту. Остановить — Ctrl+C.")
            while True:
                print(f"Обновлено участников: {await tick(SessionLocal)}")
                await asyncio.sleep(60)
        async with SessionLocal.begin() as session:
            await remove_demo(session)
            if args.remove:
                print("Демо-сезон удалён. Сделайте текущим нужный сезон в админке.")
                return 0
            message = await create_demo(session, utcnow())
        print(message)
        return 1 if message.startswith("Ошибка") else 0
    finally:
        await engine.dispose()


def main() -> int:
    parser = argparse.ArgumentParser(description="Демонстрационный сезон для показа приложения.")
    parser.add_argument("--live", action="store_true", help="Двигать участников по карте каждую минуту")
    parser.add_argument("--remove", action="store_true", help="Удалить демо-сезон")
    try:
        return asyncio.run(main_async(parser.parse_args()))
    except KeyboardInterrupt:
        return 0


if __name__ == "__main__":
    sys.exit(main())
