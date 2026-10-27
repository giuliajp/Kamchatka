"""
Этап: маршрут с КП и профилем высот (задача 2.4), протоколы этапа (задача 2.5).
Подключено в app/main.py с префиксом /api.
"""

from fastapi import APIRouter, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep
from app.api.presenters import stage_protocol, stage_short
from app.models import Stage, StageCheckpoint
from app.schemas.common import ApiResponse, ok
from app.schemas.races import StageDetail, StageProtocols
from app.services.route_profile import elevation_profile
from app.services.standings import build_standings

router = APIRouter(tags=["Этапы"])


@router.get("/stages/{stage_id}", response_model=ApiResponse[StageDetail],
            summary="Этап: КП по порядку, километраж, трек, профиль высот")
async def get_stage(stage_id: int, session: SessionDep):
    stage = (await session.execute(
        select(Stage).where(Stage.id == stage_id).options(
            selectinload(Stage.stage_checkpoints).selectinload(StageCheckpoint.checkpoint)
        )
    )).scalar_one_or_none()
    if stage is None:
        raise HTTPException(status_code=404, detail="Этап не найден")

    return ok({
        **stage_short(stage),
        "race_id": stage.race_id,
        "description": stage.description,
        "checkpoints": [
            {
                "id": sc.id, "order_index": sc.order_index, "role": sc.role.value,
                "label": sc.label, "name": sc.checkpoint.name,
                "latitude": sc.checkpoint.latitude, "longitude": sc.checkpoint.longitude,
                "elevation_m": sc.checkpoint.elevation_m, "km_from_start": sc.km_from_start,
                "required_rest_minutes": sc.required_rest_minutes,
                "segment_description": sc.segment_description,
            }
            for sc in stage.stage_checkpoints
        ],
        "route_geojson": stage.route_geojson,
        "route_updated_at": stage.route_updated_at,
        "elevation_profile": elevation_profile(stage.route_geojson),
    })


@router.get("/stages/{stage_id}/protocols", response_model=ApiResponse[StageProtocols],
            summary="Протоколы этапа по дисциплинам (только опубликованные)")
async def stage_protocols(stage_id: int, session: SessionDep):
    stage = await session.get(Stage, stage_id)
    if stage is None:
        raise HTTPException(status_code=404, detail="Этап не найден")

    standings = await build_standings(session, stage.race_id, up_to_stage=stage.number)
    protocols = [
        stage_protocol(s.protocols[stage.number], s)
        for s in standings if stage.number in s.protocols
    ]
    return ok({"stage": stage_short(stage), "race_id": stage.race_id, "protocols": protocols})
