from sqlalchemy.orm import Session
from app.modules.document.models import Document

def create_document(db: Session, document: Document):
    db.add(document)
    db.commit()
    db.refresh(document)
    return document

def get_documents_by_demande_id(db: Session, demande_id: int):
    return db.query(Document).filter(Document.demande_id == demande_id).all()

def get_document_by_id(db: Session, document_id: int):
    return db.query(Document).filter(Document.id == document_id).first()

def delete_document(db: Session, document: Document):
    db.delete(document)
    db.commit()
