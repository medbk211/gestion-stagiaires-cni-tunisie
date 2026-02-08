from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base



class ChoixProjet(Base):
    __tablename__ = "choix_projets"

    id = Column(Integer, primary_key=True, index=True)
    demande_id = Column(Integer, ForeignKey("demandes_stage.id"), nullable=False, index=True)
    projet_id = Column(Integer, ForeignKey("projets.id"), nullable=False, index=True)
    date_choix = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Relations
    demande = relationship("DemandeStage", backref="choix_projets")
    projet = relationship("Projet", backref="choix_projets")    


