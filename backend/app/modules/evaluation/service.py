import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.modules.evaluation.models import Evaluation
from app.modules.evaluation.schemas import EvaluationCreate, EvaluationUpdate
from app.modules.notifications.service import create_notification
from app.modules.stage.models import Stage
from app.modules.tasks.models import Task
from app.shared.enums import StatutStageEnum, taskStatusEnum


class EvaluationService:
    @staticmethod
    def _utcnow_naive() -> datetime:
        return datetime.now(timezone.utc).replace(tzinfo=None)

    @staticmethod
    def _notify_stagiaire_for_evaluation(
        db: Session,
        *,
        evaluation: Evaluation,
        notification_type: str,
    ) -> None:
        if not evaluation.stagiaire_id:
            return

        is_new = notification_type == "evaluation_received"
        title = "Nouvelle evaluation" if is_new else "Evaluation mise a jour"
        note_value = f"{evaluation.note}/20" if evaluation.note is not None else "N/A"
        action = "a ete publiee" if is_new else "a ete mise a jour"
        message = f'Votre evaluation ({note_value}) {action}.'
        payload = json.dumps(
            {
                "type": notification_type,
                "evaluation_id": evaluation.id,
                "route": "/intern/mon-stage",
            },
            ensure_ascii=False,
            sort_keys=True,
        )

        try:
            create_notification(
                db,
                user_id=evaluation.stagiaire_id,
                title=title,
                message=message,
                category="evaluation",
                payload=payload,
            )
        except Exception:
            db.rollback()

    @staticmethod
    def _sanitize_comment(commentaire: str | None) -> str | None:
        if commentaire is None:
            return None
        cleaned = commentaire.strip()
        return cleaned or None

    @staticmethod
    def _get_evaluation_or_404(
        db: Session,
        evaluation_id: int,
        *,
        encadreur_id: int | None = None,
        stagiaire_id: int | None = None,
    ) -> Evaluation:
        query = db.query(Evaluation).filter(Evaluation.id == evaluation_id)
        if encadreur_id is not None:
            query = query.filter(Evaluation.encadreur_id == encadreur_id)
        if stagiaire_id is not None:
            query = query.filter(Evaluation.stagiaire_id == stagiaire_id)

        evaluation = query.first()
        if not evaluation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Evaluation introuvable",
            )
        return evaluation

    @staticmethod
    def _ensure_stage_context(
        db: Session,
        stagiaire_id: int,
        projet_id: int,
        encadreur_id: int,
    ) -> Stage:
        stage = (
            db.query(Stage)
            .filter(
                Stage.stagiaire_id == stagiaire_id,
                Stage.projet_id == projet_id,
                Stage.encadreur_id == encadreur_id,
            )
            .first()
        )
        if not stage:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ce stagiaire n'est pas rattache a ce projet sous votre encadrement",
            )
        return stage

    @staticmethod
    def _ensure_stage_tasks_completed(
        db: Session,
        stage: Stage,
    ) -> None:
        task_statuses = EvaluationService._get_stage_task_statuses(db, stage)

        if not task_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le stagiaire doit avoir au moins une tache avant l'evaluation",
            )

        completed_count = EvaluationService._count_completed_task_statuses(task_statuses)
        if completed_count != len(task_statuses):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Le stagiaire doit terminer toutes ses taches avant l'evaluation "
                    f"({completed_count}/{len(task_statuses)})"
                ),
            )

    @staticmethod
    def _get_stage_task_statuses(
        db: Session,
        stage: Stage,
    ) -> list[taskStatusEnum]:
        return [
            task_status
            for (task_status,) in (
                db.query(Task.status)
                .filter(Task.stage_id == stage.id)
                .all()
            )
        ]

    @staticmethod
    def _count_completed_task_statuses(task_statuses: list[taskStatusEnum]) -> int:
        completed_statuses = {taskStatusEnum.DONE, taskStatusEnum.VALIDATED}
        return sum(1 for task_status in task_statuses if task_status in completed_statuses)

    @staticmethod
    def _mark_stage_as_completed(stage: Stage | None) -> None:
        if not stage:
            return

        stage.statut_stage = StatutStageEnum.TERMINE
        if stage.stagiaire:
            stage.stagiaire.statut_stage = StatutStageEnum.TERMINE

    @staticmethod
    def _mark_stage_as_completed_if_ready(
        db: Session,
        stage: Stage | None,
    ) -> None:
        if not stage:
            return

        task_statuses = EvaluationService._get_stage_task_statuses(db, stage)
        if task_statuses and EvaluationService._count_completed_task_statuses(task_statuses) == len(task_statuses):
            EvaluationService._mark_stage_as_completed(stage)

    @staticmethod
    def get_all_evaluations(
        db: Session,
        *,
        skip: int = 0,
        limit: int = 100,
        stagiaire_id: int | None = None,
        projet_id: int | None = None,
        encadreur_id: int | None = None,
    ) -> list[Evaluation]:
        query = db.query(Evaluation)
        if stagiaire_id is not None:
            query = query.filter(Evaluation.stagiaire_id == stagiaire_id)
        if projet_id is not None:
            query = query.filter(Evaluation.projet_id == projet_id)
        if encadreur_id is not None:
            query = query.filter(Evaluation.encadreur_id == encadreur_id)

        return (
            query.order_by(Evaluation.created_at.desc(), Evaluation.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_evaluations_for_encadreur(
        db: Session,
        encadreur_id: int,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Evaluation]:
        return (
            db.query(Evaluation)
            .filter(Evaluation.encadreur_id == encadreur_id)
            .order_by(Evaluation.created_at.desc(), Evaluation.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_evaluations_for_stagiaire(
        db: Session,
        stagiaire_id: int,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Evaluation]:
        return (
            db.query(Evaluation)
            .filter(Evaluation.stagiaire_id == stagiaire_id)
            .order_by(Evaluation.created_at.desc(), Evaluation.id.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    @staticmethod
    def get_evaluation_by_admin(db: Session, evaluation_id: int) -> Evaluation:
        return EvaluationService._get_evaluation_or_404(db, evaluation_id)

    @staticmethod
    def get_evaluation_by_encadreur(db: Session, evaluation_id: int, encadreur_id: int) -> Evaluation:
        return EvaluationService._get_evaluation_or_404(
            db,
            evaluation_id,
            encadreur_id=encadreur_id,
        )

    @staticmethod
    def get_evaluation_by_stagiaire(db: Session, evaluation_id: int, stagiaire_id: int) -> Evaluation:
        return EvaluationService._get_evaluation_or_404(
            db,
            evaluation_id,
            stagiaire_id=stagiaire_id,
        )

    @staticmethod
    def create_evaluation(
        db: Session,
        payload: EvaluationCreate,
        encadreur_id: int,
    ) -> Evaluation:
        stage = EvaluationService._ensure_stage_context(
            db=db,
            stagiaire_id=payload.stagiaire_id,
            projet_id=payload.projet_id,
            encadreur_id=encadreur_id,
        )
        EvaluationService._ensure_stage_tasks_completed(db, stage)

        existing = (
            db.query(Evaluation)
            .filter(
                Evaluation.stagiaire_id == payload.stagiaire_id,
                Evaluation.projet_id == payload.projet_id,
                Evaluation.encadreur_id == encadreur_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Une evaluation existe deja pour ce stagiaire sur ce projet",
            )

        evaluation = Evaluation(
            stagiaire_id=payload.stagiaire_id,
            projet_id=payload.projet_id,
            encadreur_id=encadreur_id,
            note=payload.note,
            commentaire=EvaluationService._sanitize_comment(payload.commentaire),
        )
        db.add(evaluation)

        if stage.stagiaire:
            stage.stagiaire.note_finale = payload.note
            stage.stagiaire.date_validation = EvaluationService._utcnow_naive()
        EvaluationService._mark_stage_as_completed(stage)

        db.commit()
        db.refresh(evaluation)
        EvaluationService._notify_stagiaire_for_evaluation(
            db,
            evaluation=evaluation,
            notification_type="evaluation_received",
        )
        return evaluation

    @staticmethod
    def update_evaluation_by_admin(
        db: Session,
        evaluation_id: int,
        payload: EvaluationUpdate,
    ) -> Evaluation:
        evaluation = EvaluationService._get_evaluation_or_404(db, evaluation_id)
        return EvaluationService._apply_update(db, evaluation, payload)

    @staticmethod
    def update_evaluation_by_encadreur(
        db: Session,
        evaluation_id: int,
        payload: EvaluationUpdate,
        encadreur_id: int,
    ) -> Evaluation:
        evaluation = EvaluationService._get_evaluation_or_404(
            db,
            evaluation_id,
            encadreur_id=encadreur_id,
        )
        return EvaluationService._apply_update(db, evaluation, payload)

    @staticmethod
    def _apply_update(
        db: Session,
        evaluation: Evaluation,
        payload: EvaluationUpdate,
    ) -> Evaluation:
        update_data = payload.model_dump(exclude_unset=True)
        if "commentaire" in update_data:
            update_data["commentaire"] = EvaluationService._sanitize_comment(update_data["commentaire"])

        for field, value in update_data.items():
            setattr(evaluation, field, value)

        stage = (
            db.query(Stage)
            .filter(
                Stage.stagiaire_id == evaluation.stagiaire_id,
                Stage.projet_id == evaluation.projet_id,
                Stage.encadreur_id == evaluation.encadreur_id,
            )
            .first()
        )

        if evaluation.stagiaire:
            if "note" in update_data:
                evaluation.stagiaire.note_finale = update_data["note"]
            if update_data:
                evaluation.stagiaire.date_validation = EvaluationService._utcnow_naive()
        if update_data:
            EvaluationService._mark_stage_as_completed_if_ready(db, stage)

        db.commit()
        db.refresh(evaluation)
        if update_data:
            EvaluationService._notify_stagiaire_for_evaluation(
                db,
                evaluation=evaluation,
                notification_type="evaluation_updated",
            )
        return evaluation

    @staticmethod
    def delete_evaluation_by_admin(db: Session, evaluation_id: int) -> None:
        evaluation = EvaluationService._get_evaluation_or_404(db, evaluation_id)
        EvaluationService._delete_evaluation(db, evaluation)

    @staticmethod
    def delete_evaluation_by_encadreur(db: Session, evaluation_id: int, encadreur_id: int) -> None:
        evaluation = EvaluationService._get_evaluation_or_404(
            db,
            evaluation_id,
            encadreur_id=encadreur_id,
        )
        EvaluationService._delete_evaluation(db, evaluation)

    @staticmethod
    def _delete_evaluation(db: Session, evaluation: Evaluation) -> None:
        stagiaire = evaluation.stagiaire
        note = evaluation.note

        db.delete(evaluation)

        if stagiaire and stagiaire.note_finale == note:
            stagiaire.note_finale = None
            stagiaire.date_validation = None

        db.commit()
