from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.modules.tasks.models import Task
from app.modules.tasks.schemas import TaskCreate, TaskUpdate, TaskStatusUpdate

class TaskService:
    @staticmethod
    def get_stage_tasks(db: Session, stage_id: int):
        return db.query(Task).filter(Task.stage_id == stage_id).all()

    @staticmethod
    def create_task(db: Session, task_data: TaskCreate):
        new_task = Task(**task_data.model_dump())
        db.add(new_task)
        db.commit()
        db.refresh(new_task)
        return new_task

    @staticmethod
    def update_task_status(db: Session, task_id: int, status_data: TaskStatusUpdate):
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        task.status = status_data.status
        db.commit()
        return task

    @staticmethod
    def validate_task(db: Session, task_id: int):
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        task.status = "VALIDATED" # Ou un enum spécifique si existant
        db.commit()
        return task
    @staticmethod
    def delete_task(task_id:int , db:Session):
        task = db.query(Task).filter(Task.id == task_id).first

        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        db.delete(task)
        db.commit()
        return None
    
    @staticmethod
    def update_task(db: Session, task_id: int, task_data: TaskUpdate):  
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        for key, value in task_data.model_dump(exclude_unset=True).items():
            setattr(task, key, value)
        
        db.commit()
        return task


      