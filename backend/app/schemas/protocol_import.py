"""Проверка основных сущностей и полного JSON-протокола перед импортом."""

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import StageResultStatus

PositiveInt = Annotated[int, Field(strict=True, gt=0)]
TimeSeconds = Annotated[int, Field(strict=True, gt=0, le=2_147_483_647)]
SourceResult = Annotated[
    str, Field(pattern=r"^(?:\d{2,}:[0-5]\d:[0-5]\d|DNF|DNS|DSQ)$")
]


class ImportData(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")


class RaceImportData(ImportData):
    name: str = Field(min_length=1, max_length=200)
    year: PositiveInt = Field(le=9999)
    start_date: date
    end_date: date
    location: str = Field(min_length=1, max_length=200)

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def parse_date(cls, value: object) -> date:
        if not isinstance(value, str):
            raise ValueError("Ожидается дата в формате YYYY-MM-DD")
        parsed = date.fromisoformat(value)
        if parsed.isoformat() != value:
            raise ValueError("Ожидается дата в формате YYYY-MM-DD")
        return parsed

    @model_validator(mode="after")
    def check_dates(self) -> "RaceImportData":
        if self.end_date < self.start_date:
            raise ValueError("Дата окончания гонки раньше даты начала")
        if self.start_date.year != self.year or self.end_date.year != self.year:
            raise ValueError("Даты гонки не соответствуют её году")
        return self


class StageImportData(ImportData):
    number: PositiveInt
    distance_km: float = Field(strict=True, gt=0, allow_inf_nan=False)


class StageResultImportData(ImportData):
    stage_number: PositiveInt
    status: StageResultStatus | None


class SummaryImportData(ImportData):
    status: StageResultStatus


class ParticipantImportData(ImportData):
    start_number: PositiveInt
    full_name: str
    birth_year: PositiveInt = Field(le=9999)
    region: str = Field(min_length=1, max_length=200)
    discipline_code: Literal["ski_2", "sled_8", "sled_8plus"]
    summary: SummaryImportData
    stage_results: list[StageResultImportData] = Field(min_length=1)

    @field_validator("full_name")
    @classmethod
    def normalize_full_name(cls, value: str) -> str:
        parts = value.split()
        if len(parts) not in (2, 3) or any(len(part) > 100 for part in parts):
            raise ValueError(
                "Ожидается Фамилия Имя [Отчество], до 100 символов в каждой части"
            )
        return " ".join(parts)

    @property
    def name_parts(self) -> tuple[str, str, str | None]:
        parts = self.full_name.split()
        return parts[0], parts[1], parts[2] if len(parts) == 3 else None


class ProtocolImportData(ImportData):
    """Поля для подготовки гонки, этапов и участий перед переносом результатов."""

    race: RaceImportData
    stages: list[StageImportData] = Field(min_length=1)
    participants: list[ParticipantImportData] = Field(min_length=1)

    @model_validator(mode="after")
    def check_participants_and_stages(self) -> "ProtocolImportData":
        stage_numbers = [stage.number for stage in self.stages]
        if len(stage_numbers) != len(set(stage_numbers)):
            raise ValueError("Повторяются номера этапов")
        seen_numbers = set()
        seen_people = set()
        for participant in self.participants:
            number = participant.start_number
            if number in seen_numbers:
                raise ValueError(f"Повторяется стартовый номер: {number}")
            seen_numbers.add(number)
            identity = (participant.full_name.casefold(), participant.birth_year)
            if identity in seen_people:
                raise ValueError(f"Участник №{number}: повторяются ФИО и год рождения")
            seen_people.add(identity)
            if participant.birth_year > self.race.year:
                raise ValueError(f"Участник №{number}: год рождения позже года гонки")
            result_numbers = sorted(
                result.stage_number for result in participant.stage_results
            )
            if result_numbers != sorted(stage_numbers):
                raise ValueError(
                    f"Участник №{number}: результаты не соответствуют этапам гонки"
                )
        return self


def _check_source_result(
    raw_result: str,
    status: StageResultStatus | None,
    seconds: int | None,
) -> None:
    if raw_result in ("DNF", "DNS", "DSQ"):
        expected_status = StageResultStatus(raw_result.lower())
        expected_seconds = None
    else:
        hours, minutes, remaining_seconds = map(int, raw_result.split(":"))
        duration = hours * 3600 + minutes * 60 + remaining_seconds
        expected_status = StageResultStatus.FINISHED if duration else None
        expected_seconds = duration or None
    if status != expected_status or seconds != expected_seconds:
        raise ValueError("Статус и время не соответствуют исходному результату")


class CompleteStageResultImportData(StageResultImportData):
    raw_result: SourceResult
    final_time_seconds: TimeSeconds | None
    warning: str | None

    @model_validator(mode="after")
    def check_result(self) -> "CompleteStageResultImportData":
        _check_source_result(self.raw_result, self.status, self.final_time_seconds)
        return self


class CompleteSummaryImportData(SummaryImportData):
    raw_result: SourceResult
    total_time_seconds: TimeSeconds | None
    total_penalty_seconds: Annotated[int, Field(strict=True, ge=0)]
    source_place: PositiveInt | None
    raw_note: str

    @model_validator(mode="after")
    def check_summary(self) -> "CompleteSummaryImportData":
        _check_source_result(self.raw_result, self.status, self.total_time_seconds)
        if self.status == StageResultStatus.FINISHED and self.source_place is None:
            raise ValueError("Не указано место финишировавшего участника")
        return self


class PenaltyImportData(ImportData):
    seconds: TimeSeconds
    rule_reference: str = Field(min_length=1, max_length=50)
    stage_number: None
    raw_note: str = Field(min_length=1)


class CompleteParticipantImportData(ParticipantImportData):
    summary: CompleteSummaryImportData
    stage_results: list[CompleteStageResultImportData] = Field(min_length=1)
    penalties: list[PenaltyImportData]
    penalty_warnings: list[str]

    @model_validator(mode="after")
    def check_results_and_penalties(self) -> "CompleteParticipantImportData":
        context = f"Участник №{self.start_number}"
        if self.penalty_warnings:
            raise ValueError(f"{context}: примечание о штрафе требует проверки")
        has_dnf_or_dns = False
        for result in sorted(self.stage_results, key=lambda item: item.stage_number):
            if result.warning is not None:
                raise ValueError(
                    f"{context}, этап {result.stage_number}: результат требует проверки"
                )
            if result.status is None and not has_dnf_or_dns:
                raise ValueError(
                    f"{context}, этап {result.stage_number}: "
                    "пустой результат без предшествующего DNF/DNS"
                )
            if result.status in (StageResultStatus.DNF, StageResultStatus.DNS):
                has_dnf_or_dns = True
        if self.summary.status == StageResultStatus.FINISHED:
            if any(r.status != StageResultStatus.FINISHED for r in self.stage_results):
                raise ValueError(f"{context}: завершены не все этапы")
            total = sum(result.final_time_seconds for result in self.stage_results)
            if self.summary.total_time_seconds != total:
                raise ValueError(f"{context}: общий результат не равен сумме этапов")
        if self.summary.total_penalty_seconds != sum(p.seconds for p in self.penalties):
            raise ValueError(f"{context}: общая сумма штрафов не совпадает со списком")
        if any(p.raw_note != self.summary.raw_note for p in self.penalties):
            raise ValueError(
                f"{context}: примечание штрафа не совпадает с общим итогом"
            )
        return self


class ProtocolMetadataImportData(ImportData):
    weather: str | None = Field(default=None, min_length=1)
    chief_judge: str | None = Field(default=None, min_length=1, max_length=200)
    chief_secretary: str | None = Field(default=None, min_length=1, max_length=200)

    @property
    def warnings(self) -> list[str]:
        labels = {
            "weather": "Погодные условия",
            "chief_judge": "Главный судья",
            "chief_secretary": "Главный секретарь",
        }
        return [
            f"В протоколе не найдено поле: {label}"
            for field, label in labels.items()
            if getattr(self, field) is None
        ]


class CompleteProtocolImportData(ProtocolImportData):
    """Полный документ; проверяется до создания любых записей в БД."""

    source_filename: str = Field(min_length=1, max_length=255)
    protocol_metadata: ProtocolMetadataImportData
    participants: list[CompleteParticipantImportData] = Field(min_length=1)
    warnings: list[str]

    @field_validator("source_filename")
    @classmethod
    def check_source_filename(cls, value: str) -> str:
        if "/" in value or "\\" in value or value in (".", ".."):
            raise ValueError("Ожидается имя исходного PDF без пути")
        return value

    @model_validator(mode="after")
    def check_warnings(self) -> "CompleteProtocolImportData":
        allowed = set(self.protocol_metadata.warnings)
        for warning in self.warnings:
            if warning not in allowed:
                raise ValueError(
                    f"Предупреждение требует проверки перед импортом: {warning}"
                )
        return self
