"""
Карточка спортсмена: данные и участие в гонках по годам (задача 2.3).
Подключено в app/main.py с префиксом /api.

Год рождения в публичный API не отдаём — для карточки он не нужен (152-ФЗ: меньше лишних данных).
"""

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep
from app.api.presenters import discipline_short, race_short
from app.models import Participant, RaceParticipant
from app.schemas.common import ApiResponse, ok
from app.schemas.races import ParticipantDetail
from app.services.standings import build_standings, format_duration

router = APIRouter(tags=["Участники"])


@router.get("/participants/{participant_id}", response_model=ApiResponse[ParticipantDetail],
            summary="Карточка участника и его гонки по годам")
async def get_participant(participant_id: int, session: SessionDep):
    person = (await session.execute(
        select(Participant).where(Participant.id == participant_id).options(
            selectinload(Participant.race_entries).selectinload(RaceParticipant.race),
            selectinload(Participant.race_entries).selectinload(RaceParticipant.discipline),
            selectinload(Participant.race_entries).selectinload(RaceParticipant.penalties),
        )
    )).scalar_one_or_none()
    if person is None:
        raise HTTPException(status_code=404, detail="Участник не найден")

    races = []
    for entry in sorted(person.race_entries, key=lambda e: e.race.year, reverse=True):
        standings = await build_standings(session, entry.race_id,
                                          discipline_code=entry.discipline.code)
        row = next(r for s in standings for r in s.rows if r.entry.id == entry.id)
        races.append({
            "race": race_short(entry.race),
            "race_participant_id": entry.id,
            "start_number": entry.start_number,
            "region": entry.region,
            "discipline": discipline_short(entry.discipline),
            "dogs_count": entry.dogs_count,
            "dog_breed": entry.dog_breed,
            "status": row.status,
            "place": row.place,
            "total_time_seconds": row.total_seconds,
            "total_time": format_duration(row.total_seconds),
            "gap_to_leader_seconds": row.gap_to_leader_seconds,
            "penalty_total_seconds": sum(p.seconds for p in entry.penalties),
            "penalties": [{"seconds": p.seconds, "time": format_duration(p.seconds), "reason": p.reason,
                           "rule_reference": p.rule_reference} for p in entry.penalties],
        })

    return ok({
        "id": person.id,
        "full_name": person.full_name,
        "last_name": person.last_name,
        "first_name": person.first_name,
        "middle_name": person.middle_name,
        "photo_url": person.photo_url,
        "bio": person.bio,
        "races": races,
    })
