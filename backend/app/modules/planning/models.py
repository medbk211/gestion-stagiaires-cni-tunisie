from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.shared.enums import planningEventTypeEnum, taskPriorityEnum


class PlanningEvent(Base):
    __tablename__ = "planning_events"

    id = Column(Integer, primary_key=True, index=True)
    encadreur_id = Column(Integer, ForeignKey("encadreurs.id"), nullable=False, index=True)
    stagiaire_id = Column(Integer, ForeignKey("stagiaires.id"), nullable=True, index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_type = Column(Enum(planningEventTypeEnum), nullable=False, default=planningEventTypeEnum.MEETING)
    priority = Column(Enum(taskPriorityEnum), nullable=False, default=taskPriorityEnum.MEDIUM)

    attendee_name = Column(String(255), nullable=True)
    location = Column(String(255), nullable=True)

    start_at = Column(DateTime, nullable=False, index=True)
    end_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    encadreur = relationship("Encadreur", back_populates="planning_events")
    stagiaire = relationship("Stagiaire")
