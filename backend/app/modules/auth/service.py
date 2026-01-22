from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import datetime
from app.core.security import verify_password, create_access_token
from datetime import timedelta
import secrets
from app.modules.auth.models import ResetMotDePasse



from app.modules.utilisateur.models import Utilisateur
from app.core.security import hash_password



def login_user(db:  Session, email: str, password: str):
    user = db.query(Utilisateur).filter(Utilisateur.email == email).first()

    if not user :
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )
    if not verify_password(password, user.motDePasse):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Mot de passe incorrect"
        )
    if  user.actif == True:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Utilisateur désactivé"
        )
    
    token = create_access_token(data={"sub": str(user.id), "role": user.role})
    user.dernierLogin = datetime.utcnow()
    db.commit()
    return token    



def forgot_password_user(db: Session, email: str):
    user = db.query(Utilisateur).filter(Utilisateur.email == email).first()

    if not user :
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Utilisateur non trouvé"
        )
    
    token = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(minutes=15)

    reset_token = ResetMotDePasse(
        utilisateur_id=user.id,
        token=token,
        date_expiration=expires_at
    )
    # db.add(reset_token)
    # db.commit()
    print(f"Reset link: http://frontend/reset-password?token={token}")
    
    # Here you would typically generate a password reset token and send an email
    # For simplicity, we'll just return a success message
    return {"message": "If the email exists, a reset link has been sent"}
    

def reset_password_user(db: Session, token: str, new_password: str):
    
    reset_token = db.query(ResetMotDePasse).filter(
        ResetMotDePasse.token == token,
        ResetMotDePasse.utilisee == False
    ).first()

    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token invalide"
        )

    if reset_token.date_expiration < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token expiré"
        )

    user = reset_token.utilisateur  

    user.motDePasse = hash_password(new_password)

    reset_token.utilisee = True  
    db.commit()

    return "Mot de passe réinitialisé avec succès"