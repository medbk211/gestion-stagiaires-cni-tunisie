import os
import shutil
from uuid import uuid4
from datetime import date, datetime

from fastapi import HTTPException, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.modules.demande_stage.models import DemandeStage
from app.modules.document import repository
from app.modules.document.models import Document
from app.modules.document.review_models import DocumentReview
from app.modules.notifications.service import create_notification
from app.modules.utilisateur.models import Utilisateur
from app.shared.enums import DocumentTypeEnum

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_TYPES = {
    'application/pdf',
    'application/x-pdf',
    'application/acrobat',
    'applications/vnd.pdf',
    'text/pdf',
    'text/x-pdf',
    'application/octet-stream',
}
VALID_DOCUMENT_STATUSES = {'pending', 'approved', 'rejected'}


def validate_dates(date_debut: date, date_fin: date):
    if date_fin <= date_debut:
        raise HTTPException(
            status_code=400,
            detail='Date fin doit etre apres date debut',
        )


def validate_file(file: UploadFile):
    content_type = (file.content_type or '').lower()
    filename = (file.filename or '').lower()

    file.file.seek(0)
    header = file.file.read(5)
    file.file.seek(0)

    looks_like_pdf = header.startswith(b'%PDF-')
    has_pdf_mime_or_extension = content_type in ALLOWED_TYPES or filename.endswith('.pdf')

    if not (looks_like_pdf and has_pdf_mime_or_extension):
        raise HTTPException(
            status_code=400,
            detail='Fichier invalide: utilisez un PDF valide.',
        )

    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)

    if size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail='Fichier trop volumineux (max 5MB)',
        )


def _ensure_review_table(db: Session):
    DocumentReview.__table__.create(bind=db.get_bind(), checkfirst=True)


def _get_latest_review(db: Session, document_id: int) -> DocumentReview | None:
    _ensure_review_table(db)
    return (
        db.query(DocumentReview)
        .filter(DocumentReview.document_id == document_id)
        .order_by(DocumentReview.reviewed_at.desc(), DocumentReview.id.desc())
        .first()
    )


def _attach_review(document: Document, review: DocumentReview | None) -> Document:
    document.status = review.status if review else 'pending'  # type: ignore[attr-defined]
    document.review_comment = review.comment if review else None  # type: ignore[attr-defined]
    document.reviewed_by = review.reviewed_by if review else None  # type: ignore[attr-defined]
    document.reviewed_at = review.reviewed_at if review else None  # type: ignore[attr-defined]
    return document


def enrich_documents_with_review(db: Session, documents: list[Document]) -> list[Document]:
    return [_attach_review(doc, _get_latest_review(db, doc.id)) for doc in documents]


async def upload_document_service(
    db: Session,
    demande_id: int,
    type: DocumentTypeEnum,
    file: UploadFile,
):
    validate_file(file)

    upload_dir = f'uploads/demandes/{demande_id}'
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"{type.value}_{uuid4()}.pdf"
    file_path = os.path.join(upload_dir, filename)

    with open(file_path, 'wb') as buffer:
        shutil.copyfileobj(file.file, buffer)

    document_data = Document(
        demande_id=demande_id,
        type=type,
        file_path=file_path,
    )

    created = repository.create_document(db, document_data)
    return _attach_review(created, None)


def get_demande_documents_service(db: Session, demande_id: int):
    documents = repository.get_documents_by_demande_id(db, demande_id)
    return enrich_documents_with_review(db, documents)


def get_document_file_path_service(db: Session, document_id: int):
    document = repository.get_document_by_id(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail='Document introuvable')

    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail='Fichier physique introuvable')

    return document.file_path


def list_documents_service(
    db: Session,
    demande_id: int | None = None,
    status: str | None = None,
    type_document: DocumentTypeEnum | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
):
    query = db.query(Document).join(DemandeStage, DemandeStage.id == Document.demande_id)
    if demande_id is not None:
        query = query.filter(Document.demande_id == demande_id)
    if type_document is not None:
        query = query.filter(Document.type == type_document)
    if search:
        token = f'%{search.strip()}%'
        query = query.filter(
            or_(
                DemandeStage.nom.ilike(token),
                DemandeStage.prenom.ilike(token),
                DemandeStage.email.ilike(token),
                Document.file_path.ilike(token),
            )
        )
    docs = query.order_by(Document.created_at.desc(), Document.id.desc()).offset(skip).limit(limit).all()
    docs = enrich_documents_with_review(db, docs)

    if status:
        return [doc for doc in docs if getattr(doc, 'status', 'pending') == status]
    return docs


def list_my_documents_service(
    db: Session,
    user_id: int,
    user_email: str,
    skip: int = 0,
    limit: int = 100,
):
    docs_by_user = db.query(Document).filter(Document.user_id == user_id).all()

    docs_by_demande = (
        db.query(Document)
        .join(DemandeStage, DemandeStage.id == Document.demande_id)
        .filter(DemandeStage.email == user_email)
        .all()
    )

    merged = {doc.id: doc for doc in docs_by_user}
    for doc in docs_by_demande:
        merged[doc.id] = doc

    docs = sorted(
        list(merged.values()),
        key=lambda item: (item.created_at or datetime.min, item.id),
        reverse=True,
    )
    return enrich_documents_with_review(db, docs[skip : skip + limit])


def update_document_status_service(
    db: Session,
    document_id: int,
    status: str,
    reviewed_by: int,
    comment: str | None = None,
):
    _ensure_review_table(db)
    if status not in VALID_DOCUMENT_STATUSES:
        raise HTTPException(status_code=400, detail='Statut document invalide')

    document = repository.get_document_by_id(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail='Document introuvable')

    review = DocumentReview(
        document_id=document_id,
        status=status,
        comment=(comment or '').strip() or None,
        reviewed_by=reviewed_by,
        reviewed_at=datetime.utcnow(),
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    # Notify owner when possible (by user_id or demande email match).
    owner_user_id = document.user_id
    if owner_user_id is None and document.demande_id is not None:
        demande = db.query(DemandeStage).filter(DemandeStage.id == document.demande_id).first()
        if demande:
            owner = db.query(Utilisateur).filter(Utilisateur.email == demande.email).first()
            owner_user_id = owner.id if owner else None

    if owner_user_id is not None:
        create_notification(
            db,
            user_id=owner_user_id,
            title='Mise a jour document',
            message=f'Le document #{document.id} a ete marque "{status}".',
            category='document',
        )

    return _attach_review(document, review)


def delete_document_service(db: Session, document_id: int):
    document = repository.get_document_by_id(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail='Document introuvable')

    db.query(DocumentReview).filter(DocumentReview.document_id == document_id).delete()

    if os.path.exists(document.file_path):
        os.remove(document.file_path)

    repository.delete_document(db, document)
    return {'message': 'Document supprime avec succes'}
