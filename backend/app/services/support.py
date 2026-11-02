"""
Счётчики «Болею за» (бриф, экраны 3 и 4; рейтинг народной поддержки).

Число болельщиков на момент T — подписки, созданные не позже T и не отменённые к T.
«За сутки» — разница между «сейчас» и «24 часа назад».
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import RaceParticipant, SupportSubscription


def _active_at(moment: datetime):
    return and_(
        SupportSubscription.created_at <= moment,
        or_(SupportSubscription.cancelled_at.is_(None), SupportSubscription.cancelled_at > moment),
    )


async def counts_at(session: AsyncSession, moment: datetime, *, race_id: int | None = None,
                    entry_ids: list[int] | None = None) -> dict[int, int]:
    """{race_participant_id: число болельщиков на момент moment}."""
    stmt = (
        select(SupportSubscription.race_participant_id, func.count())
        .where(_active_at(moment))
        .group_by(SupportSubscription.race_participant_id)
    )
    if race_id is not None:
        stmt = stmt.join(RaceParticipant, RaceParticipant.id == SupportSubscription.race_participant_id) \
            .where(RaceParticipant.race_id == race_id)
    if entry_ids is not None:
        stmt = stmt.where(SupportSubscription.race_participant_id.in_(entry_ids or [0]))
    return dict((await session.execute(stmt)).all())


async def counts_with_change(session: AsyncSession, *, race_id: int | None = None,
                             entry_ids: list[int] | None = None,
                             now: datetime | None = None) -> dict[int, tuple[int, int]]:
    """{race_participant_id: (сейчас, изменение за 24 часа)} — только у кого есть данные."""
    now = now or datetime.now(timezone.utc)
    current = await counts_at(session, now, race_id=race_id, entry_ids=entry_ids)
    before = await counts_at(session, now - timedelta(hours=24), race_id=race_id, entry_ids=entry_ids)
    return {i: (current.get(i, 0), current.get(i, 0) - before.get(i, 0))
            for i in set(current) | set(before)}
