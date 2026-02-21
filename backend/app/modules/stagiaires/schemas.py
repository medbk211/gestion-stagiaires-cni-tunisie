from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date, datetime
from app.shared.enums import TypeStageEnum, StatutStageEnum, RoleEnum

# Base schema for Stagiaire specific fields
class StagiaireBase(BaseModel):
    matricule: str
    type_stage: TypeStageEnum
    statut_stage: StatutStageEnum = StatutStageEnum.EN_ATTENTE
    date_debut_stage: date
    date_fin_stage: date
    etablissement: str
    niveau_etude: Optional[str] = None
    encadreur_id: Optional[int] = None

# Schema for creating a Stagiaire (includes User fields)
class StagiaireCreate(StagiaireBase):
    nom: str
    prenom: str
    email: EmailStr
    motDePasse: str

# Schema for updating a Stagiaire
class StagiaireUpdate(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    email: Optional[EmailStr] = None
    matricule: Optional[str] = None
    type_stage: Optional[TypeStageEnum] = None
    statut_stage: Optional[StatutStageEnum] = None
    date_debut_stage: Optional[date] = None
    date_fin_stage: Optional[date] = None
    etablissement: Optional[str] = None
    niveau_etude: Optional[str] = None
    encadreur_id: Optional[int] = None
    note_finale: Optional[int] = None
    date_validation: Optional[datetime] = None
    actif: Optional[bool] = None

# Schema for reading a Stagiaire (response)
class StagiaireRead(StagiaireBase):
    id: int
    nom: str
    prenom: str
    email: EmailStr
    role: RoleEnum
    actif: bool
    dateCreation: datetime
    
    note_finale: Optional[int] = None
    date_validation: Optional[datetime] = None

    class Config:
        from_attributes = True


class StagiaireProfileRead(BaseModel):
    id: int
    nom: str
    prenom: str
    email: EmailStr
    role: RoleEnum
    actif: bool
    etablissement: Optional[str] = None
    niveau_etude: Optional[str] = None
    has_stagiaire_record: bool = True


class StagiaireProfileUpdate(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    email: Optional[EmailStr] = None
    etablissement: Optional[str] = None
    niveau_etude: Optional[str] = None


class StagiaireProgressRead(BaseModel):
    stagiaire_id: int
    stage_id: Optional[int] = None
    tasks_total: int = 0
    tasks_done: int = 0
    tasks_in_progress: int = 0
    tasks_todo: int = 0
    retard: int = 0
    progress_pct: int = 0
    evaluations_count: int = 0
    moyenne_note: Optional[float] = None
