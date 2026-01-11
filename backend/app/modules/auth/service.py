from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import datetime
from app.core.security import verify_password, create_access_token



from app.modules.utilisateur.models import Utilisateur


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


     