from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.modules.affectations.schemas import (
    AffectationCreate,
    AffectationRead,
    AffectationReadDetailed,
    AffectationUpdate,
    AssignEncadreurRequest,
)
from app.modules.affectations.service import (
    assigner_encadreur,
    create_affectation,
    delete_affectation,
    get_affectation_by_id,
    get_affectations_by_encadreur,
    get_affectations_by_projet,
    get_affectations_by_stagiaire,
    get_all_affectations,
    update_affectation_status,
)
from app.modules.utilisateur.models import Utilisateur
from app.shared.enums import RoleEnum

router = APIRouter()


@router.post(
    '/assign-encadreur',
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def router_assigner_encadreur(payload: AssignEncadreurRequest, db: Session = Depends(get_db)):
    return assigner_encadreur(payload.demande_id, payload.encadreur_id, db)


@router.post(
    '/',
    response_model=AffectationRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
async def create_affectation_endpoint(
    affectation_data: AffectationCreate,
    db: Session = Depends(get_db),
):
    try:
        return await create_affectation(affectation_data, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Error creating affectation: {str(exc)}')


@router.get(
    '/',
    response_model=List[AffectationReadDetailed],
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def list_affectations(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    if limit > 500:
        limit = 500
    return get_all_affectations(db, skip, limit)


@router.get(
    '/{affectation_id}',
    response_model=AffectationReadDetailed,
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def get_affectation_details(
    affectation_id: int,
    db: Session = Depends(get_db),
):
    affectation = get_affectation_by_id(affectation_id, db)
    if not affectation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f'Affectation {affectation_id} not found')
    return affectation


@router.put(
    '/{affectation_id}',
    response_model=AffectationRead,
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
async def update_affectation_endpoint(
    affectation_id: int,
    affectation_data: AffectationUpdate,
    db: Session = Depends(get_db),
):
    try:
        updated = await update_affectation_status(affectation_id, affectation_data, db)
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f'Affectation {affectation_id} not found')
        return updated
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete(
    '/{affectation_id}',
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
async def delete_affectation_endpoint(
    affectation_id: int,
    db: Session = Depends(get_db),
):
    success = delete_affectation(affectation_id, db)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f'Affectation {affectation_id} not found')


@router.get(
    '/stagiaire/{stagiaire_id}',
    response_model=List[AffectationRead],
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.STAGIAIRE))],
)
def list_stagiaire_affectations(
    stagiaire_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    if current_user.role == RoleEnum.STAGIAIRE and current_user.id != stagiaire_id:
        raise HTTPException(status_code=403, detail='Acces interdit')
    return get_affectations_by_stagiaire(stagiaire_id, db)


@router.get(
    '/encadreur/{encadreur_id}/affectations',
    response_model=List[AffectationRead],
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR))],
)
def list_encadreur_affectations(
    encadreur_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    if current_user.role == RoleEnum.ENCADREUR and current_user.id != encadreur_id:
        raise HTTPException(status_code=403, detail='Acces interdit')
    return get_affectations_by_encadreur(encadreur_id, db)


@router.get(
    '/projet/{projet_id}',
    response_model=List[AffectationRead],
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR))],
)
def list_projet_affectations(
    projet_id: int,
    db: Session = Depends(get_db),
):
    return get_affectations_by_projet(projet_id, db)
