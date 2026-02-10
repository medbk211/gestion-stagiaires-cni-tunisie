from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class EvaluationCreate(BaseModel):
    stagiaire_id: int
    projet_id: int
    note: int = Field(..., ge=0, le=20)
    commentaire: Optional[str] = None


class EvaluationUpdate(BaseModel):
    note: Optional[int] = Field(None, ge=0, le=20)
    commentaire: Optional[str] = None



class EvaluationRead(BaseModel):
    id: int
    stagiaire_id: int
    projet_id: int
    encadreur_id: int
    note: int
    commentaire: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
