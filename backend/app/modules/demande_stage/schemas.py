from datetime import date, datetime
from typing import Dict

from pydantic import BaseModel, EmailStr, Field

from app.modules.document.schemas import DocumentRead
from app.shared.enums import StatutDemandeEnum


class DemandeStageCreateResponse(BaseModel):
    id: int
    message: str


class DemandeStageRead(BaseModel):
    id: int
    nom: str
    prenom: str
    email: EmailStr
    telephone: str
    etablissement: str
    niveau_etude: str
    departement_souhaite: str
    date_debut_souhaitee: date
    date_fin_souhaitee: date
    competences: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    statut: StatutDemandeEnum
    created_at: datetime
    documents: list[DocumentRead]

    class Config:
        from_attributes = True


class DemandeStatusUpdateRequest(BaseModel):
    reason: str | None = None


class DemandeStatusHistoryRead(BaseModel):
    id: int
    demande_id: int
    previous_status: str | None = None
    new_status: str
    reason: str | None = None
    changed_by: int | None = None
    changed_at: datetime

    class Config:
        from_attributes = True


class DemandeStageOptionsRead(BaseModel):
    departements: list[str] = Field(default_factory=list)
    types_stage: list[str] = Field(default_factory=list)
    competences_by_departement: Dict[str, list[str]] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
