from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.modules.projet_stage.schemas import (
    ProjetStageCreate,
    ProjetStageRead,
    ProjetStageUpdate,
)
from app.modules.projet_stage.service import (
    create_projet_stage,
    get_all_projects,
    get_project,
    update_project,
    delete_project,
)

router = APIRouter()


@router.post("/projets", status_code=status.HTTP_201_CREATED)
def create_projet(projet_data: ProjetStageCreate, db: Session = Depends(get_db)):
    projet_stage = create_projet_stage(db, projet_data)
    return {
        "success": True,
        "message": "Projet créé avec succès !",
        "code_projet": projet_stage.code_projet,
        "intitule": projet_stage.intitule,
    }


@router.get(
    "/projets",
    response_model=List[ProjetStageRead],
    status_code=status.HTTP_200_OK,
)
def read_projets(db: Session = Depends(get_db)):
    return get_all_projects(db)


@router.get(
    "/projets/{projet_id}",
    response_model=ProjetStageRead,
    status_code=status.HTTP_200_OK,
)
def read_projet(projet_id: int, db: Session = Depends(get_db)):
    projet = get_project(db, projet_id)
    return projet


@router.put(
    "/projets/{projet_id}",
    response_model=ProjetStageRead,
    status_code=status.HTTP_200_OK,
)
def update_projet(projet_id: int, projet_data: ProjetStageUpdate, db: Session = Depends(get_db)):
    return update_project(db, projet_id, projet_data)


@router.delete("/projets/{projet_id}", status_code=status.HTTP_200_OK)
def remove_projet(projet_id: int, db: Session = Depends(get_db)):
    return delete_project(db, projet_id)




