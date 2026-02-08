from fastapi import APIRouter, Depends, Security
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.modules.tasks.schemas import TaskRead, TaskCreate, TaskUpdate, TaskStatusUpdate
from app.modules.tasks.service import TaskService
# from app.api.dependencies.auth import get_current_user, check_role

router = APIRouter()

# GET /stages/{stage_id}/tasks est souvent mis dans le router de Stage, 
# mais voici les endpoints directs :

@router.get("/{task_id}", response_model=TaskRead)
def get_task(task_id: int, db: Session = Depends(get_db)):
    return TaskService.get_task_by_id(db, task_id)

@router.post("/", response_model=TaskRead)
def create_task(
    task_in: TaskCreate, 
    db: Session = Depends(get_db), 
   
):
    return TaskService.create_task(db, task_in)

@router.patch("/{task_id}/status", response_model=TaskRead)
def update_status(
    task_id: int, 
    status_in: TaskStatusUpdate, 
    db: Session = Depends(get_db),
    
):
    return TaskService.update_task_status(db, task_id, status_in)

@router.patch("/{task_id}/validate", response_model=TaskRead)
def validate_task(
    task_id: int, 
    db: Session = Depends(get_db),
   
):
    return TaskService.validate_task(db, task_id)