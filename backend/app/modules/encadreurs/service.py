from sqlalchemy.orm import Session
from app.modules.encadreurs.models import Encadreur
from app.modules.demande_stage.models import DemandeStage
from app.modules.encadreurs.schemas import EncadreurCreateSchema, EncadreurUpdateSchema
from app.modules.utilisateur.models import Utilisateur
from app.modules.stagiaires.models import Stagiaire
from app.modules.auth.models import ResetMotDePasse
from app.shared.sending_emails import send_email_with_template
from app.shared.enums import RoleEnum, StatutDemandeEnum, StatutStageEnum
from app.shared.utils import generate_matricule
from fastapi import HTTPException

from app.core.security import (
    generate_password,
    hash_password,
)
from fastapi.responses import JSONResponse


async def create_encadreur_by_admin(
    db: Session,
    data: EncadreurCreateSchema
):
    plain_password = generate_password()
    hashed_password = hash_password(plain_password)

    encadreur = Encadreur(
        nom=data.nom,
        prenom=data.prenom,
        email=data.email,
        motDePasse=hashed_password,
        role=RoleEnum.ENCADREUR,
        matricule=data.matricule,
        grade=data.grade,
        departement=data.departement,
        actif_encadrement=data.actif_encadrement,
        is_active=False,
    )

    db.add(encadreur)
    db.commit()
    db.refresh(encadreur)

    email_sent = await send_email_with_template(
        emails=[data.email],
        body={
            "nom": data.nom,
            "prenom": data.prenom,
            "email": data.email,
            "password": plain_password
        },
        subject="Votre compte Encadreur - CNI",
        template_name="encadreur_created.html"
    )

    if not email_sent:
        return JSONResponse(
            status_code=500,
            content={"message": "Encadreur créé لكن الإيميل فشل"}
        )

    return JSONResponse(
        status_code=201,
        content={
            "message": "Encadreur créé والإيميل تبعث ✅",
            "encadreur_id": encadreur.id
        }
    )




def get_all_encadreurs(db: Session):
    return db.query(Encadreur).all()


def get_encadreur_by_id(db: Session, encadreur_id: int):
    return db.query(Encadreur).filter(Encadreur.id == encadreur_id).first()


def update_encadreur(db: Session, encadreur_id: int, data: EncadreurUpdateSchema):
    encadreur = get_encadreur_by_id(db, encadreur_id)
    if not encadreur:
        return None

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(encadreur, key, value)

    db.commit()
    db.refresh(encadreur)
    return encadreur


def delete_encadreur(db: Session, encadreur_id: int):
    encadreur = get_encadreur_by_id(db, encadreur_id)
    if not encadreur:
        return False

    db.delete(encadreur)
    db.commit()
    return True


def get_available_encadreurs(db: Session):
    return db.query(Encadreur).filter(Encadreur.is_active == True).all()


def get_stagiaires_for_encadreur(db: Session, encadreur_id: int):
    from app.modules.affectations.models import Affectation

    # Source 1: lien direct sur la table stagiaires
    direct_stagiaires = (
        db.query(Stagiaire)
        .filter(Stagiaire.encadreur_id == encadreur_id)
        .all()
    )

    # Source 2: stagiaires reliés via la table affectations
    affectation_stagiaires = (
        db.query(Stagiaire)
        .join(Affectation, Affectation.stagiaire_id == Stagiaire.id)
        .filter(Affectation.encadreur_id == encadreur_id)
        .all()
    )

    # Fusion sans doublons
    merged_by_id = {stagiaire.id: stagiaire for stagiaire in direct_stagiaires}
    for stagiaire in affectation_stagiaires:
        merged_by_id[stagiaire.id] = stagiaire

    return list(merged_by_id.values())
