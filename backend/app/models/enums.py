"""
Списки допустимых значений (статусы, типы).

В базе хранятся значения элементов ("upcoming", "dnf"...) — см. str_enum() в base.py.
Эти же значения отдаются в API.
"""
import enum


class RaceStatus(str, enum.Enum):
    """Режим гонки — от него зависит, что показывает приложение."""
    UPCOMING = "upcoming"   # ещё не началась — обратный отсчёт, программа, туристам
    LIVE = "live"           # идёт — живая карта
    FINISHED = "finished"   # завершена — итоги, фотоотчёт, анонс следующего сезона


class StageStatus(str, enum.Enum):
    PLANNED = "planned"
    LIVE = "live"
    FINISHED = "finished"
    CANCELLED = "cancelled"


class RaceParticipantStatus(str, enum.Enum):
    """Статус участника в гонке целиком."""
    REGISTERED = "registered"                   # заявлен, ещё не стартовал
    ACTIVE = "active"                           # продолжает участие
    FINISHED = "finished"                       # завершил гонку
    DNF = "dnf"                                 # сошёл; пройденные этапы сохраняются
    DSQ = "dsq"                                 # дисквалифицирован
    OUT_OF_COMPETITION = "out_of_competition"   # идёт маршрут вне зачёта


class Equipment(str, enum.Enum):
    """Тип снаряжения в дисциплине."""
    SLED = "sled"   # нарта
    SKI = "ski"     # лыжи (скиджоринг)


class CheckpointRole(str, enum.Enum):
    """Роль КП на конкретном этапе."""
    START = "start"
    CHECKPOINT = "checkpoint"
    FINISH = "finish"


class ProtocolStatus(str, enum.Enum):
    PRELIMINARY = "preliminary"   # предварительный — правится, каждая правка в журнал
    FINAL = "final"               # окончательный — правка только особой процедурой


class StageResultStatus(str, enum.Enum):
    """Статус участника на конкретном этапе (как в протоколе)."""
    FINISHED = "finished"
    DNF = "dnf"   # стартовал, но не финишировал
    DNS = "dns"   # не стартовал
    DSQ = "dsq"   # дисквалифицирован на этапе


class ChangeAction(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"


class PositionSource(str, enum.Enum):
    IRIDIUM = "iridium"   # пришло со спутникового трекера
    MANUAL = "manual"     # внесено вручную


class AlertType(str, enum.Enum):
    SOS = "sos"


class ProgramEventType(str, enum.Enum):
    STAGE_START = "stage_start"
    STAGE_FINISH = "stage_finish"
    FESTIVAL = "festival"           # культурная программа
    MASTER_CLASS = "master_class"   # мастер-класс
    MEETING = "meeting"             # встреча (например, вечер каюров)


class LocationType(str, enum.Enum):
    START = "start"
    FINISH = "finish"
    FESTIVAL = "festival"
    VIEWPOINT = "viewpoint"
    CHECKPOINT = "checkpoint"       # КП, куда могут приехать зрители
