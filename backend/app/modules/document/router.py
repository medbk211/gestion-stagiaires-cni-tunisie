import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.modules.demande_stage.models import DemandeStage
from app.modules.document import schemas, service
from app.modules.document.models import Document
from app.modules.document.repository import get_document_by_id
from app.modules.utilisateur.models import Utilisateur
from app.shared.enums import DocumentTypeEnum, RoleEnum

router = APIRouter(prefix='/documents', tags=['Documents'])


@router.post(
    '/upload/{demande_id}',
    response_model=schemas.DocumentRead,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
async def upload_document(
    demande_id: int,
    type: DocumentTypeEnum = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    return await service.upload_document_service(db, demande_id, type, file)


@router.get(
    '/',
    response_model=list[schemas.DocumentRead],
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR))],
)
def list_documents(
    demande_id: int | None = None,
    status: str | None = None,
    type_document: DocumentTypeEnum | None = None,
    search: str | None = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return service.list_documents_service(
        db,
        demande_id=demande_id,
        status=status,
        type_document=type_document,
        search=search,
        skip=skip,
        limit=limit,
    )


@router.get(
    '/me',
    response_model=list[schemas.DocumentRead],
    dependencies=[Depends(require_role(RoleEnum.STAGIAIRE))],
)
def list_my_documents(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return service.list_my_documents_service(
        db,
        current_user.id,
        current_user.email,
        skip=skip,
        limit=limit,
    )


@router.get(
    '/demande/{demande_id}',
    response_model=list[schemas.DocumentRead],
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR))],
)
def get_documents(demande_id: int, db: Session = Depends(get_db)):
    return service.get_demande_documents_service(db, demande_id)


def _assert_can_access_document(db: Session, document_id: int, current_user: Utilisateur):
    document = get_document_by_id(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail='Document introuvable')

    if current_user.role == RoleEnum.STAGIAIRE:
        if document.user_id == current_user.id:
            return document
        demande = db.query(DemandeStage).filter(DemandeStage.id == document.demande_id).first()
        if not demande or demande.email != current_user.email:
            raise HTTPException(status_code=403, detail='Acces interdit')

    return document


@router.get(
    '/download/{document_id}',
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR, RoleEnum.STAGIAIRE))],
)
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    _assert_can_access_document(db, document_id, current_user)
    file_path = service.get_document_file_path_service(db, document_id)
    return FileResponse(file_path, media_type='application/pdf', filename=os.path.basename(file_path))


@router.patch(
    '/{document_id}/status',
    response_model=schemas.DocumentRead,
    dependencies=[Depends(require_role(RoleEnum.ADMIN, RoleEnum.ENCADREUR))],
)
def update_document_status(
    document_id: int,
    payload: schemas.DocumentStatusUpdate,
    db: Session = Depends(get_db),
    current_user: Utilisateur = Depends(get_current_user),
):
    return service.update_document_status_service(
        db,
        document_id=document_id,
        status=payload.status,
        reviewed_by=current_user.id,
        comment=payload.comment,
    )


@router.delete(
    '/{document_id}',
    dependencies=[Depends(require_role(RoleEnum.ADMIN))],
)
def delete_document(document_id: int, db: Session = Depends(get_db)):
    return service.delete_document_service(db, document_id)
