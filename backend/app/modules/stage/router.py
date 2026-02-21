from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.modules.stage.models import Stage
from app.modules.stage.schemas import StageCreate, StageRead, StageUpdate
from app.modules.stage.service import (
    create_stage,
    delete_stage,
    get_stage,
    get_stage_by_stagiaire_id,
    get_stages_by_encadreur_id,
    update_stage,
)
from app.modules.utilisateur.models import Utilisateur
from app.shared.enums import RoleEnum

router = APIRouter()


@router.post(
    '/',
    response_model=StageRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def create_new_stage(stage: StageCreate, db: Session = Depends(get_db)):
    return create_stage(db, stage)


@router.get(
    '/',
    response_model=List[StageRead],
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def list_all_stages(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    query = db.query(Stage)
    if current_user.role == RoleEnum.ENCADREUR:
        query = query.filter(Stage.encadreur_id == current_user.id)
    elif current_user.role == RoleEnum.STAGIAIRE:
        query = query.filter(Stage.stagiaire_id == current_user.id)

    return query.offset(skip).limit(limit).all()


@router.get(
    '/me',
    response_model=StageRead,
    dependencies=[Depends(require_role(RoleEnum.STAGIAIRE))],
)
def read_my_stage(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    stage = get_stage_by_stagiaire_id(db, current_user.id)
    if not stage:
        raise HTTPException(status_code=404, detail='Aucun stage actif')
    return stage


@router.get(
    '/my-interns',
    response_model=List[StageRead],
    dependencies=[Depends(require_role(RoleEnum.ENCADREUR))],
)
def read_my_interns_stages(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return get_stages_by_encadreur_id(db, current_user.id, skip=skip, limit=limit)


@router.get(
    '/{stage_id}',
    response_model=StageRead,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def read_stage(
    stage_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    stage = get_stage(db, stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail='Stage introuvable')

    if current_user.role == RoleEnum.ENCADREUR and stage.encadreur_id != current_user.id:
        raise HTTPException(status_code=403, detail='Acces interdit')
    if current_user.role == RoleEnum.STAGIAIRE and stage.stagiaire_id != current_user.id:
        raise HTTPException(status_code=403, detail='Acces interdit')

    return stage


@router.put(
    '/{stage_id}',
    response_model=StageRead,
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def update_existing_stage(stage_id: int, stage_in: StageUpdate, db: Session = Depends(get_db)):
    stage = update_stage(db, stage_id, stage_in)
    if not stage:
        raise HTTPException(status_code=404, detail='Stage introuvable')
    return stage


@router.delete(
    '/{stage_id}',
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def delete_existing_stage(stage_id: int, db: Session = Depends(get_db)):
    success = delete_stage(db, stage_id)
    if not success:
        raise HTTPException(status_code=404, detail='Stage introuvable')
    return None
