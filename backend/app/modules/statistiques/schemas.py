from datetime import datetime

from pydantic import BaseModel


class StatutCount(BaseModel):
    statut: str
    count: int


class DepartementCount(BaseModel):
    departement: str
    count: int


class ActiviteItem(BaseModel):
    id: int
    nom: str
    action: str
    statut: str
    created_at: datetime | None = None


class DashboardTotaux(BaseModel):
    demandes: int
    stagiaires: int
    encadreurs: int
    documents: int
    affectations: int
    projets: int


class DashboardStatsRead(BaseModel):
    totaux: DashboardTotaux
    demandes_par_statut: list[StatutCount]
    affectations_par_statut: list[StatutCount]
    projets_par_statut: list[StatutCount]
    projets_par_departement: list[DepartementCount]
    activite_recente: list[ActiviteItem]


class EncadreurTotaux(BaseModel):
    stages: int
    tasks: int
    tasks_validated: int
    tasks_in_review: int
    evaluations: int


class EncadreurOverviewRead(BaseModel):
    totaux: EncadreurTotaux
