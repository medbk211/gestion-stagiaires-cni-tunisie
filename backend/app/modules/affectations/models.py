from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from app.core.database import Base
import enum


class StatutPropositionEnum(str, enum.Enum):
    EN_ATTENTE = "EN_ATTENTE"
    CHOISI = "CHOISI"
    EXPIRE = "EXPIRE"


class PropositionProjet(Base):
    __tablename__ = "propositions_projets"

    id = Column(Integer, primary_key=True, index=True)
    
    demande_id = Column(Integer, ForeignKey("demandes_stage.id"), nullable=False, index=True)
    projet_id = Column(Integer, ForeignKey("projets.id"), nullable=False, index=True)
    
    token = Column(String(64), nullable=False, index=True)
    date_expiration = Column(DateTime, nullable=False)
    
    statut = Column(Enum(StatutPropositionEnum), default=StatutPropositionEnum.EN_ATTENTE, nullable=False)
    date_choix = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relations
    demande = relationship("DemandeStage", backref="propositions")
    projet = relationship("Projet", backref="propositions")
