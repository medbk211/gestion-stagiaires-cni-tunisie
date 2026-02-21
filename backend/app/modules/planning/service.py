from datetime import date, datetime, time, timedelta

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.modules.planning.models import PlanningEvent
from app.modules.planning.schemas import PlanningEventCreate, PlanningEventUpdate
from app.modules.stage.models import Stage
from app.modules.stagiaires.models import Stagiaire
from app.modules.tasks.models import Task
from app.shared.enums import taskStatusEnum


class PlanningService:
    @staticmethod
    def _resolve_week_start(reference: date | None) -> date:
        target = reference or datetime.utcnow().date()
        return target - timedelta(days=target.weekday())

    @staticmethod
    def _range_bounds(start_day: date, end_day: date) -> tuple[datetime, datetime]:
        start_dt = datetime.combine(start_day, time.min)
        end_dt = datetime.combine(end_day, time.max)
        return start_dt, end_dt

    @staticmethod
    def _build_stagiaire_name(stagiaire: Stagiaire | None) -> str | None:
        if stagiaire is None:
            return None
        full_name = f"{stagiaire.prenom or ''} {stagiaire.nom or ''}".strip()
        return full_name or None

    @staticmethod
    def _ensure_stagiaire_exists(db: Session, stagiaire_id: int):
        stagiaire = db.query(Stagiaire).filter(Stagiaire.id == stagiaire_id).first()
        if not stagiaire:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stagiaire introuvable",
            )
        return stagiaire

    @staticmethod
    def _ensure_stagiaire_belongs_to_encadreur(db: Session, encadreur_id: int, stagiaire_id: int):
        PlanningService._ensure_stagiaire_exists(db, stagiaire_id)

        linked_stage = (
            db.query(Stage.id)
            .filter(
                Stage.encadreur_id == encadreur_id,
                Stage.stagiaire_id == stagiaire_id,
            )
            .first()
        )
        if linked_stage:
            return

        linked_direct = (
            db.query(Stagiaire.id)
            .filter(
                Stagiaire.id == stagiaire_id,
                Stagiaire.encadreur_id == encadreur_id,
            )
            .first()
        )
        if linked_direct:
            return

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Vous ne pouvez planifier que pour vos stagiaires",
        )

    @staticmethod
    def _ensure_event_owned_by_encadreur(db: Session, event_id: int, encadreur_id: int) -> PlanningEvent:
        event = (
            db.query(PlanningEvent)
            .filter(
                PlanningEvent.id == event_id,
                PlanningEvent.encadreur_id == encadreur_id,
            )
            .first()
        )
        if not event:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Evenement planning introuvable",
            )
        return event

    @staticmethod
    def get_events_for_week(db: Session, encadreur_id: int, week_start: date):
        week_end = week_start + timedelta(days=6)
        start_dt, end_dt = PlanningService._range_bounds(week_start, week_end)

        return (
            db.query(PlanningEvent)
            .filter(
                PlanningEvent.encadreur_id == encadreur_id,
                PlanningEvent.start_at <= end_dt,
                or_(
                    PlanningEvent.end_at.is_(None),
                    PlanningEvent.end_at >= start_dt,
                ),
            )
            .order_by(PlanningEvent.start_at.asc(), PlanningEvent.id.asc())
            .all()
        )

    @staticmethod
    def get_deadlines_for_week(db: Session, encadreur_id: int, week_start: date):
        week_end = week_start + timedelta(days=6)
        start_dt, end_dt = PlanningService._range_bounds(week_start, week_end)

        rows = (
            db.query(Task, Stagiaire)
            .join(Stage, Task.stage_id == Stage.id)
            .outerjoin(Stagiaire, Stage.stagiaire_id == Stagiaire.id)
            .filter(
                Stage.encadreur_id == encadreur_id,
                Task.deadline.is_not(None),
                Task.deadline >= start_dt,
                Task.deadline <= end_dt,
                Task.status != taskStatusEnum.VALIDATED,
            )
            .order_by(Task.deadline.asc(), Task.id.asc())
            .all()
        )

        return [
            {
                "task_id": task.id,
                "title": task.title,
                "deadline": task.deadline,
                "priority": task.priority,
                "status": task.status,
                "stagiaire_id": stagiaire.id if stagiaire else None,
                "stagiaire_nom_complet": PlanningService._build_stagiaire_name(stagiaire),
                "stage_id": task.stage_id,
            }
            for task, stagiaire in rows
            if task.deadline is not None
        ]

    @staticmethod
    def get_week_overview(db: Session, encadreur_id: int, week_start_in: date | None):
        week_start = PlanningService._resolve_week_start(week_start_in)
        week_end = week_start + timedelta(days=6)

        events = PlanningService.get_events_for_week(db, encadreur_id, week_start)
        deadlines = PlanningService.get_deadlines_for_week(db, encadreur_id, week_start)

        return {
            "week_start": week_start,
            "week_end": week_end,
            "events": events,
            "deadlines": deadlines,
        }

    @staticmethod
    def create_event(db: Session, event_in: PlanningEventCreate, encadreur_id: int):
        payload = event_in.model_dump()

        stagiaire_id = payload.get("stagiaire_id")
        if stagiaire_id is not None:
            PlanningService._ensure_stagiaire_belongs_to_encadreur(db, encadreur_id, stagiaire_id)

        new_event = PlanningEvent(
            **payload,
            encadreur_id=encadreur_id,
        )
        db.add(new_event)
        db.commit()
        db.refresh(new_event)
        return new_event

    @staticmethod
    def update_event(db: Session, event_id: int, event_in: PlanningEventUpdate, encadreur_id: int):
        event = PlanningService._ensure_event_owned_by_encadreur(db, event_id, encadreur_id)
        payload = event_in.model_dump(exclude_unset=True)

        if not payload:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aucune donnee a mettre a jour",
            )

        if "stagiaire_id" in payload and payload["stagiaire_id"] is not None:
            PlanningService._ensure_stagiaire_belongs_to_encadreur(
                db,
                encadreur_id,
                payload["stagiaire_id"],
            )

        merged_start_at = payload.get("start_at", event.start_at)
        merged_end_at = payload.get("end_at", event.end_at)
        if merged_end_at is not None and merged_end_at <= merged_start_at:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La date de fin doit etre apres la date de debut",
            )

        for key, value in payload.items():
            setattr(event, key, value)

        db.commit()
        db.refresh(event)
        return event

    @staticmethod
    def delete_event(db: Session, event_id: int, encadreur_id: int):
        event = PlanningService._ensure_event_owned_by_encadreur(db, event_id, encadreur_id)
        db.delete(event)
        db.commit()
        return None
