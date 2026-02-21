from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.notifications.models import Notification


def _ensure_table(db: Session):
    Notification.__table__.create(bind=db.get_bind(), checkfirst=True)


def create_notification(
    db: Session,
    user_id: int,
    title: str,
    message: str,
    category: str = 'general',
    payload: str | None = None,
):
    _ensure_table(db)
    notification = Notification(
        user_id=user_id,
        title=title.strip() or 'Notification',
        message=message.strip(),
        category=category.strip() or 'general',
        payload=payload,
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def list_user_notifications(
    db: Session,
    user_id: int,
    skip: int = 0,
    limit: int = 20,
    unread_only: bool = False,
):
    _ensure_table(db)
    query = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        query = query.filter(Notification.read_at.is_(None))
    return query.order_by(Notification.created_at.desc(), Notification.id.desc()).offset(skip).limit(limit).all()


def unread_count(db: Session, user_id: int):
    _ensure_table(db)
    return (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.read_at.is_(None))
        .count()
    )


def mark_as_read(db: Session, user_id: int, notification_id: int):
    _ensure_table(db)
    notification = (
        db.query(Notification)
        .filter(Notification.id == notification_id, Notification.user_id == user_id)
        .first()
    )
    if not notification:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Notification introuvable')
    if notification.read_at is None:
        notification.read_at = datetime.utcnow()
        db.commit()
        db.refresh(notification)
    return notification


def mark_all_as_read(db: Session, user_id: int):
    _ensure_table(db)
    now = datetime.utcnow()
    (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.read_at.is_(None))
        .update({Notification.read_at: now}, synchronize_session=False)
    )
    db.commit()
    return {'message': 'Notifications marquees comme lues'}
