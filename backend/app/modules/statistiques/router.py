from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.modules.statistiques.schemas import DashboardStatsRead, EncadreurOverviewRead
from app.modules.statistiques.service import get_dashboard_stats, get_encadreur_overview
from app.modules.utilisateur.models import Utilisateur
from app.shared.enums import RoleEnum

router = APIRouter()


@router.get(
    '/dashboard',
    response_model=DashboardStatsRead,
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def dashboard_stats(db: Session = Depends(get_db)):
    return get_dashboard_stats(db)


@router.get(
    '/dashboard/filtre',
    response_model=DashboardStatsRead,
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def dashboard_stats_filtered(
    start_date: date | None = None,
    end_date: date | None = None,
    departement: str | None = None,
    encadreur_id: int | None = None,
    db: Session = Depends(get_db),
):
    return get_dashboard_stats(
        db,
        start_date=start_date,
        end_date=end_date,
        departement=departement,
        encadreur_id=encadreur_id,
    )


@router.get(
    '/encadreur/overview',
    response_model=EncadreurOverviewRead,
    dependencies=[Depends(require_role(RoleEnum.ENCADREUR, RoleEnum.ADMIN))],
)
def encadreur_overview(
    encadreur_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    target_id = encadreur_id if current_user.role == RoleEnum.ADMIN and encadreur_id else current_user.id
    return get_encadreur_overview(db, target_id)
