from fastapi import APIRouter, Depends, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.auth.schemas import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginResponse,
    LogoutRequest,
    RefreshTokenRequest,
    RefreshTokenResponse,
    ResetPasswordRequest,
)
from app.modules.auth.service import (
    change_password_user,
    forgot_password_user,
    login_user,
    logout_user,
    refresh_access_token,
    reset_password_user,
)
from app.modules.utilisateur.models import Utilisateur

router = APIRouter()


@router.get('/me')
def me(current_user: Utilisateur = Depends(get_current_user)):
    return {
        'id': current_user.id,
        'email': current_user.email,
        'nom': current_user.nom,
        'prenom': current_user.prenom,
        'role': current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role),
    }


@router.post('/login', response_model=LoginResponse)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    ip_address = request.client.host if request.client else 'unknown'
    identifier = f"{ip_address}:{form_data.username.strip().lower()}"
    access_token, refresh_token = login_user(db, form_data.username, form_data.password, identifier)
    return {
        'access_token': access_token,
        'refresh_token': refresh_token,
        'token_type': 'bearer',
    }


@router.post('/refresh', response_model=RefreshTokenResponse)
def refresh_token(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    access_token, next_refresh_token = refresh_access_token(db, payload.refresh_token)
    return {
        'access_token': access_token,
        'refresh_token': next_refresh_token,
        'token_type': 'bearer',
    }


@router.post('/logout')
def logout(payload: LogoutRequest):
    return logout_user(payload.refresh_token)


@router.post('/forgot-password')
def forgot_password(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    message = forgot_password_user(db, data.email)
    return {'message': message}


@router.post('/reset-password')
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    message = reset_password_user(db, data.token, data.new_password)
    return {'message': message}


@router.post('/change-password')
def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return change_password_user(
        db,
        current_user,
        payload.current_password,
        payload.new_password,
    )
