"""Проверка данных гонки и участников перед подготовкой импорта протокола."""

from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import StageResultStatus

PositiveInt = Annotated[int, Field(strict=True, gt=0)]


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
