from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Enum
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
from app.shared.enums import RoleEnum

class Statistiques(Base):
    __tablename__ = "statistiques"

    id = Column(Integer, primary_key=True, index=True)
    periode = Column(String(50), nullable=False)
    nombreDemandes = Column(Integer, default=0)
    nbrStagesvalides = Column(Integer, default=0)
    nbrStagesencours = Column(Integer, default=0)
    taxeReussite = Column(float, default=0)
    
