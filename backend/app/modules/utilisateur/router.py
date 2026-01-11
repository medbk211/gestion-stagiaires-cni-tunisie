
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.security import require_role
from app.shared.enums import RoleEnum
from sqlalchemy.orm import Session

from app.core.database import get_db

from app.modules.utilisateur.schemas import (
    UtilisateurCreate, UtilisateurRead, UtilisateurUpdate
)
from app.modules.utilisateur.models import Utilisateur
from app.modules.utilisateur.service import (
    create_utilisateur, update_utilisateur, toggle_utilisateur
)



router = APIRouter()


def get_user_or_404(db: Session, user_id: int):
    user = db.get(Utilisateur, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )
    return user


@router.post("/create", response_model=UtilisateurRead)
def create_user(
    data: UtilisateurCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_role(RoleEnum.ADMIN))
):
    return create_utilisateur(db, data)


@router.put("/{id}")
def update_user(id: int, data: UtilisateurUpdate, db: Session = Depends(get_db)):
    user = get_user_or_404(db, id)
    return update_utilisateur(db, user, data)


@router.delete("/{id}")
def delete_user(id: int, db: Session = Depends(get_db)):
    user = get_user_or_404(db, id)
    db.delete(user)
    db.commit()


@router.patch("/{id}/activer")
def activer(id: int, db: Session = Depends(get_db)):
    toggle_utilisateur(db, get_user_or_404(db, id), True)


@router.patch("/{id}/desactiver")
def desactiver(id: int, db: Session = Depends(get_db)):
    toggle_utilisateur(db, get_user_or_404(db, id), False)
