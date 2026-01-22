from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
# from app.core.dependencies import get_current_admin
from app.modules.projet_stage.schemas import (
    ProjetStageCreate,
    ProjetStageRead
)
from app.modules.projet_stage.service import (
    create_projet_stage,
    get_all_projects
)
from app.modules.projet_stage.models import Projet
from app.modules.projet_stage.schemas import ProjetStageUpdate as UpdateProjetSchema





router = APIRouter()



@router.post("/projets", status_code=status.HTTP_201_CREATED)
def create_projet(projet_data: ProjetStageCreate, db: Session = Depends(get_db)):
    projet_stage = create_projet_stage(db, projet_data)
    
    
    return {
        "success": True,
        "message": "Projet créé avec succès !",
        "code_projet": projet_stage.code_projet,
        "intitule": projet_stage.intitule
    }


@router.get(
    "/projets",
    response_model=List[ProjetStageRead],
    status_code=status.HTTP_200_OK
)
def read_projets(
    db: Session = Depends(get_db),
    
):
    return get_all_projects(db)



@router.get("/projets/{projet_id}")
def get_project(projet_id: int, db: Session = Depends(get_db)):
    projet = db.query(Projet).get(projet_id)
    if not projet:
        raise HTTPException(status_code=404, detail="Projet non trouvé")
    return projet




