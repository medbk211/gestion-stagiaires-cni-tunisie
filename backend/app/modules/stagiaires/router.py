from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.modules.stagiaires.schemas import StagiaireCreate, StagiaireRead, StagiaireUpdate
from app.modules.stagiaires.service import (
    create_stagiaire,
    get_stagiaire,
    get_stagiaires,
    update_stagiaire,
    delete_stagiaire
)

router = APIRouter()

@router.post("/", response_model=StagiaireRead, status_code=status.HTTP_201_CREATED)
def create_new_stagiaire(data: StagiaireCreate, db: Session = Depends(get_db)):
    return create_stagiaire(db, data)

@router.get("/", response_model=List[StagiaireRead])
def read_stagiaires(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return get_stagiaires(db, skip=skip, limit=limit)

@router.get("/{stagiaire_id}", response_model=StagiaireRead)
def read_stagiaire(stagiaire_id: int, db: Session = Depends(get_db)):
    db_stagiaire = get_stagiaire(db, stagiaire_id)
    if db_stagiaire is None:
        raise HTTPException(status_code=404, detail="Stagiaire non trouvé")
    return db_stagiaire

@router.put("/{stagiaire_id}", response_model=StagiaireRead)
def update_existing_stagiaire(stagiaire_id: int, data: StagiaireUpdate, db: Session = Depends(get_db)):
    db_stagiaire = update_stagiaire(db, stagiaire_id, data)
    if db_stagiaire is None:
        raise HTTPException(status_code=404, detail="Stagiaire non trouvé")
    return db_stagiaire

@router.delete("/{stagiaire_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existing_stagiaire(stagiaire_id: int, db: Session = Depends(get_db)):
    success = delete_stagiaire(db, stagiaire_id)
    if not success:
        raise HTTPException(status_code=404, detail="Stagiaire non trouvé")
    return None
