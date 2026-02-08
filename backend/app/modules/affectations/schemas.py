from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from app.modules.affectations.models import StatutAffectationEnum
from app.modules.demande_stage.schemas import DemandeStageRead
from app.modules.projet_stage.schemas import ProjetStageRead
from app.modules.encadreurs.schemas import EncadreurResponseSchema
from app.modules.stagiaires.schemas import StagiaireRead


class ProjetProposeResponse(BaseModel):
    projet_id: int
    intitule: str
    score: int


class ChoixProjetRequest(BaseModel):
    token: str
    projet_id: int


class AssignEncadreurRequest(BaseModel):
    demande_id: int
    encadreur_id: int


# ============ Affectation Schemas ============

class AffectationCreate(BaseModel):
    demande_id: int
    projet_id: int
    encadreur_id: int
    stagiaire_id: Optional[int] = None
    date_debut_prevue: Optional[datetime] = None
    date_fin_prevue: Optional[datetime] = None

    class Config:
        from_attributes = True


class AffectationUpdate(BaseModel):
    statut: Optional[StatutAffectationEnum] = None
    stagiaire_id: Optional[int] = None
    date_debut_prevue: Optional[datetime] = None
    date_fin_prevue: Optional[datetime] = None

    class Config:
        from_attributes = True


class AffectationRead(BaseModel):
    id: int
    demande_id: int
    projet_id: int
    encadreur_id: int
    stagiaire_id: Optional[int]
    statut: StatutAffectationEnum
    date_affectation: datetime
    date_debut_prevue: Optional[datetime]
    date_fin_prevue: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AffectationReadDetailed(BaseModel):
    """Affectation with full related objects"""
    id: int
    demande: DemandeStageRead
    projet: ProjetStageRead
    encadreur: EncadreurResponseSchema
    stagiaire: Optional[StagiaireRead] = None
    statut: StatutAffectationEnum
    date_affectation: datetime
    date_debut_prevue: Optional[datetime]
    date_fin_prevue: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
