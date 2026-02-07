from fastapi import APIRouter, Depends, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List
import os

from app.core.database import get_db
from app.modules.document import service, schemas
from app.shared.enums import DocumentTypeEnum

router = APIRouter(
    prefix="/documents",
    tags=["Documents"]
)

@router.post("/upload/{demande_id}", response_model=schemas.DocumentRead)
async def upload_document(
    demande_id: int,
    type: DocumentTypeEnum = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Upload a document for a specific demande.
    """
    return await service.upload_document_service(db, demande_id, type, file)

@router.get("/demande/{demande_id}", response_model=List[schemas.DocumentRead])
def get_documents(demande_id: int, db: Session = Depends(get_db)):
    """
    Get all documents associated with a demande.
    """
    return service.get_demande_documents_service(db, demande_id)

@router.get("/download/{document_id}")
def download_document(document_id: int, db: Session = Depends(get_db)):
    """
    Download a document by its ID.
    """
    file_path = service.get_document_file_path_service(db, document_id)
    return FileResponse(
        file_path, 
        media_type="application/pdf", 
        filename=os.path.basename(file_path)
    )

@router.delete("/{document_id}")
def delete_document(document_id: int, db: Session = Depends(get_db)):
    """
    Delete a document.
    """
    return service.delete_document_service(db, document_id)
