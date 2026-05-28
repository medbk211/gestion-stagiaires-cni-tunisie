import os
import shutil
import logging
from datetime import date
from uuid import uuid4

from fastapi import HTTPException, UploadFile
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.core.security import generate_password, hash_password
from app.modules.affectations.models import Affectation
from app.modules.demande_stage.history_models import DemandeStageStatusHistory
from app.modules.demande_stage.models import DemandeStage
from app.modules.document.models import Document
from app.modules.document.service import validate_dates, validate_file
from app.modules.encadreurs.models import Encadreur
from app.modules.projet_stage.models import Projet
from app.modules.stage.models import Stage
from app.modules.stagiaires.models import Stagiaire
from app.modules.utilisateur.models import Utilisateur
from app.modules.notifications.service import create_notification
from app.shared.competences import DEPARTEMENT_COMPETENCES, GENERAL_COMPETENCES
from app.shared.enums import (
    DepartementEnum,
    DocumentTypeEnum,
    RoleEnum,
    StatutDemandeEnum,
    StatutStageEnum,
    TypeStageEnum,
)
from app.shared.sending_emails import send_email_with_template
from app.shared.utils import generate_matricule

logger = logging.getLogger(__name__)

DEFAULT_DEMANDE_TAGS = [
    'Developpement',
    'Data',
    'IA',
    'Web',
    'Mobile',
    'Reseaux',
    'Securite',
    'DevOps',
    'Support',
    'Documentation',
]


def _status_value(statut: object) -> str:
    return statut.value if hasattr(statut, 'value') else str(statut)


def _notify_user_by_email(
    db: Session,
    email: str,
    title: str,
    message: str,
    category: str = 'demande_stage',
):
    user = db.query(Utilisateur).filter(Utilisateur.email == email).first()
    if not user:
        return
    create_notification(
        db,
        user_id=user.id,
        title=title,
        message=message,
        category=category,
    )


def _ensure_status_history_table(db: Session):
    DemandeStageStatusHistory.__table__.create(bind=db.get_bind(), checkfirst=True)


def _unique_values(values: list[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for raw in values:
        if not isinstance(raw, str):
            continue
        value = raw.strip()
        if not value:
            continue
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(value)
    return result


def _add_status_history(
    db: Session,
    demande_id: int,
    previous_status: object | None,
    new_status: object,
    changed_by: int | None = None,
    reason: str | None = None,
):
    _ensure_status_history_table(db)
    entry = DemandeStageStatusHistory(
        demande_id=demande_id,
        previous_status=_status_value(previous_status) if previous_status else None,
        new_status=_status_value(new_status),
        changed_by=changed_by,
        reason=(reason or '').strip() or None,
    )
    db.add(entry)


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
    competences: list[str] | None,
    tags: list[str] | None,
    cv: UploadFile | None,
    convention: UploadFile | None,
    lettre: UploadFile | None = None,
):
    validate_dates(date_debut_souhaitee, date_fin_souhaitee)

    existing = db.query(DemandeStage).filter(DemandeStage.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail='Une demande avec cet email existe deja')

    try:
        demande = DemandeStage(
            nom=nom,
            prenom=prenom,
            email=email,
            telephone=telephone,
            etablissement=etablissement,
            niveau_etude=niveau_etude.value if hasattr(niveau_etude, 'value') else str(niveau_etude),
            departement_souhaite=departement_souhaite.value
            if hasattr(departement_souhaite, 'value')
            else str(departement_souhaite),
            date_debut_souhaitee=date_debut_souhaitee,
            date_fin_souhaitee=date_fin_souhaitee,
            competences=_unique_values(competences or []),
            tags=_unique_values(tags or []),
        )

        db.add(demande)
        db.flush()

        upload_dir = f'uploads/demandes/{demande.id}'
        os.makedirs(upload_dir, exist_ok=True)

        files = {
            DocumentTypeEnum.CV: cv,
            DocumentTypeEnum.CONVOCATION: convention,
            DocumentTypeEnum.LETTRE: lettre,
        }

        for doc_type, file in files.items():
            if file is None:
                continue

            validate_file(file)
            filename = f"{doc_type.value}_{uuid4()}.pdf"
            path = os.path.join(upload_dir, filename)

            with open(path, 'wb') as buffer:
                shutil.copyfileobj(file.file, buffer)

            db.add(
                Document(
                    demande_id=demande.id,
                    type=doc_type,
                    file_path=path,
                )
            )

        _add_status_history(
            db,
            demande_id=demande.id,
            previous_status=None,
            new_status=demande.statut,
            changed_by=None,
            reason='Demande creee',
        )

        db.commit()
        db.refresh(demande)

    except HTTPException as exc:
        db.rollback()
        logger.warning(
            'Creation demande rejetee (status=%s): %s',
            exc.status_code,
            exc.detail,
        )
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception('Erreur SQL lors de la creation de la demande de stage')
        raise HTTPException(
            status_code=500,
            detail='Erreur lors de la creation de la demande',
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception('Erreur inattendue lors de la creation de la demande de stage')
        raise HTTPException(
            status_code=500,
            detail='Erreur lors de la creation de la demande',
        ) from exc

    email_result = await send_email_with_template(
        emails=[email],
        subject='Confirmation de votre demande de stage',
        template_name='demande_created.html',
        body={
            'prenom': prenom,
            'nom': nom,
            'demande_id': demande.id,
            'year': '2026',
        },
    )
    if isinstance(email_result, dict) and email_result.get('error'):
        logger.warning(
            'Demande %s creee mais email non envoye: %s',
            demande.id,
            email_result.get('error'),
        )

    return demande


def get_all_demandes_stage(
    db: Session,
    encadreur_id: int | None = None,
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    statut: StatutDemandeEnum | None = None,
    departement: DepartementEnum | None = None,
):
    query = (
        db.query(DemandeStage)
        .options(selectinload(DemandeStage.documents))
        .order_by(DemandeStage.created_at.desc())
    )
    if encadreur_id is not None:
        query = query.filter(DemandeStage.encadreur_id == encadreur_id)
    if statut is not None:
        query = query.filter(DemandeStage.statut == statut)
    if departement is not None:
        departement_value = departement.value if hasattr(departement, 'value') else str(departement)
        query = query.filter(DemandeStage.departement_souhaite == departement_value)
    if search:
        token = f'%{search.strip()}%'
        query = query.filter(
            or_(
                DemandeStage.nom.ilike(token),
                DemandeStage.prenom.ilike(token),
                DemandeStage.email.ilike(token),
                DemandeStage.etablissement.ilike(token),
            )
        )
    return query.offset(skip).limit(limit).all()


def get_demande_form_options(db: Session):
    competences_by_departement: dict[str, list[str]] = {}
    for departement, departement_competences in DEPARTEMENT_COMPETENCES.items():
        merged = _unique_values([*GENERAL_COMPETENCES, *(departement_competences or [])])
        competences_by_departement[departement.value] = merged

    tags_from_projects: list[str] = []
    try:
        for (raw_tags,) in db.query(Projet.tags).all():
            if not isinstance(raw_tags, list):
                continue
            tags_from_projects.extend([tag for tag in raw_tags if isinstance(tag, str)])
    except Exception:
        # Non-blocking fallback if projects table/column is not ready.
        tags_from_projects = []

    tags_from_demandes: list[str] = []
    try:
        for (raw_tags,) in db.query(DemandeStage.tags).all():
            if not isinstance(raw_tags, list):
                continue
            tags_from_demandes.extend([tag for tag in raw_tags if isinstance(tag, str)])
    except Exception:
        # Non-blocking fallback if demandes_stage.tags is not migrated yet.
        tags_from_demandes = []

    return {
        'departements': [departement.value for departement in DepartementEnum],
        'types_stage': [type_stage.value for type_stage in TypeStageEnum],
        'competences_by_departement': competences_by_departement,
        'tags': _unique_values([*DEFAULT_DEMANDE_TAGS, *sorted(tags_from_projects), *sorted(tags_from_demandes)]),
    }


def get_demande_history(db: Session, demande_id: int):
    _ensure_status_history_table(db)
    return (
        db.query(DemandeStageStatusHistory)
        .filter(DemandeStageStatusHistory.demande_id == demande_id)
        .order_by(DemandeStageStatusHistory.changed_at.desc(), DemandeStageStatusHistory.id.desc())
        .all()
    )


async def changer_statut_demande(
    db: Session,
    demande_id: int,
    nouveau_statut: StatutDemandeEnum,
    changed_by: int | None,
    reason: str | None = None,
):
    demande = db.get(DemandeStage, demande_id)
    if not demande:
        raise HTTPException(status_code=404, detail='Demande de stage introuvable')

    ancien_statut = demande.statut
    demande.statut = nouveau_statut

    _add_status_history(
        db,
        demande_id=demande.id,
        previous_status=ancien_statut,
        new_status=nouveau_statut,
        changed_by=changed_by,
        reason=reason,
    )

    db.commit()
    db.refresh(demande)

    await send_email_with_template(
        emails=[demande.email],
        subject='Mise a jour de votre demande de stage',
        template_name='demande_status_updated.html',
        body={
            'prenom': demande.prenom,
            'nom': demande.nom,
            'demande_id': demande.id,
            'ancien_statut': _status_value(ancien_statut),
            'nouveau_statut': _status_value(nouveau_statut),
            'motif': (reason or '').strip() or 'Aucun motif fourni',
            'year': '2026',
        },
    )

    _notify_user_by_email(
        db,
        email=demande.email,
        title='Demande de stage mise a jour',
        message=f'Votre demande #{demande.id} est maintenant en statut "{_status_value(nouveau_statut)}".',
    )

    return demande


async def accepter_demande(
    demande_id: int,
    encadreur_id: int,
    db: Session,
    changed_by: int | None = None,
):
    try:
        demande = db.get(DemandeStage, demande_id)
        encadreur = db.get(Encadreur, encadreur_id)

        affectation = db.query(Affectation).filter(Affectation.demande_id == demande_id).first()
        project = db.query(Projet).filter(Projet.id == affectation.projet_id).first() if affectation else None

        if not demande:
            raise HTTPException(404, 'Demande de stage introuvable')
        if not encadreur:
            raise HTTPException(404, 'Encadreur introuvable')
        if not affectation:
            raise HTTPException(404, 'Affectation introuvable')

        existing_user = db.query(Utilisateur).filter(Utilisateur.email == demande.email).first()
        if existing_user:
            raise HTTPException(400, 'Un compte utilisateur existe deja pour cet email')

        plain_password = generate_password()
        hashed_password = hash_password(plain_password)
        matricule = generate_matricule(db)

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
            encadreur_id=encadreur.id,
        )

        db.add(stagiaire)
        db.flush()

        stage = Stage(
            demandestage_id=demande.id,
            stagiaire_id=stagiaire.id,
            encadreur_id=encadreur.id,
            projet_id=affectation.projet_id,
            date_debut=demande.date_debut_souhaitee,
            date_fin=demande.date_fin_souhaitee,
            statut_stage=StatutStageEnum.EN_COURS,
            texte_objectif='A definir',
        )
        db.add(stage)

        affectation.stagiaire_id = stagiaire.id

        old_status = demande.statut
        demande.statut = StatutDemandeEnum.ACCEPTEE

        _add_status_history(
            db,
            demande_id=demande.id,
            previous_status=old_status,
            new_status=demande.statut,
            changed_by=changed_by,
            reason='Demande acceptee',
        )

        db.commit()

        await send_email_with_template(
            emails=[demande.email],
            subject='Creation de votre compte stagiaire',
            template_name='stagier_created.html',
            body={
                'matricule': project.code_projet if project else matricule,
                'type_stage': getattr(stagiaire.type_stage, 'value', str(stagiaire.type_stage)),
                'etablissement': stagiaire.etablissement,
                'date_debut': stagiaire.date_debut_stage.strftime('%d/%m/%Y'),
                'date_fin': stagiaire.date_fin_stage.strftime('%d/%m/%Y'),
                'nom': demande.nom,
                'prenom': demande.prenom,
                'email': demande.email,
                'password': plain_password,
            },
        )

        _notify_user_by_email(
            db,
            email=demande.email,
            title='Demande acceptee',
            message=f'Votre demande #{demande.id} a ete acceptee. Votre compte stagiaire est actif.',
        )

        return {
            'message': 'Demande acceptee avec succes',
            'stagiaire_id': stagiaire.id,
            'email': stagiaire.email,
        }

    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(500, 'Erreur interne lors de la creation du stagiaire')
