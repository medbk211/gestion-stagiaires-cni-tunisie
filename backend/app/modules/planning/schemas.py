from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.shared.enums import planningEventTypeEnum, taskPriorityEnum, taskStatusEnum


class PlanningEventBase(BaseModel):
    title: str
    description: Optional[str] = None
    event_type: planningEventTypeEnum = planningEventTypeEnum.MEETING
    priority: taskPriorityEnum = taskPriorityEnum.MEDIUM
    attendee_name: Optional[str] = None
    location: Optional[str] = None
    start_at: datetime
    end_at: Optional[datetime] = None
    stagiaire_id: Optional[int] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Le titre est obligatoire")
        return cleaned

    @field_validator("description", "attendee_name", "location")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @model_validator(mode="after")
    def validate_event_range(self):
        if self.end_at is not None and self.end_at <= self.start_at:
            raise ValueError("La date de fin doit etre apres la date de debut")
        return self

    model_config = ConfigDict(from_attributes=True)


class PlanningEventCreate(PlanningEventBase):
    pass


class PlanningEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[planningEventTypeEnum] = None
    priority: Optional[taskPriorityEnum] = None
    attendee_name: Optional[str] = None
    location: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    stagiaire_id: Optional[int] = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Le titre est obligatoire")
        return cleaned

    @field_validator("description", "attendee_name", "location")
    @classmethod
    def normalize_optional_text(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @model_validator(mode="after")
    def validate_event_range(self):
        if self.start_at is not None and self.end_at is not None and self.end_at <= self.start_at:
            raise ValueError("La date de fin doit etre apres la date de debut")
        return self


class PlanningEventRead(PlanningEventBase):
    id: int
    encadreur_id: int
    created_at: datetime
    updated_at: datetime


class PlanningDeadlineRead(BaseModel):
    task_id: int
    title: str
    deadline: datetime
    priority: taskPriorityEnum
    status: taskStatusEnum
    stagiaire_id: Optional[int] = None
    stagiaire_nom_complet: Optional[str] = None
    stage_id: int


class PlanningWeekOverview(BaseModel):
    week_start: date
    week_end: date
    events: list[PlanningEventRead]
    deadlines: list[PlanningDeadlineRead]
