from sqlalchemy.orm import Session ,selectinload
from datetime import date
from uuid import uuid4
import os
import shutil

from fastapi import UploadFile, HTTPException
from sqlalchemy.exc import SQLAlchemyError


from app.modules.demande_stage.models import DemandeStage
from app.modules.stage.models import Stage

from app.modules.stagiaires.models import Stagiaire
from app.modules.encadreurs.models import Encadreur
from app.modules.utilisateur.models import Utilisateur
from app.modules.affectations.models import Affectation
from app.modules.projet_stage.models import Projet

from app.modules.document.models import Document
from app.shared.enums import DepartementEnum,DocumentTypeEnum, StatutDemandeEnum, TypeStageEnum,RoleEnum,StatutStageEnum
from app.modules.document.service import validate_file, validate_dates
from app.shared.sending_emails import send_email_with_template
from app.core.security import (
    generate_password,
    hash_password,
    create_access_token,
)
from app.shared.utils import generate_matricule


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
async def accepter_demande(
    demande_id: int,
    encadreur_id: int,
    db: Session
):
    """
    Acceptation d'une demande de stage par l'encadreur.
    ➜ Création automatique du compte stagiaire
    ➜ Création du stage
    ➜ Affectation du stagiaire
    ➜ Envoi email avec mot de passe
    """

    try:
        # ==========================
        # 1️⃣ Récupération des données
        # ==========================
        demande = db.get(DemandeStage, demande_id)
        encadreur = db.get(Encadreur, encadreur_id)

        affectation = (
            db.query(Affectation)
            .filter(Affectation.demande_id == demande_id)
            .first()
        )
        project = db.query(Projet).filter(Projet.id == affectation.projet_id).first() if affectation else None

        if not demande:
            raise HTTPException(404, "Demande de stage introuvable")

        if not encadreur:
            raise HTTPException(404, "Encadreur introuvable")

        if not affectation:
            raise HTTPException(404, "Affectation introuvable")

        # ==========================
        # 2️⃣ Vérification existence utilisateur
        # ==========================
        existing_user = (
            db.query(Utilisateur)
            .filter(Utilisateur.email == demande.email)
            .first()
        )

        if existing_user:
            raise HTTPException(
                400,
                "Un compte utilisateur existe déjà pour cet email"
            )

        # ==========================
        # 3️⃣ Génération des identifiants
        # ==========================
        plain_password = generate_password()
        hashed_password = hash_password(plain_password)
        matricule = generate_matricule(db)

        # ==========================
        # 4️⃣ Création du stagiaire
        # ==========================
        stagiaire = Stagiaire(
            nom=demande.nom,
            prenom=demande.prenom,
            email=demande.email,
            motDePasse=hashed_password,
            role=RoleEnum.STAGIAIRE,
            actif=True,
            emailVerifie=False,
            matricule=matricule,
            type_stage=demande.niveau_etude,
            statut_stage=StatutStageEnum.EN_COURS,
            niveau_etude=demande.niveau_etude,
            date_debut_stage=demande.date_debut_souhaitee,
            date_fin_stage=demande.date_fin_souhaitee,
            etablissement=demande.etablissement,
            encadreur_id=encadreur.id
        )

        db.add(stagiaire)
        db.flush()  # باش نتحصلو على stagiaire.id

        # ==========================
        # 5️⃣ Création du stage
        # ==========================
        stage = Stage(
            demandestage_id=demande.id,
            stagiaire_id=stagiaire.id,
            encadreur_id=encadreur.id,
            projet_id= affectation.projet_id,
            date_debut=demande.date_debut_souhaitee,
            date_fin=demande.date_fin_souhaitee,
            statut_stage=StatutStageEnum.EN_COURS,
            texte_objectif="À définir"
        )

        db.add(stage)

        # ==========================
        # 6️⃣ Mise à jour affectation
        # ==========================
        affectation.stagiaire_id = stagiaire.id

        # ==========================
        # 7️⃣ Commit global
        # ==========================
        db.commit()

        # ==========================
        # 8️⃣ Envoi email
        # ==========================
        await send_email_with_template(
            emails=[demande.email],
            subject="Création de votre compte stagiaire",
            template_name="stagier_created.html",
            body={
                "matricule": project.code_projet,
                "type_stage ": stagiaire.type_stage.value,
                "etablissement": stagiaire.etablissement,
                "date_debut": stagiaire.date_debut_stage.strftime("%d/%m/%Y"),
                "date_fin": stagiaire.date_fin_stage.strftime("%d/%m/%Y"),
                "nom": demande.nom,
                "prenom": demande.prenom,
                "email": demande.email,
                "password": plain_password
            }
        )

        return {
            "message": "Demande acceptée avec succès",
            "stagiaire_id": stagiaire.id,
            "email": stagiaire.email
        }

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(
            500,
            "Erreur interne lors de la création du stagiaire"
        )
