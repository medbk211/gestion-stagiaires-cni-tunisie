from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_role
from app.modules.utilisateur.models import Utilisateur
from app.modules.utilisateur.schemas import UtilisateurCreate, UtilisateurRead, UtilisateurUpdate
from app.modules.utilisateur.service import (
    create_utilisateur,
    get_all_utilisateurs,
    toggle_utilisateur,
    update_utilisateur,
)
from app.shared.enums import RoleEnum

router = APIRouter()


def get_user_or_404(db: Session, user_id: int):
    user = db.get(Utilisateur, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Utilisateur non trouve',
        )
    return user


@router.get(
    '/',
    response_model=List[UtilisateurRead],
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def list_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return get_all_utilisateurs(db, skip, limit)


@router.post(
    '/create',
    response_model=UtilisateurRead,
    
)
def create_user(
    data: UtilisateurCreate,
    db: Session = Depends(get_db),
):
    return create_utilisateur(db, data)


@router.put(
    '/{id}',
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def update_user(id: int, data: UtilisateurUpdate, db: Session = Depends(get_db)):
    user = get_user_or_404(db, id)
    return update_utilisateur(db, user, data)


@router.delete(
    '/{id}',
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def delete_user(id: int, db: Session = Depends(get_db)):
    user = get_user_or_404(db, id)
    db.delete(user)
    db.commit()
    return {'message': 'Utilisateur supprime avec succes'}


@router.patch(
    '/{id}/activer',
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def activer(id: int, db: Session = Depends(get_db)):
    toggle_utilisateur(db, get_user_or_404(db, id), True)
    return {'message': 'Utilisateur active'}


@router.patch(
    '/{id}/desactiver',
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def desactiver(id: int, db: Session = Depends(get_db)):
    toggle_utilisateur(db, get_user_or_404(db, id), False)
    return {'message': 'Utilisateur desactive'}
