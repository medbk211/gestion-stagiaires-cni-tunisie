from fastapi import HTTPException, UploadFile
from uuid import uuid4
from datetime import date
import os
import shutil
from sqlalchemy.orm import Session
from app.modules.document import repository
from app.modules.document.models import Document
from app.shared.enums import DocumentTypeEnum

MAX_FILE_SIZE = 2 * 1024 * 1024  # 2MB
ALLOWED_TYPE = "application/pdf"


def validate_dates(date_debut: date, date_fin: date):
    if date_fin <= date_debut:
        raise HTTPException(
            status_code=400,
            detail="Date fin doit être après date début"
        )


def validate_file(file: UploadFile):
    if file.content_type != ALLOWED_TYPE:
        raise HTTPException(
            status_code=400,
            detail="Seulement les fichiers PDF sont autorisés"
        )

    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)

    if size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Fichier trop volumineux (max 2MB)"
        )

async def upload_document_service(db: Session, demande_id: int, type: DocumentTypeEnum, file: UploadFile):
    validate_file(file)
    
    upload_dir = f"uploads/demandes/{demande_id}"
    os.makedirs(upload_dir, exist_ok=True)
    
    filename = f"{type.value}_{uuid4()}.pdf"
    file_path = os.path.join(upload_dir, filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    document_data = Document(
        demande_id=demande_id,
        type=type,
        file_path=file_path
    )
    
    return repository.create_document(db, document_data)

def get_demande_documents_service(db: Session, demande_id: int):
    return repository.get_documents_by_demande_id(db, demande_id)

def get_document_file_path_service(db: Session, document_id: int):
    document = repository.get_document_by_id(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document introuvable")
    
    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail="Fichier physique introuvable")
        
    return document.file_path

def delete_document_service(db: Session, document_id: int):
    document = repository.get_document_by_id(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document introuvable")
    
    # Delete physical file
    if os.path.exists(document.file_path):
        os.remove(document.file_path)
        
    repository.delete_document(db, document)
    return {"message": "Document supprimé avec succès"}
