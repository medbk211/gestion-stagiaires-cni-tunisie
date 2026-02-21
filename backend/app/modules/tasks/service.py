import json
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status
from app.modules.tasks.models import Task, Task_submission
from app.modules.notifications.models import Notification
from app.modules.notifications.service import create_notification
from app.modules.tasks.schemas import (
    TaskCreate,
    TaskUpdate,
    TaskStatusUpdate,
    TaskSubmissionCreate,
    TaskReviewDecision,
)
from app.modules.stage.models import Stage
from app.shared.enums import taskStatusEnum


class TaskService:
    DEADLINE_REMINDER_WINDOW_HOURS = 24

    @staticmethod
    def _as_utc_naive(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    @staticmethod
    def _format_deadline(deadline: datetime | None) -> str:
        if not deadline:
            return "sans deadline"
        parsed = TaskService._as_utc_naive(deadline)
        return parsed.strftime("%d/%m/%Y %H:%M")

    @staticmethod
    def _build_payload(payload: dict) -> str:
        return json.dumps(payload, ensure_ascii=False, sort_keys=True)

    @staticmethod
    def _notification_exists(db: Session, user_id: int, category: str, payload: str) -> bool:
        Notification.__table__.create(bind=db.get_bind(), checkfirst=True)
        existing = (
            db.query(Notification.id)
            .filter(
                Notification.user_id == user_id,
                Notification.category == category,
                Notification.payload == payload,
            )
            .first()
        )
        return existing is not None

    @staticmethod
    def _notify_once(
        db: Session,
        *,
        user_id: int,
        title: str,
        message: str,
        category: str,
        payload: dict,
    ) -> None:
        payload_text = TaskService._build_payload(payload)
        if TaskService._notification_exists(db, user_id, category, payload_text):
            return
        try:
            create_notification(
                db,
                user_id=user_id,
                title=title,
                message=message,
                category=category,
                payload=payload_text,
            )
        except Exception:
            db.rollback()

    @staticmethod
    def _notify_task_assigned(db: Session, task: Task, stagiaire_id: int) -> None:
        TaskService._notify_once(
            db,
            user_id=stagiaire_id,
            title="Nouvelle tache assignee",
            message=f'La tache "{task.title}" vous a ete assignee (deadline: {TaskService._format_deadline(task.deadline)}).',
            category="task_assignment",
            payload={
                "type": "task_assignment",
                "task_id": task.id,
                "route": "/intern/taches",
            },
        )

    @staticmethod
    def _notify_task_validated(db: Session, task: Task, stagiaire_id: int) -> None:
        TaskService._notify_once(
            db,
            user_id=stagiaire_id,
            title="Tache validee",
            message=f'Votre tache "{task.title}" a ete validee.',
            category="task_status",
            payload={
                "type": "task_validated",
                "task_id": task.id,
                "route": "/intern/taches",
            },
        )

    @staticmethod
    def _notify_task_changes_requested(db: Session, task: Task, stagiaire_id: int) -> None:
        TaskService._notify_once(
            db,
            user_id=stagiaire_id,
            title="Corrections demandees",
            message=f'Des corrections sont demandees pour la tache "{task.title}".',
            category="task_status",
            payload={
                "type": "task_changes_requested",
                "task_id": task.id,
                "route": "/intern/taches",
            },
        )

    @staticmethod
    def _get_stagiaire_label(task: Task) -> str:
        stage = task.stage
        if not stage:
            return "Le stagiaire"
        stagiaire = getattr(stage, "stagiaire", None)
        if not stagiaire:
            return f"Le stagiaire #{stage.stagiaire_id}"
        prenom = (getattr(stagiaire, "prenom", "") or "").strip()
        nom = (getattr(stagiaire, "nom", "") or "").strip()
        full_name = f"{prenom} {nom}".strip()
        if full_name:
            return full_name
        email = (getattr(stagiaire, "email", "") or "").strip()
        if email:
            return email
        return f"Le stagiaire #{stage.stagiaire_id}"

    @staticmethod
    def _notify_encadreur_task_started(db: Session, task: Task, encadreur_id: int) -> None:
        stagiaire_id = task.stage.stagiaire_id if task.stage else None
        TaskService._notify_once(
            db,
            user_id=encadreur_id,
            title="Tache demarree",
            message=f'{TaskService._get_stagiaire_label(task)} a commence la tache "{task.title}".',
            category="task_progress",
            payload={
                "type": "task_started",
                "task_id": task.id,
                "stagiaire_id": stagiaire_id,
                "route": "/encadreur/tasks",
            },
        )

    @staticmethod
    def _notify_encadreur_task_paused(db: Session, task: Task, encadreur_id: int) -> None:
        stagiaire_id = task.stage.stagiaire_id if task.stage else None
        TaskService._notify_once(
            db,
            user_id=encadreur_id,
            title="Tache remise en attente",
            message=f'{TaskService._get_stagiaire_label(task)} a remis la tache "{task.title}" en attente.',
            category="task_progress",
            payload={
                "type": "task_paused",
                "task_id": task.id,
                "stagiaire_id": stagiaire_id,
                "route": "/encadreur/tasks",
            },
        )

    @staticmethod
    def _notify_encadreur_task_submitted(db: Session, task: Task, encadreur_id: int) -> None:
        stagiaire_id = task.stage.stagiaire_id if task.stage else None
        TaskService._notify_once(
            db,
            user_id=encadreur_id,
            title="Nouvelle soumission de tache",
            message=f'{TaskService._get_stagiaire_label(task)} a soumis "{task.title}" pour review.',
            category="task_submission",
            payload={
                "type": "task_submitted",
                "task_id": task.id,
                "stagiaire_id": stagiaire_id,
                "route": "/encadreur/tasks",
            },
        )

    @staticmethod
    def _emit_deadline_notifications_for_tasks(
        db: Session,
        tasks: list[Task],
        stagiaire_id: int,
    ) -> None:
        now = datetime.utcnow()
        reminder_window = timedelta(hours=TaskService.DEADLINE_REMINDER_WINDOW_HOURS)

        for task in tasks:
            if not task.deadline:
                continue
            if task.status in {taskStatusEnum.VALIDATED, taskStatusEnum.DONE}:
                continue

            deadline = TaskService._as_utc_naive(task.deadline)
            deadline_iso = deadline.isoformat()
            if deadline <= now:
                TaskService._notify_once(
                    db,
                    user_id=stagiaire_id,
                    title="Retard sur tache",
                    message=f'La tache "{task.title}" a depasse sa deadline ({TaskService._format_deadline(task.deadline)}).',
                    category="task_deadline",
                    payload={
                        "type": "task_overdue",
                        "task_id": task.id,
                        "deadline_at": deadline_iso,
                        "route": "/intern/taches",
                    },
                )
                continue

            remaining = deadline - now
            if remaining <= reminder_window:
                TaskService._notify_once(
                    db,
                    user_id=stagiaire_id,
                    title="Rappel deadline",
                    message=f'La deadline de "{task.title}" approche ({TaskService._format_deadline(task.deadline)}).',
                    category="task_deadline",
                    payload={
                        "type": "task_deadline_reminder",
                        "task_id": task.id,
                        "deadline_at": deadline_iso,
                        "route": "/intern/taches",
                    },
                )

    @staticmethod
    def emit_deadline_notifications_for_stagiaire(db: Session, stagiaire_id: int) -> None:
        tasks = (
            db.query(Task)
            .join(Stage, Task.stage_id == Stage.id)
            .filter(Stage.stagiaire_id == stagiaire_id)
            .all()
        )
        TaskService._emit_deadline_notifications_for_tasks(db, tasks, stagiaire_id)

    @staticmethod
    def _emit_deadline_notifications_for_encadreur_tasks(
        db: Session,
        tasks: list[Task],
        encadreur_id: int,
    ) -> None:
        now = datetime.utcnow()
        reminder_window = timedelta(hours=TaskService.DEADLINE_REMINDER_WINDOW_HOURS)

        for task in tasks:
            if not task.deadline:
                continue
            if task.status in {taskStatusEnum.VALIDATED, taskStatusEnum.DONE}:
                continue

            deadline = TaskService._as_utc_naive(task.deadline)
            deadline_iso = deadline.isoformat()
            stagiaire_id = task.stage.stagiaire_id if task.stage else None
            if deadline <= now:
                TaskService._notify_once(
                    db,
                    user_id=encadreur_id,
                    title="Retard stagiaire",
                    message=f'{TaskService._get_stagiaire_label(task)} est en retard sur "{task.title}" ({TaskService._format_deadline(task.deadline)}).',
                    category="task_deadline",
                    payload={
                        "type": "task_overdue_encadreur",
                        "task_id": task.id,
                        "stagiaire_id": stagiaire_id,
                        "deadline_at": deadline_iso,
                        "route": "/encadreur/tasks",
                    },
                )
                continue

            remaining = deadline - now
            if remaining <= reminder_window:
                TaskService._notify_once(
                    db,
                    user_id=encadreur_id,
                    title="Rappel deadline stagiaire",
                    message=f'{TaskService._get_stagiaire_label(task)} doit terminer "{task.title}" avant {TaskService._format_deadline(task.deadline)}.',
                    category="task_deadline",
                    payload={
                        "type": "task_deadline_reminder_encadreur",
                        "task_id": task.id,
                        "stagiaire_id": stagiaire_id,
                        "deadline_at": deadline_iso,
                        "route": "/encadreur/tasks",
                    },
                )

    @staticmethod
    def emit_deadline_notifications_for_encadreur(db: Session, encadreur_id: int) -> None:
        tasks = (
            db.query(Task)
            .join(Stage, Task.stage_id == Stage.id)
            .filter(Stage.encadreur_id == encadreur_id)
            .all()
        )
        TaskService._emit_deadline_notifications_for_encadreur_tasks(db, tasks, encadreur_id)

    @staticmethod
    def _parse_submission_content(content: str | None) -> dict:
        if not content:
            return {}
        try:
            parsed = json.loads(content)
            if isinstance(parsed, dict):
                return parsed
            return {}
        except Exception:
            return {"notes": content}

    @staticmethod
    def _serialize_submission(submission: Task_submission) -> dict:
        meta = TaskService._parse_submission_content(submission.content)
        reviewed_at = meta.get("reviewed_at")
        parsed_reviewed_at = None
        if isinstance(reviewed_at, str):
            try:
                parsed_reviewed_at = datetime.fromisoformat(reviewed_at)
            except Exception:
                parsed_reviewed_at = None

        return {
            "id": submission.id,
            "task_id": submission.task_id,
            "stagiaire_id": submission.stagiaire_id,
            "github_url": meta.get("github_url") or "",
            "file_url": submission.file_url or "",
            "notes": meta.get("notes"),
            "decision": meta.get("decision"),
            "review_feedback": meta.get("review_feedback"),
            "submitted_at": submission.submitted_at,
            "reviewed_at": parsed_reviewed_at,
        }

    @staticmethod
    def _get_latest_submission(db: Session, task_id: int) -> Task_submission | None:
        return (
            db.query(Task_submission)
            .filter(Task_submission.task_id == task_id)
            .order_by(Task_submission.submitted_at.desc(), Task_submission.id.desc())
            .first()
        )

    @staticmethod
    def get_task_by_id(db: Session, task_id: int) -> Task | None:
        return (
            db.query(Task)
            .options(joinedload(Task.stage))
            .filter(Task.id == task_id)
            .first()
        )

    @staticmethod
    def get_stage_tasks(db: Session, stage_id: int):
        return db.query(Task).filter(Task.stage_id == stage_id).all()

    @staticmethod
    def get_tasks_for_encadreur(db: Session, encadreur_id: int):
        tasks = (
            db.query(Task)
            .join(Stage, Task.stage_id == Stage.id)
            .filter(Stage.encadreur_id == encadreur_id)
            .all()
        )
        TaskService._emit_deadline_notifications_for_encadreur_tasks(db, tasks, encadreur_id)
        return tasks

    @staticmethod
    def get_tasks_for_stagiaire(db: Session, stagiaire_id: int):
        tasks = (
            db.query(Task)
            .join(Stage, Task.stage_id == Stage.id)
            .filter(Stage.stagiaire_id == stagiaire_id)
            .all()
        )
        TaskService._emit_deadline_notifications_for_tasks(db, tasks, stagiaire_id)
        return tasks

    @staticmethod
    def _ensure_encadreur_owns_stage(db: Session, stage_id: int, encadreur_id: int) -> Stage:
        stage = db.query(Stage).filter(Stage.id == stage_id).first()
        if not stage:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Stage introuvable")
        if stage.encadreur_id != encadreur_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vous ne pouvez gerer que les taches de vos propres stagiaires",
            )
        return stage

    @staticmethod
    def _ensure_encadreur_owns_task(db: Session, task_id: int, encadreur_id: int) -> Task:
        task = (
            db.query(Task)
            .join(Stage, Task.stage_id == Stage.id)
            .filter(Task.id == task_id)
            .first()
        )
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        if task.stage.encadreur_id != encadreur_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vous ne pouvez gerer que les taches de vos propres stagiaires",
            )
        return task

    @staticmethod
    def _ensure_stagiaire_owns_task(db: Session, task_id: int, stagiaire_id: int) -> Task:
        task = (
            db.query(Task)
            .join(Stage, Task.stage_id == Stage.id)
            .filter(Task.id == task_id)
            .first()
        )
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task introuvable")
        if task.stage.stagiaire_id != stagiaire_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Vous ne pouvez modifier que vos propres taches",
            )
        return task

    @staticmethod
    def create_task_for_encadreur(db: Session, task_data: TaskCreate, encadreur_id: int):
        stage = TaskService._ensure_encadreur_owns_stage(db, task_data.stage_id, encadreur_id)

        payload = task_data.model_dump()
        payload["created_by"] = encadreur_id
        payload["projet_id"] = payload.pop("project_id")
        payload.pop("encadreur_id", None)

        new_task = Task(**payload)
        db.add(new_task)
        db.commit()
        db.refresh(new_task)
        if stage.stagiaire_id:
            TaskService._notify_task_assigned(db, new_task, stage.stagiaire_id)
        return new_task

    @staticmethod
    def update_task_status(db: Session, task_id: int, status_data: TaskStatusUpdate, encadreur_id: int):
        task = TaskService._ensure_encadreur_owns_task(db, task_id, encadreur_id)
        previous_status = task.status
        task.status = status_data.status
        db.commit()
        db.refresh(task)
        stagiaire_id = task.stage.stagiaire_id if task.stage else None
        if stagiaire_id and previous_status != task.status:
            if task.status == taskStatusEnum.VALIDATED:
                TaskService._notify_task_validated(db, task, stagiaire_id)
            elif previous_status == taskStatusEnum.DONE and task.status == taskStatusEnum.IN_PROGRESS:
                TaskService._notify_task_changes_requested(db, task, stagiaire_id)
        return task

    @staticmethod
    def update_task_status_for_stagiaire(
        db: Session, task_id: int, status_data: TaskStatusUpdate, stagiaire_id: int
    ):
        task = TaskService._ensure_stagiaire_owns_task(db, task_id, stagiaire_id)
        current_status = task.status
        target_status = status_data.status

        allowed_transitions = {
            taskStatusEnum.TODO: {taskStatusEnum.IN_PROGRESS},
            taskStatusEnum.IN_PROGRESS: {taskStatusEnum.TODO},
            taskStatusEnum.DONE: set(),
            taskStatusEnum.VALIDATED: set(),
        }

        if target_status == taskStatusEnum.VALIDATED:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Le stagiaire ne peut pas valider une tache",
            )
        if target_status == taskStatusEnum.DONE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Utilisez la soumission pour review afin de terminer la tache",
            )

        if target_status not in allowed_transitions.get(current_status, set()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Transition de statut non autorisee",
            )

        task.status = target_status
        db.commit()
        db.refresh(task)
        encadreur_id = task.stage.encadreur_id if task.stage else None
        if encadreur_id and current_status != target_status:
            if target_status == taskStatusEnum.IN_PROGRESS:
                TaskService._notify_encadreur_task_started(db, task, encadreur_id)
            elif target_status == taskStatusEnum.TODO:
                TaskService._notify_encadreur_task_paused(db, task, encadreur_id)
        return task

    @staticmethod
    def submit_task_for_review(
        db: Session, task_id: int, submission_data: TaskSubmissionCreate, stagiaire_id: int
    ):
        task = TaskService._ensure_stagiaire_owns_task(db, task_id, stagiaire_id)

        if task.status not in {taskStatusEnum.IN_PROGRESS, taskStatusEnum.DONE}:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La tache doit etre en cours avant soumission",
            )

        payload = {
            "github_url": submission_data.github_url.strip(),
            "notes": (submission_data.content or "").strip() or None,
        }

        submission = Task_submission(
            task_id=task.id,
            stagiaire_id=stagiaire_id,
            file_url=submission_data.file_url.strip(),
            content=json.dumps(payload),
            submitted_at=datetime.utcnow(),
        )
        db.add(submission)

        # "done" means submitted and waiting for encadreur review.
        task.status = taskStatusEnum.DONE
        db.commit()
        db.refresh(task)
        encadreur_id = task.stage.encadreur_id if task.stage else None
        if encadreur_id:
            TaskService._notify_encadreur_task_submitted(db, task, encadreur_id)
        return task

    @staticmethod
    def get_latest_submission_for_stagiaire(db: Session, task_id: int, stagiaire_id: int):
        task = TaskService._ensure_stagiaire_owns_task(db, task_id, stagiaire_id)
        submission = TaskService._get_latest_submission(db, task.id)
        if not submission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucune soumission trouvee pour cette tache",
            )
        return TaskService._serialize_submission(submission)

    @staticmethod
    def get_latest_submission_for_encadreur(db: Session, task_id: int, encadreur_id: int):
        task = TaskService._ensure_encadreur_owns_task(db, task_id, encadreur_id)
        submission = TaskService._get_latest_submission(db, task.id)
        if not submission:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Aucune soumission trouvee pour cette tache",
            )
        return TaskService._serialize_submission(submission)

    @staticmethod
    def review_task_submission(
        db: Session, task_id: int, review_data: TaskReviewDecision, encadreur_id: int
    ):
        task = TaskService._ensure_encadreur_owns_task(db, task_id, encadreur_id)
        previous_status = task.status
        submission = TaskService._get_latest_submission(db, task.id)
        if not submission:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible de reviewer une tache sans soumission",
            )

        if task.status != taskStatusEnum.DONE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La tache doit etre en attente de review",
            )

        feedback = (review_data.feedback or "").strip()
        if review_data.decision == "changes_requested" and not feedback:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le feedback est obligatoire si vous demandez des corrections",
            )

        meta = TaskService._parse_submission_content(submission.content)
        meta["decision"] = review_data.decision
        meta["review_feedback"] = feedback or None
        meta["reviewed_at"] = datetime.utcnow().isoformat()
        meta["reviewed_by"] = encadreur_id
        submission.content = json.dumps(meta)

        if review_data.decision == "approved":
            task.status = taskStatusEnum.VALIDATED
        else:
            task.status = taskStatusEnum.IN_PROGRESS

        db.commit()
        db.refresh(task)
        stagiaire_id = task.stage.stagiaire_id if task.stage else None
        if stagiaire_id and previous_status != task.status:
            if task.status == taskStatusEnum.VALIDATED:
                TaskService._notify_task_validated(db, task, stagiaire_id)
            elif task.status == taskStatusEnum.IN_PROGRESS:
                TaskService._notify_task_changes_requested(db, task, stagiaire_id)
        return task

    @staticmethod
    def validate_task(db: Session, task_id: int, encadreur_id: int):
        task = TaskService._ensure_encadreur_owns_task(db, task_id, encadreur_id)
        previous_status = task.status
        task.status = taskStatusEnum.VALIDATED
        db.commit()
        db.refresh(task)
        stagiaire_id = task.stage.stagiaire_id if task.stage else None
        if stagiaire_id and previous_status != task.status:
            TaskService._notify_task_validated(db, task, stagiaire_id)
        return task

    @staticmethod
    def delete_task(db: Session, task_id: int, encadreur_id: int):
        task = TaskService._ensure_encadreur_owns_task(db, task_id, encadreur_id)
        db.delete(task)
        db.commit()
        return None

    @staticmethod
    def update_task(db: Session, task_id: int, task_data: TaskUpdate, encadreur_id: int):
        task = TaskService._ensure_encadreur_owns_task(db, task_id, encadreur_id)
        for key, value in task_data.model_dump(exclude_unset=True).items():
            setattr(task, key, value)
        db.commit()
        db.refresh(task)
        return task
