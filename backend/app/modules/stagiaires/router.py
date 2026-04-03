from typing import List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.modules.encadreurs.service import get_stagiaire_ids_for_encadreur
from app.modules.evaluation.models import Evaluation
from app.modules.stage.models import Stage
from app.modules.stagiaires.models import Stagiaire
from app.modules.stagiaires.schemas import (
    StagiaireCreate,
    StagiaireProgressRead,
    StagiaireProfileRead,
    StagiaireProfileUpdate,
    StagiaireRead,
    StagiaireUpdate,
)
from app.modules.stagiaires.service import (
    create_stagiaire,
    delete_stagiaire,
    get_stagiaire,
    update_stagiaire,
)
from app.modules.tasks.models import Task
from app.modules.utilisateur.models import Utilisateur
from app.shared.enums import RoleEnum, StatutStageEnum, taskStatusEnum

router = APIRouter()


def _get_stagiaire_record_for_current_user(
    db: Session,
    current_user: Utilisateur,
) -> dict | None:
    row = (
        db.query(
            Stagiaire.id.label('id'),
            Stagiaire.email.label('email'),
            Stagiaire.etablissement.label('etablissement'),
            Stagiaire.niveau_etude.label('niveau_etude'),
        )
        .filter(
            or_(
                Stagiaire.id == current_user.id,
                Stagiaire.email == current_user.email,
            )
        )
        .first()
    )
    if not row:
        return None
    return {
        'id': int(row.id),
        'email': row.email,
        'etablissement': row.etablissement,
        'niveau_etude': row.niveau_etude,
    }


def _serialize_profile(current_user: Utilisateur, stagiaire_record: dict | None):
    return {
        'id': current_user.id,
        'nom': current_user.nom,
        'prenom': current_user.prenom,
        'email': current_user.email,
        'role': current_user.role,
        'actif': current_user.actif,
        'etablissement': stagiaire_record['etablissement'] if stagiaire_record else None,
        'niveau_etude': stagiaire_record['niveau_etude'] if stagiaire_record else None,
        'has_stagiaire_record': bool(stagiaire_record),
    }


@router.post(
    '/',
    response_model=StagiaireRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def create_new_stagiaire(data: StagiaireCreate, db: Session = Depends(get_db)):
    return create_stagiaire(db, data)


@router.get(
    '/',
    response_model=List[StagiaireRead],
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def read_stagiaires(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    query = db.query(Stagiaire)
    if current_user.role == RoleEnum.ENCADREUR:
        query = query.filter(
            Stagiaire.id.in_(get_stagiaire_ids_for_encadreur(db, current_user.id))
        )
    elif current_user.role == RoleEnum.STAGIAIRE:
        query = query.filter(Stagiaire.id == current_user.id)

    return query.offset(skip).limit(limit).all()


@router.get(
    '/me/profile',
    response_model=StagiaireProfileRead,
    dependencies=[Depends(require_role(RoleEnum.STAGIAIRE))],
)
def read_my_profile(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    record = _get_stagiaire_record_for_current_user(db, current_user)
    return _serialize_profile(current_user, record)


@router.patch(
    '/me/profile',
    response_model=StagiaireProfileRead,
    dependencies=[Depends(require_role(RoleEnum.STAGIAIRE))],
)
def update_my_profile(
    payload: StagiaireProfileUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    record = _get_stagiaire_record_for_current_user(db, current_user)
    update_data = payload.model_dump(exclude_unset=True)

    next_email = update_data.get('email')
    if next_email and next_email != current_user.email:
        existing = (
            db.query(Utilisateur)
            .filter(
                Utilisateur.email == next_email,
                Utilisateur.id != current_user.id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail='Email deja utilise')

    for field in ('nom', 'prenom', 'email'):
        if field in update_data:
            setattr(current_user, field, update_data[field])

    if record:
        update_stagiaire_data: dict = {}
        for field in ('etablissement', 'niveau_etude'):
            if field in update_data:
                update_stagiaire_data[field] = update_data[field]
        if update_stagiaire_data:
            # Bulk update on Stagiaire must only include columns from "stagiaires".
            (
                db.query(Stagiaire)
                .filter(Stagiaire.id == record['id'])
                .update(update_stagiaire_data, synchronize_session=False)
            )

    db.commit()
    db.refresh(current_user)
    refreshed_record = _get_stagiaire_record_for_current_user(db, current_user)

    return _serialize_profile(current_user, refreshed_record)


@router.get(
    '/{stagiaire_id}/progress',
    response_model=StagiaireProgressRead,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def read_stagiaire_progress(
    stagiaire_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    stagiaire = db.query(Stagiaire.id).filter(Stagiaire.id == stagiaire_id).first()
    if not stagiaire:
        raise HTTPException(status_code=404, detail='Stagiaire non trouve')

    stage_query = db.query(Stage).filter(Stage.stagiaire_id == stagiaire_id)

    if current_user.role == RoleEnum.STAGIAIRE:
        if current_user.id != stagiaire_id:
            raise HTTPException(status_code=403, detail='Acces interdit')
    elif current_user.role == RoleEnum.ENCADREUR:
        stage_query = stage_query.filter(Stage.encadreur_id == current_user.id)

    stages = stage_query.order_by(Stage.id.desc()).all()

    if current_user.role == RoleEnum.ENCADREUR and not stages:
        raise HTTPException(status_code=403, detail='Acces interdit')

    stage_selectionne = None
    for stage in stages:
        if stage.statut_stage == StatutStageEnum.EN_COURS:
            stage_selectionne = stage
            break
    if stage_selectionne is None and stages:
        stage_selectionne = stages[0]

    tasks_total = 0
    tasks_done = 0
    tasks_in_progress = 0
    tasks_todo = 0
    retard = 0

    if stage_selectionne:
        tasks = (
            db.query(Task.status, Task.deadline)
            .filter(Task.stage_id == stage_selectionne.id)
            .all()
        )
        tasks_total = len(tasks)

        for task in tasks:
            if task.status in {taskStatusEnum.DONE, taskStatusEnum.VALIDATED}:
                tasks_done += 1
            elif task.status == taskStatusEnum.IN_PROGRESS:
                tasks_in_progress += 1
            else:
                tasks_todo += 1

            if (
                task.deadline
                and task.deadline < datetime.utcnow()
                and task.status not in {taskStatusEnum.DONE, taskStatusEnum.VALIDATED}
            ):
                retard += 1

    progress_pct = int(round((tasks_done / tasks_total) * 100)) if tasks_total else 0

    evaluations_query = db.query(Evaluation).filter(Evaluation.stagiaire_id == stagiaire_id)
    if current_user.role == RoleEnum.ENCADREUR:
        evaluations_query = evaluations_query.filter(Evaluation.encadreur_id == current_user.id)

    evaluations_count = evaluations_query.count()
    moyenne_note = evaluations_query.with_entities(func.avg(Evaluation.note)).scalar()

    return {
        'stagiaire_id': stagiaire_id,
        'stage_id': stage_selectionne.id if stage_selectionne else None,
        'tasks_total': tasks_total,
        'tasks_done': tasks_done,
        'tasks_in_progress': tasks_in_progress,
        'tasks_todo': tasks_todo,
        'retard': retard,
        'progress_pct': progress_pct,
        'evaluations_count': evaluations_count,
        'moyenne_note': round(float(moyenne_note), 2) if moyenne_note is not None else None,
    }


@router.get(
    '/{stagiaire_id}',
    response_model=StagiaireRead,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def read_stagiaire(
    stagiaire_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    db_stagiaire = get_stagiaire(db, stagiaire_id)
    if db_stagiaire is None:
        raise HTTPException(status_code=404, detail='Stagiaire non trouve')

    if current_user.role == RoleEnum.ENCADREUR:
        allowed_stagiaire_ids = get_stagiaire_ids_for_encadreur(db, current_user.id)
        if stagiaire_id not in allowed_stagiaire_ids:
            raise HTTPException(status_code=403, detail='Acces interdit')
    if current_user.role == RoleEnum.STAGIAIRE and db_stagiaire.id != current_user.id:
        raise HTTPException(status_code=403, detail='Acces interdit')

    return db_stagiaire


@router.put(
    '/{stagiaire_id}',
    response_model=StagiaireRead,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.STAGIAIRE))],
)
def update_existing_stagiaire(
    stagiaire_id: int,
    data: StagiaireUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    if current_user.role == RoleEnum.STAGIAIRE and stagiaire_id != current_user.id:
        raise HTTPException(status_code=403, detail='Acces interdit')

    update_data = data
    if current_user.role == RoleEnum.STAGIAIRE:
        raw = data.model_dump(exclude_unset=True)
        allowed = {
            key: value
            for key, value in raw.items()
            if key in {'nom', 'prenom', 'email', 'etablissement', 'niveau_etude'}
        }
        update_data = StagiaireUpdate(**allowed)

    db_stagiaire = update_stagiaire(db, stagiaire_id, update_data)
    if db_stagiaire is None:
        raise HTTPException(status_code=404, detail='Stagiaire non trouve')
    return db_stagiaire


@router.delete(
    '/{stagiaire_id}',
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def delete_existing_stagiaire(stagiaire_id: int, db: Session = Depends(get_db)):
    success = delete_stagiaire(db, stagiaire_id)
    if not success:
        raise HTTPException(status_code=404, detail='Stagiaire non trouve')
    return None
