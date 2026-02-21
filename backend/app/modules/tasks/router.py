from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.modules.tasks.schemas import (
    TaskRead,
    TaskCreate,
    TaskUpdate,
    TaskStatusUpdate,
    TaskSubmissionCreate,
    TaskSubmissionRead,
    TaskReviewDecision,
)
from app.modules.tasks.service import TaskService
from app.core.security import require_role, get_current_user
from app.shared.enums import RoleEnum

router = APIRouter()


@router.get(
    "/my-tasks",
    response_model=List[TaskRead],
    response_model_by_alias=False,
    dependencies=[Depends(require_role(RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def get_my_tasks(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role == RoleEnum.STAGIAIRE:
        return TaskService.get_tasks_for_stagiaire(db, current_user.id)
    return TaskService.get_tasks_for_encadreur(db, current_user.id)


@router.post(
    "/",
    response_model=TaskRead,
    response_model_by_alias=False,
    dependencies=[Depends(require_role(RoleEnum.ENCADREUR))],
)
def create_task(
    task_in: TaskCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return TaskService.create_task_for_encadreur(db, task_in, current_user.id)


@router.patch(
    "/{task_id}/status",
    response_model=TaskRead,
    response_model_by_alias=False,
    dependencies=[Depends(require_role(RoleEnum.ENCADREUR))],
)
def update_status(
    task_id: int,
    status_in: TaskStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return TaskService.update_task_status(db, task_id, status_in, current_user.id)


@router.patch(
    "/{task_id}/my-status",
    response_model=TaskRead,
    response_model_by_alias=False,
    dependencies=[Depends(require_role(RoleEnum.STAGIAIRE))],
)
def update_my_task_status(
    task_id: int,
    status_in: TaskStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return TaskService.update_task_status_for_stagiaire(db, task_id, status_in, current_user.id)


@router.post(
    "/{task_id}/submit",
    response_model=TaskRead,
    response_model_by_alias=False,
    dependencies=[Depends(require_role(RoleEnum.STAGIAIRE))],
)
def submit_task_for_review(
    task_id: int,
    submission_in: TaskSubmissionCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return TaskService.submit_task_for_review(db, task_id, submission_in, current_user.id)


@router.get(
    "/{task_id}/latest-submission",
    response_model=TaskSubmissionRead,
    response_model_by_alias=False,
    dependencies=[Depends(require_role(RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def get_latest_submission(
    task_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role == RoleEnum.STAGIAIRE:
        return TaskService.get_latest_submission_for_stagiaire(db, task_id, current_user.id)
    return TaskService.get_latest_submission_for_encadreur(db, task_id, current_user.id)


@router.post(
    "/{task_id}/review",
    response_model=TaskRead,
    response_model_by_alias=False,
    dependencies=[Depends(require_role(RoleEnum.ENCADREUR))],
)
def review_task_submission(
    task_id: int,
    review_in: TaskReviewDecision,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return TaskService.review_task_submission(db, task_id, review_in, current_user.id)


@router.patch(
    "/{task_id}/validate",
    response_model=TaskRead,
    response_model_by_alias=False,
    dependencies=[Depends(require_role(RoleEnum.ENCADREUR))],
)
def validate_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return TaskService.validate_task(db, task_id, current_user.id)


@router.put(
    "/{task_id}",
    response_model=TaskRead,
    response_model_by_alias=False,
    dependencies=[Depends(require_role(RoleEnum.ENCADREUR))],
)
def update_task(
    task_id: int,
    task_in: TaskUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return TaskService.update_task(db, task_id, task_in, current_user.id)


@router.delete(
    "/{task_id}",
    status_code=200,
    dependencies=[Depends(require_role(RoleEnum.ENCADREUR))],
)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    TaskService.delete_task(db, task_id, current_user.id)
    return {"message": "Task deleted successfully"}


@router.get("/{task_id}", response_model=TaskRead, response_model_by_alias=False)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if current_user.role == RoleEnum.ENCADREUR:
        return TaskService._ensure_encadreur_owns_task(db, task_id, current_user.id)
    return TaskService._ensure_stagiaire_owns_task(db, task_id, current_user.id)
