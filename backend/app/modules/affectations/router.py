from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.modules.affectations.schemas import (
    AssignEncadreurRequest
)
from app.modules.affectations.service import proposer_top3_projets

router = APIRouter()


@router.post("/demande/{demande_id}/proposer-projets")

def proposer_projets(demande_id: int, db: Session = Depends(get_db)):
    try:
        return proposer_top3_projets(demande_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/assign-encadreur")
def assigner_encadreur(payload: AssignEncadreurRequest):
    return {"message": "Encadreur assigné avec succès"}
