"""
«Болею за» — подписка пользователя VK на участника гонки.

Отписка не удаляет запись, а ставит cancelled_at. Так можно посчитать, сколько
болельщиков было сутки назад («+12 за сутки»), и строить динамику по дням для админки.
Активная подписка у пары «пользователь — участник» может быть только одна.
"""
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import utcnow

if TYPE_CHECKING:
    from app.models.race import RaceParticipant


class SupportSubscription(Base):
    __tablename__ = "support_subscriptions"
    __table_args__ = (
        Index(
            "uq_support_subscriptions_active", "vk_user_id", "race_participant_id",
            unique=True, postgresql_where=text("cancelled_at IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    vk_user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    race_participant_id: Mapped[int] = mapped_column(
        ForeignKey("race_participants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Присылать push о событиях этого участника (можно выключить, не отписываясь).
    notifications_enabled: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    race_participant: Mapped["RaceParticipant"] = relationship(lazy="raise_on_sql")
