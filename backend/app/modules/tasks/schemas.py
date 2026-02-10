from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from app.shared.enums import taskStatusEnum, taskPriorityEnum

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    priority: taskPriorityEnum = taskPriorityEnum.MEDIUM
    deadline: Optional[datetime] = None
    project_id: int

class TaskCreate(TaskBase):
    stage_id: int
    encadreur_id: int

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[taskPriorityEnum] = None
    deadline: Optional[datetime] = None

class TaskStatusUpdate(BaseModel):
    status: taskStatusEnum

class TaskRead(TaskBase):
    id: int
    stage_id: int
    status: taskStatusEnum
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True