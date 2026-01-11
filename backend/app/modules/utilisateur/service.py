from app.modules.utilisateur.models import Utilisateur
from app.modules.utilisateur.schemas import UtilisateurCreate, UtilisateurUpdate
from app.core.security import hash_password


def create_utilisateur(db, data: UtilisateurCreate):
    
    hashed = hash_password(data.motDePasse)

    user = Utilisateur(
        nom=data.nom,
        prenom=data.prenom,
        email=data.email,
        motDePasse=hashed,
        role=data.role,
        actif=False,
        emailVerifie=False
        
    )

    db.add(user)
    db.commit()
    db.refresh(user)
    return user



def update_utilisateur(db, user, data: UtilisateurUpdate):
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


def toggle_utilisateur(db, user, actif: bool):
    user.actif = actif
    db.commit()

