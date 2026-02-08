from pydantic import BaseModel
from datetime import date
from typing import Optional
from app.shared.enums import StatutStageEnum

class StageBase(BaseModel):
    date_debut: date
    date_fin: date
    texte_objectif: str

class StageCreate(StageBase):
    demandestage_id: int
    stagiaire_id: int
    encadreur_id: int
    projet_id: Optional[int] = None

class StageUpdate(BaseModel):
    date_debut: Optional[date] = None
    date_fin: Optional[date] = None
    texte_objectif: Optional[str] = None
    statut_stage: Optional[StatutStageEnum] = None
    encadreur_id: Optional[int] = None
    projet_id: Optional[int] = None

class StageRead(StageBase):
    id: int
    statut_stage: StatutStageEnum
    stagiaire_id: int
    encadreur_id: int
    projet_id: Optional[int] = None

    class Config:
        orm_mode = True
