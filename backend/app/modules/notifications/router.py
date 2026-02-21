from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.modules.notifications.schemas import NotificationRead, NotificationUnreadCount
from app.modules.notifications.service import (
    list_user_notifications,
    mark_all_as_read,
    mark_as_read,
    unread_count,
)
from app.modules.utilisateur.models import Utilisateur
from app.shared.enums import RoleEnum

router = APIRouter(prefix='/notifications', tags=['Notifications'])


@router.get(
    '/me',
    response_model=list[NotificationRead],
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def mes_notifications(
    skip: int = 0,
    limit: int = 20,
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    role_value = (
        current_user.role.value
        if isinstance(current_user.role, RoleEnum)
        else str(current_user.role).upper()
    )
    if role_value == RoleEnum.STAGIAIRE.value:
        try:
            from app.modules.tasks.service import TaskService

            TaskService.emit_deadline_notifications_for_stagiaire(db, current_user.id)
        except Exception:
            db.rollback()
    elif role_value == RoleEnum.ENCADREUR.value:
        try:
            from app.modules.tasks.service import TaskService

            TaskService.emit_deadline_notifications_for_encadreur(db, current_user.id)
        except Exception:
            db.rollback()
    return list_user_notifications(
        db,
        current_user.id,
        skip=skip,
        limit=limit,
        unread_only=unread_only,
    )


@router.get(
    '/me/unread-count',
    response_model=NotificationUnreadCount,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def mes_notifications_non_lues(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    role_value = (
        current_user.role.value
        if isinstance(current_user.role, RoleEnum)
        else str(current_user.role).upper()
    )
    if role_value == RoleEnum.STAGIAIRE.value:
        try:
            from app.modules.tasks.service import TaskService

            TaskService.emit_deadline_notifications_for_stagiaire(db, current_user.id)
        except Exception:
            db.rollback()
    elif role_value == RoleEnum.ENCADREUR.value:
        try:
            from app.modules.tasks.service import TaskService

            TaskService.emit_deadline_notifications_for_encadreur(db, current_user.id)
        except Exception:
            db.rollback()
    return {'unread_count': unread_count(db, current_user.id)}


@router.patch(
    '/{notification_id}/read',
    response_model=NotificationRead,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def marquer_notification_lue(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return mark_as_read(db, current_user.id, notification_id)


@router.patch(
    '/me/read-all',
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def marquer_tout_lu(
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return mark_all_as_read(db, current_user.id)
