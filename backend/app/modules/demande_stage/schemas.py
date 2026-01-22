from datetime import date, datetime
from pydantic import BaseModel, EmailStr
from app.shared.enums import StatutDemandeEnum
from app.modules.document.schemas import DocumentRead


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
    statut: StatutDemandeEnum
    created_at: datetime
    documents: list[DocumentRead]

    class Config:
        from_attributes = True
