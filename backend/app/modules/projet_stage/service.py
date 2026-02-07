from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.modules.projet_stage.models import Projet
from app.modules.projet_stage.schemas import ProjetStageCreate, ProjetStageUpdate
import uuid


def create_projet_stage(db: Session, projet_data: ProjetStageCreate):
    """Créer un nouveau projet de stage."""
    
    # Validation métier
    if projet_data.duree_semaines <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La durée du stage doit être supérieure à 0."
        )

    if not (1 <= projet_data.charge_hebdo <= 40):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La charge hebdomadaire doit être entre 1 et 40 heures."
        )
    
    projet_stage = Projet(**projet_data.model_dump())
    projet_stage.code_projet = f"PROJ-{uuid.uuid4().hex[:8]}"

    db.add(projet_stage)
    db.commit()
    db.refresh(projet_stage)

    return projet_stage


def get_all_projects(db: Session):
    """Récupérer tous les projets."""
    return db.query(Projet).all()


def get_project(db: Session, projet_id: int):
    """Récupérer un projet par son ID."""
    projet = db.get(Projet, projet_id)
    if not projet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Projet introuvable."
        )
    return projet


def update_project(db: Session, projet_id: int, projet_data: ProjetStageUpdate):
    """Mettre à jour un projet existant."""
    projet = db.get(Projet, projet_id)
    if not projet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Projet introuvable."
        )

    # Mise à jour uniquement des champs fournis
    for key, value in projet_data.model_dump(exclude_unset=True).items():
        setattr(projet, key, value)

    db.commit()
    db.refresh(projet)
    return projet


def delete_project(db: Session, projet_id: int):
    """Supprimer un projet."""
    projet = db.get(Projet, projet_id)
    if not projet:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Projet introuvable."
        )

    db.delete(projet)
    db.commit()
    return {"detail": "Projet supprimé avec succès."}



    

    
    