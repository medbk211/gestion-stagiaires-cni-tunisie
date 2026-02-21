import json

from fastapi import HTTPException, status
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.modules.message_interne.models import MessageInterne
from app.modules.message_interne.schemas import MessageCreate
from app.modules.notifications.service import create_notification
from app.modules.stage.models import Stage
from app.modules.stagiaires.models import Stagiaire
from app.modules.utilisateur.models import Utilisateur
from app.shared.enums import RoleEnum, StatutStageEnum


class CommunicationService:
    @staticmethod
    def _display_name(user: Utilisateur) -> str:
        nom = (user.nom or "").strip()
        prenom = (user.prenom or "").strip()
        full_name = f"{prenom} {nom}".strip()
        if full_name:
            return full_name
        email = (user.email or "").strip()
        if email:
            return email
        return f"Utilisateur #{user.id}"

    @staticmethod
    def _serialize_contact(user: Utilisateur) -> dict:
        return {
            "id": user.id,
            "nom": user.nom,
            "prenom": user.prenom,
            "email": user.email,
            "role": user.role,
        }

    @staticmethod
    def _serialize_message(message: MessageInterne, current_user_id: int) -> dict:
        return {
            "id": message.id,
            "sender_id": message.id_expediteur,
            "recipient_id": message.id_destinataire,
            "subject": message.sujet,
            "content": message.contenu,
            "sent_at": message.date_envoi,
            "is_read": bool(message.lu),
            "is_mine": message.id_expediteur == current_user_id,
        }

    @staticmethod
    def _get_partner_ids_from_history(db: Session, user_id: int) -> set[int]:
        rows = (
            db.query(MessageInterne.id_expediteur, MessageInterne.id_destinataire)
            .filter(
                or_(
                    MessageInterne.id_expediteur == user_id,
                    MessageInterne.id_destinataire == user_id,
                )
            )
            .all()
        )

        partner_ids: set[int] = set()
        for sender_id, recipient_id in rows:
            if sender_id == user_id:
                partner_ids.add(recipient_id)
            else:
                partner_ids.add(sender_id)
        return partner_ids

    @staticmethod
    def _get_allowed_recipient_ids(db: Session, current_user: Utilisateur) -> set[int]:
        from app.modules.affectations.models import Affectation
        from app.modules.demande_stage.models import DemandeStage

        allowed_ids = CommunicationService._get_partner_ids_from_history(db, current_user.id)
        role_value = (
            current_user.role.value
            if isinstance(current_user.role, RoleEnum)
            else str(current_user.role).upper()
        )

        if role_value == RoleEnum.STAGIAIRE.value:
            stagiaire_profile_row = (
                db.query(
                    Stagiaire.id.label('id'),
                    Stagiaire.encadreur_id.label('encadreur_id'),
                )
                .filter(
                    or_(
                        Stagiaire.id == current_user.id,
                        Stagiaire.email == current_user.email,
                    )
                )
                .first()
            )
            resolved_stagiaire_id = (
                int(stagiaire_profile_row.id)
                if stagiaire_profile_row and stagiaire_profile_row.id is not None
                else current_user.id
            )

            stage = (
                db.query(Stage)
                .filter(
                    Stage.stagiaire_id == resolved_stagiaire_id,
                    Stage.statut_stage == StatutStageEnum.EN_COURS,
                )
                .order_by(Stage.id.desc())
                .first()
            )
            if not stage:
                stage = (
                    db.query(Stage)
                    .filter(Stage.stagiaire_id == resolved_stagiaire_id)
                    .order_by(Stage.id.desc())
                    .first()
                )

            if stage and stage.encadreur_id:
                allowed_ids.add(stage.encadreur_id)

            if (
                stagiaire_profile_row
                and stagiaire_profile_row.encadreur_id is not None
            ):
                allowed_ids.add(int(stagiaire_profile_row.encadreur_id))

            affectation_encadreurs = (
                db.query(Affectation.encadreur_id)
                .join(DemandeStage, DemandeStage.id == Affectation.demande_id)
                .filter(
                    DemandeStage.email == current_user.email,
                    Affectation.encadreur_id.is_not(None),
                )
                .distinct()
                .all()
            )
            allowed_ids.update(
                encadreur_id
                for (encadreur_id,) in affectation_encadreurs
                if encadreur_id is not None
            )

            demande_encadreurs = (
                db.query(DemandeStage.encadreur_id)
                .filter(
                    DemandeStage.email == current_user.email,
                    DemandeStage.encadreur_id.is_not(None),
                )
                .distinct()
                .all()
            )
            allowed_ids.update(
                encadreur_id
                for (encadreur_id,) in demande_encadreurs
                if encadreur_id is not None
            )

        elif role_value == RoleEnum.ENCADREUR.value:
            resolved_encadreur_id = current_user.id

            stage_stagiaires = (
                db.query(Stage.stagiaire_id)
                .filter(Stage.encadreur_id == resolved_encadreur_id)
                .distinct()
                .all()
            )
            linked_stagiaires = (
                db.query(Stagiaire.id).filter(Stagiaire.encadreur_id == resolved_encadreur_id).all()
            )

            allowed_ids.update(stagiaire_id for (stagiaire_id,) in stage_stagiaires if stagiaire_id)
            allowed_ids.update(stagiaire_id for (stagiaire_id,) in linked_stagiaires if stagiaire_id)

            affectation_stagiaires = (
                db.query(Affectation.stagiaire_id)
                .filter(
                    Affectation.encadreur_id == resolved_encadreur_id,
                    Affectation.stagiaire_id.is_not(None),
                )
                .distinct()
                .all()
            )
            allowed_ids.update(
                stagiaire_id
                for (stagiaire_id,) in affectation_stagiaires
                if stagiaire_id is not None
            )

            stagiaires_from_demande_email = (
                db.query(Utilisateur.id)
                .join(DemandeStage, DemandeStage.email == Utilisateur.email)
                .join(Affectation, Affectation.demande_id == DemandeStage.id)
                .filter(
                    Utilisateur.role == RoleEnum.STAGIAIRE,
                    Affectation.encadreur_id == resolved_encadreur_id,
                )
                .distinct()
                .all()
            )
            allowed_ids.update(
                stagiaire_id
                for (stagiaire_id,) in stagiaires_from_demande_email
                if stagiaire_id is not None
            )

            stagiaires_from_assigned_demande = (
                db.query(Utilisateur.id)
                .join(DemandeStage, DemandeStage.email == Utilisateur.email)
                .filter(
                    Utilisateur.role == RoleEnum.STAGIAIRE,
                    DemandeStage.encadreur_id == resolved_encadreur_id,
                )
                .distinct()
                .all()
            )
            allowed_ids.update(
                stagiaire_id
                for (stagiaire_id,) in stagiaires_from_assigned_demande
                if stagiaire_id is not None
            )

        elif role_value == RoleEnum.ADMIN.value:
            user_ids = db.query(Utilisateur.id).filter(Utilisateur.id != current_user.id).all()
            allowed_ids.update(user_id for (user_id,) in user_ids)

        allowed_ids.discard(current_user.id)
        return allowed_ids

    @staticmethod
    def _get_last_message_between(
        db: Session, first_user_id: int, second_user_id: int
    ) -> MessageInterne | None:
        return (
            db.query(MessageInterne)
            .filter(
                or_(
                    and_(
                        MessageInterne.id_expediteur == first_user_id,
                        MessageInterne.id_destinataire == second_user_id,
                    ),
                    and_(
                        MessageInterne.id_expediteur == second_user_id,
                        MessageInterne.id_destinataire == first_user_id,
                    ),
                )
            )
            .order_by(MessageInterne.date_envoi.desc(), MessageInterne.id.desc())
            .first()
        )

    @staticmethod
    def get_conversations(db: Session, current_user: Utilisateur) -> list[dict]:
        allowed_ids = CommunicationService._get_allowed_recipient_ids(db, current_user)
        if not allowed_ids:
            return []

        contacts = db.query(Utilisateur).filter(Utilisateur.id.in_(allowed_ids)).all()

        conversations: list[dict] = []
        for contact in contacts:
            last_message = CommunicationService._get_last_message_between(
                db, current_user.id, contact.id
            )
            unread_count = (
                db.query(MessageInterne)
                .filter(
                    MessageInterne.id_destinataire == current_user.id,
                    MessageInterne.id_expediteur == contact.id,
                    MessageInterne.lu.is_(False),
                )
                .count()
            )
            conversations.append(
                {
                    "contact": CommunicationService._serialize_contact(contact),
                    "last_message": (
                        CommunicationService._serialize_message(last_message, current_user.id)
                        if last_message
                        else None
                    ),
                    "unread_count": unread_count,
                }
            )

        conversations.sort(
            key=lambda convo: convo["last_message"]["sent_at"].timestamp()
            if convo["last_message"]
            else 0,
            reverse=True,
        )
        return conversations

    @staticmethod
    def get_thread_with_contact(
        db: Session, current_user: Utilisateur, contact_id: int
    ) -> dict:
        allowed_ids = CommunicationService._get_allowed_recipient_ids(db, current_user)
        if contact_id not in allowed_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Contact non autorise",
            )

        contact = db.query(Utilisateur).filter(Utilisateur.id == contact_id).first()
        if not contact:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Contact introuvable",
            )

        messages = (
            db.query(MessageInterne)
            .filter(
                or_(
                    and_(
                        MessageInterne.id_expediteur == current_user.id,
                        MessageInterne.id_destinataire == contact_id,
                    ),
                    and_(
                        MessageInterne.id_expediteur == contact_id,
                        MessageInterne.id_destinataire == current_user.id,
                    ),
                )
            )
            .order_by(MessageInterne.date_envoi.asc(), MessageInterne.id.asc())
            .all()
        )

        updated = False
        for message in messages:
            if (
                message.id_destinataire == current_user.id
                and message.id_expediteur == contact_id
                and not message.lu
            ):
                message.lu = True
                updated = True

        if updated:
            db.commit()

        return {
            "contact": CommunicationService._serialize_contact(contact),
            "messages": [
                CommunicationService._serialize_message(message, current_user.id)
                for message in messages
            ],
        }

    @staticmethod
    def send_message(
        db: Session, current_user: Utilisateur, payload: MessageCreate
    ) -> dict:
        if payload.recipient_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Impossible d envoyer un message a vous-meme",
            )

        allowed_ids = CommunicationService._get_allowed_recipient_ids(db, current_user)
        if payload.recipient_id not in allowed_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Destinataire non autorise",
            )

        recipient = db.query(Utilisateur).filter(Utilisateur.id == payload.recipient_id).first()
        if not recipient:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Destinataire introuvable",
            )

        message = MessageInterne(
            id_expediteur=current_user.id,
            id_destinataire=payload.recipient_id,
            sujet=payload.subject or "Message",
            contenu=payload.content,
            lu=False,
        )

        db.add(message)
        db.commit()
        db.refresh(message)

        preview = " ".join((payload.content or "").strip().split())
        if len(preview) > 120:
            preview = f"{preview[:117]}..."

        notification_payload = json.dumps(
            {
                "type": "message_interne",
                "contact_id": current_user.id,
                "message_id": message.id,
            },
            ensure_ascii=False,
        )

        try:
            create_notification(
                db,
                user_id=recipient.id,
                title="Nouveau message",
                message=f'{CommunicationService._display_name(current_user)}: {preview or "Message"}',
                category="message_interne",
                payload=notification_payload,
            )
        except Exception:
            db.rollback()

        return CommunicationService._serialize_message(message, current_user.id)
