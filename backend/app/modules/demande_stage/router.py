from fastapi import APIRouter, Depends, Form, UploadFile, File, status
from pydantic import EmailStr
from sqlalchemy.orm import Session 
from datetime import date

from app.core.database import get_db
from app.modules.demande_stage.schemas import DemandeStageCreateResponse, DemandeStageRead
from app.modules.demande_stage.service import create_demande_with_upload, get_all_demandes_stage
from app.shared.enums import TypeStageEnum
from app.shared.enums import DepartementEnum

router = APIRouter()


@router.post( "/demandes-stage", response_model=DemandeStageCreateResponse)
async def create_demande_stage(
    nom: str = Form(...),
    prenom: str = Form(...),
    email: EmailStr = Form(...),
    telephone: str = Form(...),
    etablissement: str = Form(...),
    niveau_etude: TypeStageEnum = Form(...),
    departement_souhaite: DepartementEnum = Form(...),
    date_debut_souhaitee: date = Form(...),
    date_fin_souhaitee: date = Form(...),

    cv: UploadFile | None = File(None),
    convention: UploadFile| None = File(None),
    lettre: UploadFile | None = File(None),

    db: Session = Depends(get_db)
):
    demande = await create_demande_with_upload(
        db=db,
        nom=nom,
        prenom=prenom,
        email=email,
        telephone=telephone,
        etablissement=etablissement,
        niveau_etude=niveau_etude,
        departement_souhaite=departement_souhaite,
        date_debut_souhaitee=date_debut_souhaitee,
        date_fin_souhaitee=date_fin_souhaitee,
        cv=cv,
        convention=convention,
        lettre=lettre
    )

    return {
        "id": demande.id,
        "message": "Demande créée avec succès"
    }

@router.get("/demandes-stage",response_model=list[DemandeStageRead],status_code=status.HTTP_200_OK)
def read_demandes_stage( db: Session = Depends(get_db)):
    return get_all_demandes_stage(db)

