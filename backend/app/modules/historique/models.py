
import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Enum, ForeignKey
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
from app.shared.enums import RoleEnum


class HistoriqueAction(Base):
    __tablename__ = "historique_actions"

    id = Column(Integer, primary_key=True, index=True)
    utilisateur_id = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)
    action = Column(String, nullable=False)
    details = Column(String, nullable=True)
    date_action = Column(DateTime, default=datetime.utcnow)

    utilisateur = relationship("Utilisateur", back_populates="historique_actions")  