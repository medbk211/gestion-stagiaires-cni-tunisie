from pydantic import BaseModel, Field
from typing import Dict, List, Optional
from app.shared.enums import DepartementEnum, TypeStageEnum, NiveauEnum, ProjetStatusEnum
from datetime import datetime

# ---------------- Create ----------------
class ProjetStageCreate(BaseModel):
    intitule: str
    departement: DepartementEnum
    type_stage: TypeStageEnum

    description: str
    objectifs: str
    livrables: str

    duree_semaines: int = 4
    charge_hebdo: int = 20

    niveau_requis: NiveauEnum
    competences: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)

    complexite: int 
    priorite: int 
    nombre_max_stagiaires: int 

# ---------------- Read ----------------
class ProjetStageRead(BaseModel):
    id: int
    code_projet: str
    intitule: str
    departement: DepartementEnum
    type_stage: TypeStageEnum

    description: str
    objectifs: str
    livrables: str
    fiche_pdf_path: Optional[str] = None

    duree_semaines: int
    charge_hebdo: int

    niveau_requis: NiveauEnum
    competences: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)

    complexite: int
    priorite: int
    status: ProjetStatusEnum
    encadreur_id: Optional[int]=None
    nombre_max_stagiaires: int

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ---------------- Update ----------------
class ProjetStageUpdate(BaseModel):
    intitule: Optional[str]
    departement: Optional[DepartementEnum]
    type_stage: Optional[TypeStageEnum]

    description: Optional[str]
    objectifs: Optional[str]
    livrables: Optional[str]
    fiche_pdf_path: Optional[str]

    duree_semaines: Optional[int]
    charge_hebdo: Optional[int]

    niveau_requis: Optional[NiveauEnum]
    competences: Optional[List[str]]  # ["Python", "SQL"]
    tags: Optional[List[str]]

    complexite: Optional[int]
    priorite: Optional[int]
    status: Optional[ProjetStatusEnum]
    encadreur_id: Optional[int]
    nombre_max_stagiaires: Optional[int]

    class Config:
        from_attributes = True


class ProjetStageOptionsRead(BaseModel):
    competences_by_departement: Dict[str, List[str]]
    tags: List[str] = Field(default_factory=list)
