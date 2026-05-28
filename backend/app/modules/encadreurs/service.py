from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.security import generate_password, hash_password
from app.modules.encadreurs.models import Encadreur
from app.modules.encadreurs.schemas import EncadreurCreateSchema, EncadreurUpdateSchema
from app.modules.stage.models import Stage
from app.modules.stagiaires.models import Stagiaire
from app.shared.enums import RoleEnum
from app.shared.sending_emails import send_email_with_template


async def create_encadreur_by_admin(
    db: Session,
    data: EncadreurCreateSchema,
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
            "password": plain_password,
        },
        subject="Votre compte Encadreur",
        template_name="encadreur_created.html",
    )

    if not email_sent:
        return JSONResponse(
            status_code=500,
            content={"message": "Encadreur créé لكن الإيميل فشل"},
        )

    return JSONResponse(
        status_code=201,
        content={
            "message": "Encadreur créé والإيميل تبعث ✅",
            "encadreur_id": encadreur.id,
        },
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


def get_stagiaire_ids_for_encadreur(db: Session, encadreur_id: int) -> set[int]:
    from app.modules.affectations.models import Affectation

    direct_ids = {
        stagiaire_id
        for (stagiaire_id,) in (
            db.query(Stagiaire.id)
            .filter(Stagiaire.encadreur_id == encadreur_id)
            .all()
        )
    }

    affectation_ids = {
        stagiaire_id
        for (stagiaire_id,) in (
            db.query(Stagiaire.id)
            .join(Affectation, Affectation.stagiaire_id == Stagiaire.id)
            .filter(Affectation.encadreur_id == encadreur_id)
            .all()
        )
    }

    stage_ids = {
        stagiaire_id
        for (stagiaire_id,) in (
            db.query(Stagiaire.id)
            .join(Stage, Stage.stagiaire_id == Stagiaire.id)
            .filter(Stage.encadreur_id == encadreur_id)
            .all()
        )
    }

    return direct_ids | affectation_ids | stage_ids


def get_stagiaires_for_encadreur(db: Session, encadreur_id: int):
    stagiaire_ids = get_stagiaire_ids_for_encadreur(db, encadreur_id)
    if not stagiaire_ids:
        return []

    return (
        db.query(Stagiaire)
        .filter(Stagiaire.id.in_(stagiaire_ids))
        .order_by(Stagiaire.id.desc())
        .all()
    )
