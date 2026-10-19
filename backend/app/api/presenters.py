"""
Превращение моделей базы в словари для ответов API.
Здесь только «упаковка», без запросов в базу и без расчётов.
"""

from app.models import Discipline, Protocol, Race, Stage
from app.services.standings import (
    DisciplineStanding, StandingRow, format_duration, protocol_is_final,
)


def discipline_short(d: Discipline) -> dict:
    return {"id": d.id, "code": d.code, "name": d.name}


def race_short(race: Race) -> dict:
    return {
        "id": race.id, "name": race.name, "year": race.year, "status": race.status.value,
        "is_current": race.is_current, "start_date": race.start_date,
        "end_date": race.end_date, "location": race.location,
    }


def stage_short(stage: Stage) -> dict:
    return {
        "id": stage.id, "number": stage.number, "name": stage.name,
        "distance_km": stage.distance_km, "start_at": stage.start_at,
        "finish_at": stage.finish_at, "status": stage.status.value,
    }


def standing_row(row: StandingRow, stage_numbers: list[int]) -> dict:
    entry, person = row.entry, row.entry.participant
    penalty_total = sum(p.seconds for p in row.penalties)
    cells = []
    for number in stage_numbers:
        cell = row.cells.get(number)
        cells.append({
            "stage_number": number,
            "status": cell.status.value if cell else None,
            "time_seconds": cell.final_time_seconds if cell else None,
            "time": format_duration(cell.final_time_seconds) if cell else None,
            "dogs_at_start": cell.dogs_at_start if cell else None,
            "dogs_at_finish": cell.dogs_at_finish if cell else None,
            "is_corrected_after_final": bool(cell and cell.is_corrected_after_final),
            "note": cell.note if cell else None,
        })
    return {
        "race_participant_id": entry.id,
        "participant_id": person.id,
        "place": row.place,
        "start_number": entry.start_number,
        "full_name": person.full_name,
        "last_name": person.last_name,
        "first_name": person.first_name,
        "region": entry.region,
        "discipline_code": entry.discipline.code,
        "status": row.status,
        "stages": cells,
        "total_time_seconds": row.total_seconds,
        "total_time": format_duration(row.total_seconds),
        "gap_to_leader_seconds": row.gap_to_leader_seconds,
        "gap_to_leader": format_duration(row.gap_to_leader_seconds),
        "penalties": [
            {"seconds": p.seconds, "time": format_duration(p.seconds),
             "reason": p.reason, "rule_reference": p.rule_reference}
            for p in sorted(row.penalties, key=lambda p: p.id)
        ],
        "penalty_total_seconds": penalty_total,
        "penalty_total": format_duration(penalty_total) if penalty_total else None,
    }


def discipline_results(standing: DisciplineStanding) -> dict:
    numbers = [s.number for s in standing.stages]
    return {
        "discipline": discipline_short(standing.discipline),
        "stages": [
            {
                "id": s.id, "number": s.number, "name": s.name, "distance_km": s.distance_km,
                "protocol_status": standing.protocols[s.number].status.value,
                "is_final": protocol_is_final(standing.protocols[s.number]),
            }
            for s in standing.stages
        ],
        "rows": [standing_row(r, numbers) for r in standing.rows],
    }


def stage_protocol(protocol: Protocol, standing: DisciplineStanding) -> dict:
    numbers = [s.number for s in standing.stages]
    return {
        "discipline": discipline_short(standing.discipline),
        "status": protocol.status.value,
        "is_final": protocol_is_final(protocol),
        "published_at": protocol.published_at,
        "finalized_at": protocol.finalized_at,
        "weather": protocol.weather,
        "chief_judge": protocol.chief_judge,
        "chief_secretary": protocol.chief_secretary,
        "rows": [standing_row(r, numbers) for r in standing.rows],
    }
