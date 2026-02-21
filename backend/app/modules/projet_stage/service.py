import os
import shutil
import uuid

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.modules.document.service import validate_file
from app.modules.projet_stage.models import Projet
from app.modules.projet_stage.schemas import ProjetStageCreate, ProjetStageUpdate
from app.modules.stage.models import Stage
from app.shared.competences import DEPARTEMENT_COMPETENCES, GENERAL_COMPETENCES

DEFAULT_PROJECT_TAGS = [
    'Developpement',
    'Data',
    'IA',
    'Securite',
    'Infrastructure',
    'DevOps',
    'Support',
    'Documentation',
    'Analyse',
    'Web',
]


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


def _store_project_pdf_file(projet_id: int, fiche_pdf: UploadFile) -> str:
    validate_file(fiche_pdf)
    upload_dir = os.path.join('uploads', 'projets', str(projet_id))
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"fiche_{uuid.uuid4().hex}.pdf"
    file_path = os.path.join(upload_dir, filename)
    with open(file_path, 'wb') as buffer:
        shutil.copyfileobj(fiche_pdf.file, buffer)

    return file_path.replace('\\', '/')


def create_projet_stage(
    db: Session,
    projet_data: ProjetStageCreate,
    fiche_pdf: UploadFile | None = None,
):
    if projet_data.duree_semaines <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='La duree du stage doit etre superieure a 0.',
        )

    if not (1 <= projet_data.charge_hebdo <= 40):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='La charge hebdomadaire doit etre entre 1 et 40 heures.',
        )

    try:
        projet_stage = Projet(**projet_data.model_dump())
        projet_stage.code_projet = f'PROJ-{uuid.uuid4().hex[:8]}'

        db.add(projet_stage)
        db.flush()

        if fiche_pdf is not None:
            projet_stage.fiche_pdf_path = _store_project_pdf_file(projet_stage.id, fiche_pdf)

        db.commit()
        db.refresh(projet_stage)
        return projet_stage
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Erreur lors de la creation du projet.',
        ) from exc


def get_all_projects(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    departement: str | None = None,
    status_filter: str | None = None,
):
    query = db.query(Projet)

    if search:
        token = f'%{search.strip()}%'
        query = query.filter(or_(Projet.intitule.ilike(token), Projet.code_projet.ilike(token)))

    if departement:
        query = query.filter(Projet.departement == departement)

    if status_filter:
        query = query.filter(Projet.status == status_filter)

    return query.order_by(Projet.updated_at.desc(), Projet.id.desc()).offset(skip).limit(limit).all()


def get_project(db: Session, projet_id: int):
    projet = db.get(Projet, projet_id)
    if not projet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Projet introuvable.',
        )
    return projet


def get_project_pdf_file_path(db: Session, projet_id: int):
    projet = get_project(db, projet_id)
    if not projet.fiche_pdf_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Aucun PDF associe a ce projet.',
        )
    if not os.path.exists(projet.fiche_pdf_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Fichier PDF introuvable.',
        )
    return projet.fiche_pdf_path


def get_project_by_stage_id(db: Session, stage_id: int):
    stage = db.query(Stage).filter(Stage.id == stage_id).first()
    if not stage or not stage.projet_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Projet du stage introuvable.',
        )
    return get_project(db, stage.projet_id)


def update_project(db: Session, projet_id: int, projet_data: ProjetStageUpdate):
    projet = db.get(Projet, projet_id)
    if not projet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Projet introuvable.',
        )

    for key, value in projet_data.model_dump(exclude_unset=True).items():
        setattr(projet, key, value)

    db.commit()
    db.refresh(projet)
    return projet


def get_project_creation_options(db: Session):
    competences_by_departement: dict[str, list[str]] = {}
    for departement, departement_competences in DEPARTEMENT_COMPETENCES.items():
        merged = _unique_values([*GENERAL_COMPETENCES, *(departement_competences or [])])
        competences_by_departement[departement.value] = merged

    tags_from_existing_projects: list[str] = []
    for (raw_tags,) in db.query(Projet.tags).all():
        if not isinstance(raw_tags, list):
            continue
        tags_from_existing_projects.extend([tag for tag in raw_tags if isinstance(tag, str)])

    tags = _unique_values([*DEFAULT_PROJECT_TAGS, *sorted(tags_from_existing_projects)])
    return {
        'competences_by_departement': competences_by_departement,
        'tags': tags,
    }


def delete_project(db: Session, projet_id: int):
    projet = db.get(Projet, projet_id)
    if not projet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Projet introuvable.',
        )

    db.delete(projet)
    db.commit()
    return {'detail': 'Projet supprime avec succes.'}
