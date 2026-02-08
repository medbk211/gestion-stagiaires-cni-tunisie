from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.auth.schemas import LoginResponse, ForgotPasswordRequest, ResetPasswordRequest
from app.modules.auth.service import login_user, forgot_password_user, reset_password_user
from app.modules.utilisateur.models import Utilisateur

router = APIRouter()


@router.get("/me")
def me(current_user: Utilisateur = Depends(get_current_user)):
    """Retourne l'utilisateur connecté (pour vérifier session / rôle)."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "nom": current_user.nom,
        "prenom": current_user.prenom,
        "role": current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role),
    }


@router.post("/login", response_model=LoginResponse)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    token = login_user(db, form_data.username, form_data.password)
    return {
        "access_token": token,
        "token_type": "bearer"
    }

@router.post("/forgot-password")
def forgot_password(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    message = forgot_password_user(db, data.email)
    
    return {
        "message": message
    }


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):


    message = reset_password_user(db, data.token, data.new_password)


    return {
        "message": message
    }




