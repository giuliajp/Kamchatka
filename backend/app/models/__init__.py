"""
Все модели проекта. Импортируем их здесь, чтобы Flask-Migrate
«увидел» все таблицы при создании миграций.

Использование в коде:
    from app.models import Participant, Entry
"""
from app.models.enums import (
    AlertType, CheckpointType, EntryStatus, PositionSource, SeasonStatus,
)
from app.models.season import Season
from app.models.participant import Discipline, Entry, Participant
from app.models.stage import Checkpoint, Stage
from app.models.results import CheckpointMark, Penalty
from app.models.tracking import Tracker, TrackerAlert, TrackerAssignment, TrackerPosition

__all__ = [
    "AlertType", "CheckpointType", "EntryStatus", "PositionSource", "SeasonStatus",
    "Season",
    "Discipline", "Participant", "Entry",
    "Stage", "Checkpoint",
    "CheckpointMark", "Penalty",
    "Tracker", "TrackerAssignment", "TrackerPosition", "TrackerAlert",
]
