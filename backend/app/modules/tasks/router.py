from fastapi import APIRouter, Depends, Security
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.modules.tasks.schemas import TaskRead, TaskCreate, TaskUpdate, TaskStatusUpdate
from app.modules.tasks.service import TaskService
# from app.core.security import get_current_user, check_role

router = APIRouter()


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

@router.put("/{task_id}", response_model=TaskRead)
def update_task(
    task_id: int, 
    task_in: TaskUpdate, 
    db: Session = Depends(get_db),
    
):
    return TaskService.update_task(db, task_id, task_in)


@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    TaskService.delete_task(db, task_id)
    return None 


@router.get("/my-tasks", response_model=List[TaskRead])
def get_my_tasks(
    db: Session = Depends(get_db), 
    # current_user = Security(get_current_user, scopes=["stagiaire"])
):
    # return TaskService.get_tasks_for_user(db, current_user.id)
    pass  # Implémentation à venir


@router.post("/{task_id}/submit", status_code=204)
def submit_task(
    task_id: int, 
    content: str = None, 
    file_url: str = None, 
    db: Session = Depends(get_db), 
    # current_user = Security(get_current_user, scopes=["stagiaire"])
):
    # TaskService.submit_task(db, task_id, current_user.id, content, file_url)
    pass  # Implémentation à venir


