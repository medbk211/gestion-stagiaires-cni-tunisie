from sqlalchemy import Column, Integer, String, DateTime, Date, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base

    
class ResetMotDePasse (Base):
    __tablename__ = "reset_mot_de_passe"

    id = Column(Integer, primary_key=True, index=True)
    utilisateur_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    token = Column(String, unique=True, index=True, nullable=False)
    date_creation = Column(DateTime, default=datetime.utcnow)
    date_expiration = Column(Date, nullable=False)
    utilisee = Column(Boolean, default=False)


    utilisateur = relationship("Utilisateur", back_populates="reset_tokens")