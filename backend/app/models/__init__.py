"""
Все модели проекта. Импортируем их здесь, чтобы Alembic
«увидел» все таблицы при создании миграций (см. migrations/env.py).

Описание предметной области — docs/domain.md.

Использование:
    from app.models import Race, RaceParticipant, Protocol
"""
from app.models.admin import AdminUser
from app.models.app_user import AppUser, Bookmark, EventReminder, PushMessage
from app.models.content import (
    FaqItem,
    GuestInfoItem,
    OrganizerContact,
    ProgramEvent,
    SpectatorLocation,
)
from app.models.enums import (
    AlertType,
    ChangeAction,
    CheckpointRole,
    Equipment,
    LocationType,
    PositionSource,
    ProgramEventType,
    ProtocolStatus,
    RaceParticipantStatus,
    RaceStatus,
    StageResultStatus,
    StageStatus,
)
from app.models.protocol import Penalty, Protocol, ResultChangeLog, StageResult
from app.models.race import Discipline, Participant, Race, RaceParticipant
from app.models.stage import (
    Checkpoint,
    CheckpointPass,
    CheckpointPassLog,
    Stage,
    StageCheckpoint,
)
from app.models.support import SupportSubscription
from app.models.tracking import (
    TrackerAlert,
    TrackerAssignment,
    TrackerDevice,
    TrackerPosition,
)

__all__ = [
    # перечисления
    "AlertType", "ChangeAction", "CheckpointRole", "Equipment", "PositionSource",
    "ProtocolStatus", "RaceParticipantStatus", "RaceStatus", "StageResultStatus", "StageStatus",
    # гонка и участники
    "Race", "Discipline", "Participant", "RaceParticipant",
    # маршрут
    "Stage", "Checkpoint", "StageCheckpoint", "CheckpointPass", "CheckpointPassLog",
    # официальные результаты
    "Protocol", "StageResult", "Penalty", "ResultChangeLog",
    # трекинг
    "TrackerDevice", "TrackerAssignment", "TrackerPosition", "TrackerAlert",
    # программа фестиваля и контент для зрителей
    "ProgramEvent", "FaqItem", "SpectatorLocation", "OrganizerContact", "GuestInfoItem",
    "ProgramEventType", "LocationType",
    # админка и болельщики
    "AdminUser", "SupportSubscription", "AppUser", "Bookmark", "PushMessage", "EventReminder",
]
