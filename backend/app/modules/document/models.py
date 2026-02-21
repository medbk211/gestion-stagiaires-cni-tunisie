from sqlalchemy import (
    Column, Integer, String, DateTime, Enum, ForeignKey
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
from app.shared.enums import DocumentTypeEnum


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True)
    demande_id = Column(Integer, ForeignKey("demandes_stage.id"), nullable=True)
    user_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)

    type = Column(Enum(DocumentTypeEnum), nullable=False)
    file_path = Column(String(255), nullable=False) 
    created_at = Column(DateTime, default=datetime.utcnow)

    demande = relationship("DemandeStage", back_populates="documents")
    user = relationship("Utilisateur", back_populates="documents")





