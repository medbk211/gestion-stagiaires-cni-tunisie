from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class EvaluationCreate(BaseModel):
    stagiaire_id: int
    projet_id: int
    note: int = Field(..., ge=0, le=20)
    commentaire: str | None = None


class EvaluationUpdate(BaseModel):
    note: int | None = Field(None, ge=0, le=20)
    commentaire: str | None = None


class EvaluationRead(BaseModel):
    id: int
    stagiaire_id: int
    projet_id: int
    encadreur_id: int
    note: int
    commentaire: str | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
