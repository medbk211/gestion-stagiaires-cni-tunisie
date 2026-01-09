from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Enum, ForeignKey
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
from app.shared.enums import RoleEnum

class MessageInterne(Base):
    __tablename__ = "messages_internes"

    id = Column(Integer, primary_key=True, index=True)
    id_expediteur = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    id_destinataire = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    sujet = Column(String(255), nullable=False)
    contenu = Column(String(1000), nullable=False)
    date_envoi = Column(DateTime, default=datetime.utcnow)
    lu = Column(Boolean, default=False)

    expediteur = relationship("Utilisateur", foreign_keys=[id_expediteur])
    destinataire = relationship("Utilisateur", foreign_keys=[id_destinataire])

