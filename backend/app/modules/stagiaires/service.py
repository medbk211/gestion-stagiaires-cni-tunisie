from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.modules.stagiaires.models import Stagiaire
from app.modules.utilisateur.models import Utilisateur
from app.modules.stagiaires.schemas import StagiaireCreate, StagiaireUpdate
from app.core.security import hash_password
from app.shared.enums import RoleEnum

def get_stagiaire(db: Session, stagiaire_id: int):
    return db.query(Stagiaire).filter(Stagiaire.id == stagiaire_id).first()

def get_stagiaires(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Stagiaire).offset(skip).limit(limit).all()

def create_stagiaire(db: Session, data: StagiaireCreate):
    # Check if email exists in Utilisateur table (globally unique)
    existing_user = db.query(Utilisateur).filter(Utilisateur.email == data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un utilisateur avec cet email existe déjà"
        )
    
    # Check if matricule exists
    existing_matricule = db.query(Stagiaire).filter(Stagiaire.matricule == data.matricule).first()
    if existing_matricule:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Un stagiaire avec ce matricule existe déjà"
        )

    hashed = hash_password(data.motDePasse)

    # Create Stagiaire (which inherits from Utilisateur)
    db_stagiaire = Stagiaire(
        nom=data.nom,
        prenom=data.prenom,
        email=data.email,
        motDePasse=hashed,
        role=RoleEnum.STAGIAIRE,
        actif=True, # Default to active
        emailVerifie=False,
        
        matricule=data.matricule,
        type_stage=data.type_stage,
        statut_stage=data.statut_stage,
        date_debut_stage=data.date_debut_stage,
        date_fin_stage=data.date_fin_stage,
        etablissement=data.etablissement,
        niveau_etude=data.niveau_etude,
        encadreur_id=data.encadreur_id
    )

    db.add(db_stagiaire)
    db.commit()
    db.refresh(db_stagiaire)
    return db_stagiaire

def update_stagiaire(db: Session, stagiaire_id: int, data: StagiaireUpdate):
    db_stagiaire = get_stagiaire(db, stagiaire_id)
    if not db_stagiaire:
        return None
    
    update_data = data.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(db_stagiaire, key, value)

    db.commit()
    db.refresh(db_stagiaire)
    return db_stagiaire

def delete_stagiaire(db: Session, stagiaire_id: int):
    db_stagiaire = get_stagiaire(db, stagiaire_id)
    if not db_stagiaire:
        return False
    
    db.delete(db_stagiaire)
    db.commit()
    return True
