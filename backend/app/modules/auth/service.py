from datetime import datetime, timedelta
import secrets

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import FRONTEND_URL, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_SECONDS
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.modules.auth.models import ResetMotDePasse
from app.modules.utilisateur.models import Utilisateur

LOGIN_ATTEMPTS: dict[str, list[datetime]] = {}
REVOKED_REFRESH_TOKENS: set[str] = set()


def _cleanup_attempts(identifier: str, now: datetime) -> list[datetime]:
    previous = LOGIN_ATTEMPTS.get(identifier, [])
    window_start = now - timedelta(seconds=LOGIN_WINDOW_SECONDS)
    cleaned = [ts for ts in previous if ts >= window_start]
    LOGIN_ATTEMPTS[identifier] = cleaned
    return cleaned


def _assert_not_rate_limited(identifier: str):
    now = datetime.utcnow()
    attempts = _cleanup_attempts(identifier, now)
    if len(attempts) >= LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail='Trop de tentatives. Reessayez plus tard.',
        )


def _register_failed_attempt(identifier: str):
    now = datetime.utcnow()
    attempts = _cleanup_attempts(identifier, now)
    attempts.append(now)
    LOGIN_ATTEMPTS[identifier] = attempts


def _clear_attempts(identifier: str):
    if identifier in LOGIN_ATTEMPTS:
        LOGIN_ATTEMPTS.pop(identifier, None)


def _role_value(role: object) -> str:
    if hasattr(role, 'value'):
        return str(getattr(role, 'value'))
    return str(role)


def login_user(db: Session, email: str, password: str, identifier: str):
    _assert_not_rate_limited(identifier)

    user = db.query(Utilisateur).filter(Utilisateur.email == email).first()
    if not user:
        _register_failed_attempt(identifier)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Utilisateur non trouve',
        )

    if not verify_password(password, user.motDePasse):
        _register_failed_attempt(identifier)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Mot de passe incorrect',
        )

    if user.actif is False:
        _register_failed_attempt(identifier)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Utilisateur desactive',
        )

    _clear_attempts(identifier)

    payload = {'sub': str(user.id), 'role': _role_value(user.role)}
    access_token = create_access_token(data=payload)
    refresh_token = create_refresh_token(data=payload)

    user.dernierLogin = datetime.utcnow()
    db.commit()
    return access_token, refresh_token


def refresh_access_token(db: Session, refresh_token: str) -> tuple[str, str]:
    if not refresh_token or refresh_token in REVOKED_REFRESH_TOKENS:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Refresh token invalide',
        )

    try:
        payload = decode_token(refresh_token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Refresh token invalide ou expire',
        )

    if payload.get('typ') != 'refresh':
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Type de token invalide',
        )

    sub = payload.get('sub')
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Refresh token invalide',
        )

    user = db.query(Utilisateur).filter(Utilisateur.id == int(sub)).first()
    if not user or user.actif is False:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Utilisateur invalide',
        )

    # Rotation: each refresh token can only be used once.
    REVOKED_REFRESH_TOKENS.add(refresh_token)

    payload = {
        'sub': str(user.id),
        'role': _role_value(user.role),
    }
    access_token = create_access_token(data=payload)
    new_refresh_token = create_refresh_token(data=payload)
    return access_token, new_refresh_token


def logout_user(refresh_token: str | None):
    if refresh_token:
        REVOKED_REFRESH_TOKENS.add(refresh_token)
    return {'message': 'Deconnexion effectuee'}


def forgot_password_user(db: Session, email: str):
    message_reponse = 'Si un compte correspond a cet email, un lien de reinitialisation a ete envoye.'
    user = db.query(Utilisateur).filter(Utilisateur.email == email).first()

    if not user:
        return message_reponse

    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=15)

    reset_token = ResetMotDePasse(
        utilisateur_id=user.id,
        token=token,
        date_expiration=expires_at,
    )
    db.add(reset_token)
    db.commit()

    frontend_url = FRONTEND_URL.rstrip('/')
    print(f'Reset link: {frontend_url}/reset-password?token={token}')
    return message_reponse


def reset_password_user(db: Session, token: str, new_password: str):
    reset_token = db.query(ResetMotDePasse).filter(
        ResetMotDePasse.token == token,
        ResetMotDePasse.utilisee == False,  # noqa: E712
    ).first()

    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Token invalide',
        )

    expiration = reset_token.date_expiration
    now = datetime.utcnow()
    if isinstance(expiration, datetime):
        est_expire = expiration < now
    else:
        est_expire = expiration < now.date()

    if est_expire:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Token expire',
        )

    user = reset_token.utilisateur
    user.motDePasse = hash_password(new_password)
    reset_token.utilisee = True
    db.commit()

    return 'Mot de passe reinitialise avec succes'


def change_password_user(
    db: Session,
    current_user: Utilisateur,
    current_password: str,
    new_password: str,
):
    if not verify_password(current_password, current_user.motDePasse):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Mot de passe actuel incorrect',
        )
    if verify_password(new_password, current_user.motDePasse):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Le nouveau mot de passe doit etre different',
        )

    current_user.motDePasse = hash_password(new_password)
    db.commit()
    return {'message': 'Mot de passe modifie avec succes'}
