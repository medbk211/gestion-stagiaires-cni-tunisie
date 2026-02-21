from datetime import date

from sqlalchemy.orm import Session

from app.modules.statistiques.service import get_dashboard_stats, get_encadreur_overview


def get_dashboard_stats_repository(
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
    departement: str | None = None,
    encadreur_id: int | None = None,
):
    return get_dashboard_stats(
        db,
        start_date=start_date,
        end_date=end_date,
        departement=departement,
        encadreur_id=encadreur_id,
    )


def get_encadreur_overview_repository(db: Session, encadreur_id: int):
    return get_encadreur_overview(db, encadreur_id)
