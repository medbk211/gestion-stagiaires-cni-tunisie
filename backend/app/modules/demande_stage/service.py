from sqlalchemy.orm import Session ,selectinload
from datetime import date
from uuid import uuid4
import os
import shutil

from fastapi import UploadFile, HTTPException

from app.modules.demande_stage.models import DemandeStage
from app.modules.document.models import Document
from app.shared.enums import TypeStageEnum
from app.shared.enums import DepartementEnum,DocumentTypeEnum
from app.modules.document.service import validate_file, validate_dates
from app.shared.sending_emails import send_email_with_template


async def create_demande_with_upload(
    db: Session,
    nom: str,
    prenom: str,
    email: str,
    telephone: str,
    etablissement: str,
    niveau_etude: TypeStageEnum,
    departement_souhaite: DepartementEnum,
    date_debut_souhaitee: date,
    date_fin_souhaitee: date,
    cv: UploadFile,
    convention: UploadFile,
    lettre: UploadFile | None = None
):
    # 1️⃣ validations dates
    validate_dates(date_debut_souhaitee, date_fin_souhaitee)

    # 2️⃣ check duplicate email
    existing = db.query(DemandeStage).filter(
        DemandeStage.email == email
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Une demande avec cet email existe déjà"
        )

    try:
        # 3️⃣ create demande
        demande = DemandeStage(
            nom=nom,
            prenom=prenom,
            email=email,
            telephone=telephone,
            etablissement=etablissement,
            niveau_etude=niveau_etude,
            departement_souhaite=departement_souhaite,
            date_debut_souhaitee=date_debut_souhaitee,
            date_fin_souhaitee=date_fin_souhaitee
        )

        db.add(demande)
        db.flush() 

        # 4️⃣ upload directory
        upload_dir = f"uploads/demandes/{demande.id}"
        os.makedirs(upload_dir, exist_ok=True)

        files = {
            DocumentTypeEnum.CV: cv,
            DocumentTypeEnum.CONVOCATION: convention, 
            DocumentTypeEnum.LETTRE: lettre
        }

        # 5️⃣ save files + DB
        for doc_type, file in files.items():
            if file is None:
                continue

            validate_file(file)

            filename = f"{doc_type.value}_{uuid4()}.pdf"
            path = os.path.join(upload_dir, filename)

            with open(path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            db.add(Document(
                demande_id=demande.id,
                type=doc_type,
                file_path=path
            ))

        db.commit()
        db.refresh(demande)

        email_sent = await send_email_with_template(
            emails=[email],
            subject="Confirmation de votre demande de stage - CNI",
            template_name="demande_created.html",
            body={
                "prenom": prenom,
                "nom": nom,
                "demande_id": demande.id,
                "year": "2026"
            }
        )
        if not email_sent:
            
            return {
                "message": "Demande créée ✅ لكن email فشل ❌",
                "demande_id": demande.id
            }

        return demande  

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Erreur lors de la création de la demande"
        )
def get_all_demandes_stage(db: Session):
    return (
        db.query(DemandeStage)
        .options(selectinload(DemandeStage.documents))
        .order_by(DemandeStage.created_at.desc())
        .all()
    )