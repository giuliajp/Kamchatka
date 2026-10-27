"""
Схемы ответов для карты: позиции участников и треки (задача 3.1).

Всё здесь — данные GPS-трекеров, НЕ официальные результаты.
Время — UTC, ISO 8601; фронтенд показывает «Положение на 14:32» по местному времени.
"""

from datetime import datetime

from pydantic import BaseModel

from app.schemas.races import DisciplineShort, StageShort


class PointOut(BaseModel):
    latitude: float
    longitude: float
    altitude_m: float | None
    position_at: datetime                 # время точки на трекере (UTC)


class ParticipantPositionOut(BaseModel):
    race_participant_id: int
    participant_id: int
    start_number: int
    full_name: str
    photo_url: str | None
    discipline: DisciplineShort
    position: PointOut | None             # последняя подтверждённая точка; null — точек ещё нет
    previous_position: PointOut | None    # предыдущая (для направления движения)
    is_stale: bool                        # нет новых точек дольше порога — подписать «последняя подтверждённая точка»
    km_on_route: float | None             # км от старта этапа по трассе (оценка по GPS)
    avg_speed_kmh: float | None           # средняя между двумя последними точками
    gps_rank: int | None                  # «позиция по GPS-трекеру» внутри дисциплины
    gap_to_leader_km: float | None


class StagePositions(BaseModel):
    stage: StageShort
    generated_at: datetime                # когда сервер собрал ответ
    tracking_interval_minutes: int        # как часто трекеры передают точки
    stale_after_minutes: int
    route_length_km: float | None
    official_protocol_disciplines: list[str]   # по этим дисциплинам этап закрыт протоколом
    participants: list[ParticipantPositionOut]


class TrackPointOut(PointOut):
    stage_number: int | None


class ParticipantTrack(BaseModel):
    race_participant_id: int
    start_number: int
    full_name: str
    points: list[TrackPointOut]           # по времени, от старых к новым
