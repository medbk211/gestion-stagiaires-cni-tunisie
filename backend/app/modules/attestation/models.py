from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Attestation(Base):
    __tablename__ = "attestations"

    id = Column(Integer, primary_key=True, index=True)
    
    stagiaire_id = Column(Integer, ForeignKey("stagiaires.id"), nullable=False, index=True)
    stage_id = Column(Integer, ForeignKey("stages.id"), nullable=False, index=True)
    created_by = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False, index=True)
    
    numero_attestation = Column(String(50), nullable=False, unique=True, index=True)
    file_path = Column(String(500), nullable=False)
    
    date_debut_stage = Column(DateTime, nullable=False)
    date_fin_stage = Column(DateTime, nullable=False)
    description = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    stagiaire = relationship("Stagiaire", back_populates="attestations", foreign_keys=[stagiaire_id])
    stage = relationship("Stage", back_populates="attestations", foreign_keys=[stage_id])
    created_by_user = relationship("Utilisateur", foreign_keys=[created_by])
