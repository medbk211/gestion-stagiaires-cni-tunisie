from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.modules.stage.schemas import StageRead, StageCreate, StageUpdate
from app.modules.stage.service import (
    get_stage,
    get_all_stages,
    create_stage,
    update_stage,
    delete_stage
)

router = APIRouter()

@router.post("/", response_model=StageRead, status_code=status.HTTP_201_CREATED)
def create_new_stage(stage: StageCreate, db: Session = Depends(get_db)):
    return create_stage(db, stage)

@router.get("/", response_model=List[StageRead])
def list_all_stages(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return get_all_stages(db, skip, limit)

@router.get("/{stage_id}", response_model=StageRead)
def read_stage(stage_id: int, db: Session = Depends(get_db)):
    stage = get_stage(db, stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail="Stage introuvable")
    return stage

@router.put("/{stage_id}", response_model=StageRead)
def update_existing_stage(stage_id: int, stage_in: StageUpdate, db: Session = Depends(get_db)):
    stage = update_stage(db, stage_id, stage_in)
    if not stage:
        raise HTTPException(status_code=404, detail="Stage introuvable")
    return stage

@router.delete("/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existing_stage(stage_id: int, db: Session = Depends(get_db)):
    success = delete_stage(db, stage_id)
    if not success:
        raise HTTPException(status_code=404, detail="Stage introuvable")
    return None
