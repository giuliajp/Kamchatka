"""
Официальные результаты — ТОЛЬКО из судейских протоколов.

- Protocol         — протокол этапа по одной дисциплине. Публикуется после каждого этапа.
                     Статус: предварительный → окончательный.
- StageResult      — строка протокола: результат участника на этапе.
- Penalty          — штраф участника за гонку (с причиной и пунктом правил).
- ResultChangeLog  — журнал правок. Каждое изменение результатов и штрафов пишется сюда.

Правила (от заказчика):
- GPS и отметки на КП для официальных результатов НЕ используются.
- Предварительный протокол можно править, но каждая правка — в журнал.
- Окончательный протокол правится только особой процедурой: с основанием, указанием,
  кто утвердил, и видимой пометкой (StageResult.is_corrected_after_final).
- Штрафы относятся к участию в гонке и не распределяются по этапам.
  Общая сумма штрафов вычисляется из записей Penalty.
- Места — внутри дисциплины.
- Участник со статусом DNF/DNS НИКОГДА не удаляется из протокола.
"""
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import (
    CheckConstraint, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import TimestampMixin, str_enum, utcnow
from app.models.enums import ChangeAction, ProtocolStatus, StageResultStatus

if TYPE_CHECKING:
    from app.models.race import Discipline, RaceParticipant
    from app.models.stage import Stage


class Protocol(TimestampMixin, Base):
    __tablename__ = "protocols"
    __table_args__ = (
        UniqueConstraint("stage_id", "discipline_id", name="uq_protocols_stage_discipline"),
        CheckConstraint(
            "status <> 'final' OR finalized_at IS NOT NULL", name="final_has_finalized_at"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    stage_id: Mapped[int] = mapped_column(ForeignKey("stages.id", ondelete="CASCADE"), nullable=False, index=True)
    discipline_id: Mapped[int] = mapped_column(ForeignKey("disciplines.id"), nullable=False, index=True)

    status: Mapped[ProtocolStatus] = mapped_column(
        str_enum(ProtocolStatus), default=ProtocolStatus.PRELIMINARY, nullable=False
    )
    # Пока published_at пусто — протокол — черновик в админке и в приложении не виден.
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    finalized_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    finalized_by: Mapped[Optional[str]] = mapped_column(String(200))

    # Шапка/подвал протокола
    weather: Mapped[Optional[str]] = mapped_column(Text)            # погодные условия
    chief_judge: Mapped[Optional[str]] = mapped_column(String(200))
    chief_secretary: Mapped[Optional[str]] = mapped_column(String(200))
    source_filename: Mapped[Optional[str]] = mapped_column(String(255))  # из какого файла импортирован

    stage: Mapped["Stage"] = relationship(lazy="raise_on_sql")
    discipline: Mapped["Discipline"] = relationship(lazy="raise_on_sql")
    results: Mapped[list["StageResult"]] = relationship(
        lazy="raise_on_sql", back_populates="protocol", cascade="all, delete-orphan"
    )

    @property
    def is_final(self) -> bool:
        return self.status == ProtocolStatus.FINAL

    def __repr__(self) -> str:
        return f"<Protocol stage={self.stage_id} discipline={self.discipline_id} {self.status.value}>"


class StageResult(TimestampMixin, Base):
    """Результат участника на этапе (строка протокола)."""
    __tablename__ = "stage_results"
    __table_args__ = (
        UniqueConstraint("protocol_id", "race_participant_id",
                         name="uq_stage_results_protocol_participant"),
        CheckConstraint("net_time_seconds IS NULL OR net_time_seconds >= 0", name="net_non_negative"),
        # Время есть только у финишировавших.
        CheckConstraint(
            "(status = 'finished') = (final_time_seconds IS NOT NULL)", name="time_only_if_finished"
        ),
        CheckConstraint("dogs_at_start IS NULL OR dogs_at_start > 0", name="dogs_start_positive"),
        CheckConstraint(
            "dogs_at_finish IS NULL OR dogs_at_start IS NULL OR dogs_at_finish <= dogs_at_start",
            name="dogs_finish_le_start",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    protocol_id: Mapped[int] = mapped_column(ForeignKey("protocols.id", ondelete="CASCADE"), nullable=False, index=True)
    race_participant_id: Mapped[int] = mapped_column(
        ForeignKey("race_participants.id", ondelete="CASCADE"), nullable=False, index=True
    )

    status: Mapped[StageResultStatus] = mapped_column(
        str_enum(StageResultStatus), default=StageResultStatus.FINISHED, nullable=False
    )
    net_time_seconds: Mapped[Optional[int]] = mapped_column(Integer)          # без штрафа
    final_time_seconds: Mapped[Optional[int]] = mapped_column(Integer)        # как в протоколе

    # Число собак может уменьшаться от этапа к этапу (правила допускают).
    dogs_at_start: Mapped[Optional[int]] = mapped_column(Integer)
    dogs_at_finish: Mapped[Optional[int]] = mapped_column(Integer)

    # Место в общем зачёте дисциплины ПОСЛЕ этого этапа — как указано в протоколе.
    # Пусто — место вычисляется по сумме времён.
    place: Mapped[Optional[int]] = mapped_column(Integer)
    note: Mapped[Optional[str]] = mapped_column(Text)   # «Примечания» из протокола

    # Пометка для пользователей: результат исправлен после утверждения протокола.
    is_corrected_after_final: Mapped[bool] = mapped_column(default=False, nullable=False)

    protocol: Mapped["Protocol"] = relationship(lazy="raise_on_sql", back_populates="results")
    race_participant: Mapped["RaceParticipant"] = relationship(lazy="raise_on_sql")

    def __repr__(self) -> str:
        return f"<StageResult protocol={self.protocol_id} rp={self.race_participant_id} {self.status.value}>"


class Penalty(TimestampMixin, Base):
    """
    Штраф участника за гонку без привязки к этапу.

    Общая сумма вычисляется по записям Penalty для одного RaceParticipant.
    Пример из протокола 2026: «штр. вр. 2 мин. п. П.14.11.14».
    """
    __tablename__ = "penalties"
    __table_args__ = (CheckConstraint("seconds >= 0", name="seconds_non_negative"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    race_participant_id: Mapped[int] = mapped_column(
        ForeignKey("race_participants.id", ondelete="CASCADE"), nullable=False, index=True
    )
    seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text)
    rule_reference: Mapped[Optional[str]] = mapped_column(String(50))   # «П.14.11.14»

    race_participant: Mapped["RaceParticipant"] = relationship(
        lazy="raise_on_sql", back_populates="penalties"
    )


class ResultChangeLog(Base):
    """
    Журнал правок результатов и штрафов. Записи только добавляются, никогда не меняются.

    Поле entity — что меняли: "stage_result", "penalty", "protocol".
    Правка окончательного протокола (is_post_final=True) обязана иметь основание и утвердившего.
    """
    __tablename__ = "result_change_log"
    __table_args__ = (
        CheckConstraint(
            "NOT is_post_final OR (reason IS NOT NULL AND approved_by IS NOT NULL)",
            name="post_final_requires_basis",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # Протокол храним всегда: по нему смотрят историю. Ссылки на строку — без внешних ключей,
    # чтобы запись журнала пережила удаление строки.
    # Пусто — правка штрафа: штраф относится к гонке, а не к протоколу этапа.
    protocol_id: Mapped[Optional[int]] = mapped_column(ForeignKey("protocols.id", ondelete="CASCADE"), index=True)
    entity: Mapped[str] = mapped_column(String(30), nullable=False)
    entity_id: Mapped[Optional[int]] = mapped_column(Integer)
    race_participant_id: Mapped[Optional[int]] = mapped_column(Integer, index=True)

    action: Mapped[ChangeAction] = mapped_column(str_enum(ChangeAction), nullable=False)
    field: Mapped[Optional[str]] = mapped_column(String(50))     # "net_time_seconds"
    old_value: Mapped[Optional[str]] = mapped_column(Text)
    new_value: Mapped[Optional[str]] = mapped_column(Text)

    changed_by: Mapped[str] = mapped_column(String(200), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text)          # причина / основание

    # Правка после утверждения протокола (особая процедура)
    is_post_final: Mapped[bool] = mapped_column(default=False, nullable=False)
    approved_by: Mapped[Optional[str]] = mapped_column(String(200))

    protocol: Mapped["Protocol"] = relationship(lazy="raise_on_sql")
