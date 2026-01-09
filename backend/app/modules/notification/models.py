from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Enum, ForeignKey
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
from app.shared.enums import NotificationTypeEnum

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    idUtilisateur = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    message = Column(String(255), nullable=False)
    type = Column(Enum(NotificationTypeEnum), nullable=False)
    datdenvoi = Column(DateTime, default=datetime.utcnow)
    lu = Column(Boolean, default=False)

    utilisateur = relationship("Utilisateur", back_populates="notifications")   


