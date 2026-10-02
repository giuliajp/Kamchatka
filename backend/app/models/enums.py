"""
Списки допустимых значений (статусы, типы).

В базе хранятся строки ("live", "finished"...), поэтому одинаково работает
и в SQLite, и в PostgreSQL.
"""
import enum


class SeasonStatus(str, enum.Enum):
    """Режим приложения: от него зависит, что видит пользователь."""
    UPCOMING = "upcoming"   # гонка ещё не началась — обратный отсчёт
    LIVE = "live"           # идёт гонка — живая карта
    FINISHED = "finished"   # гонка завершена — итоги, фотоотчёт


class EntryStatus(str, enum.Enum):
    """Статус участника в гонке (меняет организатор в админке)."""
    REGISTERED = "registered"       # заявлен, ещё не стартовал
    RACING = "racing"               # на трассе
    RESTING = "resting"             # на отдыхе / обязательной остановке
    FINISHED = "finished"           # финишировал
    SCRATCHED = "scratched"         # сошёл с дистанции
    DISQUALIFIED = "disqualified"   # дисквалифицирован


class CheckpointType(str, enum.Enum):
    START = "start"           # старт этапа
    CHECKPOINT = "checkpoint" # обычный контрольный пункт
    REST = "rest"             # КП с обязательной остановкой
    FINISH = "finish"         # финиш этапа


class PositionSource(str, enum.Enum):
    IRIDIUM = "iridium"   # пришло со спутникового трекера
    MANUAL = "manual"     # внесено вручную (например, по звонку судьи)


class AlertType(str, enum.Enum):
    SOS = "sos"
