from pydantic import BaseModel, Field, ConfigDict, field_validator
from datetime import datetime
from typing import Literal, Optional
from app.shared.enums import taskStatusEnum, taskPriorityEnum

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: taskPriorityEnum = taskPriorityEnum.MEDIUM
    deadline: Optional[datetime] = None
    project_id: int = Field(alias="projet_id")

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )

class TaskCreate(TaskBase):
    stage_id: int
    encadreur_id: int

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[taskPriorityEnum] = None
    deadline: Optional[datetime] = None

class TaskStatusUpdate(BaseModel):
    status: taskStatusEnum


class TaskSubmissionCreate(BaseModel):
    github_url: str
    file_url: str
    content: Optional[str] = None

    @field_validator("github_url")
    @classmethod
    def validate_github_url(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Lien GitHub obligatoire")
        lowered = cleaned.lower()
        if not lowered.startswith("http://") and not lowered.startswith("https://"):
            raise ValueError("Lien GitHub invalide")
        if "github.com" not in lowered:
            raise ValueError("Le lien doit pointer vers GitHub")
        return cleaned

    @field_validator("file_url")
    @classmethod
    def validate_file_url(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Lien du fichier obligatoire")
        lowered = cleaned.lower()
        if not lowered.startswith("http://") and not lowered.startswith("https://"):
            raise ValueError("Lien du fichier invalide")
        return cleaned


class TaskReviewDecision(BaseModel):
    decision: Literal["approved", "changes_requested"]
    feedback: Optional[str] = None


class TaskSubmissionRead(BaseModel):
    id: int
    task_id: int
    stagiaire_id: int
    github_url: str
    file_url: str
    notes: Optional[str] = None
    decision: Optional[str] = None
    review_feedback: Optional[str] = None
    submitted_at: datetime
    reviewed_at: Optional[datetime] = None


class TaskRead(TaskBase):
    id: int
    stage_id: int
    status: taskStatusEnum
    created_at: datetime
    updated_at: datetime
