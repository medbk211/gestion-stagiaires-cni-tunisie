from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.modules.message_interne.schemas import (
    ConversationRead,
    ConversationThreadRead,
    MessageCreate,
    MessageRead,
)
from app.modules.message_interne.service import CommunicationService
from app.shared.enums import RoleEnum

router = APIRouter()


@router.get(
    "/conversations",
    response_model=list[ConversationRead],
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def get_conversations(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return CommunicationService.get_conversations(db, current_user)


@router.get(
    "/with/{contact_id}",
    response_model=ConversationThreadRead,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def get_thread_with_contact(
    contact_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return CommunicationService.get_thread_with_contact(db, current_user, contact_id)


@router.post(
    "/send",
    response_model=MessageRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def send_message(
    payload: MessageCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return CommunicationService.send_message(db, current_user, payload)
