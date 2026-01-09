from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Enum, ForeignKey
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
from app.shared.enums import RoleEnum

class observation(Base):
    __tablename__ = "observation"

    id = Column(Integer, primary_key=True, index=True)
    idStage = Column(Integer, ForeignKey("stage.id"), nullable=False)
    idEncadrant = Column(Integer, ForeignKey("utilisateur.id"), nullable=False)
    datt = Column(DateTime, default=datetime.utcnow)
    continu = Column(String(500), nullable=False)

 
