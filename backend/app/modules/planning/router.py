from datetime import date

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.modules.planning.schemas import (
    PlanningEventCreate,
    PlanningEventRead,
    PlanningEventUpdate,
    PlanningWeekOverview,
)
from app.modules.planning.service import PlanningService
from app.shared.enums import RoleEnum

router = APIRouter()


@router.get(
    "/overview",
    response_model=PlanningWeekOverview,
    response_model_by_alias=False,
    dependencies=[Depends(require_role(RoleEnum.ENCADREUR))],
)
def get_planning_overview(
    week_start: date | None = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return PlanningService.get_week_overview(db, current_user.id, week_start)


@router.post(
    "/events",
    response_model=PlanningEventRead,
    response_model_by_alias=False,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(RoleEnum.ENCADREUR))],
)
def create_planning_event(
    event_in: PlanningEventCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return PlanningService.create_event(db, event_in, current_user.id)


@router.put(
    "/events/{event_id}",
    response_model=PlanningEventRead,
    response_model_by_alias=False,
    dependencies=[Depends(require_role(RoleEnum.ENCADREUR))],
)
def update_planning_event(
    event_id: int,
    event_in: PlanningEventUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return PlanningService.update_event(db, event_id, event_in, current_user.id)


@router.delete(
    "/events/{event_id}",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_role(RoleEnum.ENCADREUR))],
)
def delete_planning_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    PlanningService.delete_event(db, event_id, current_user.id)
    return {"message": "Planning event deleted successfully"}
