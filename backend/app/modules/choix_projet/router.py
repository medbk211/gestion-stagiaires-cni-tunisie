from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.modules.choix_projet.schemas import ChoixProjetRequest
from app.modules.choix_projet import service

router = APIRouter()



@router.get("/selection-projet")
def get_projets_par_token(token: str, db: Session = Depends(get_db)):
    return service.voir_projets_par_token(token, db)


@router.post("/choisir-projet")
def post_choisir_projet(payload: ChoixProjetRequest, db: Session = Depends(get_db)):
    return service.choisir_projet(payload.token, payload.projet_id, db)


@router.get("/encadreur/{encadreur_id}/projets-choisis")
def get_projets_choisis_encadreur(encadreur_id: int, db: Session = Depends(get_db)):
    return service.voir_projets_choisis_encadreur(encadreur_id, db)



