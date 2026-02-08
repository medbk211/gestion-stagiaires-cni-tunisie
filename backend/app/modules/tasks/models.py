from app.core.database import Base
from sqlalchemy import Column, Integer, String, Text, Enum, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.shared.enums import taskStatusEnum, taskPriorityEnum



class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False)
    description = Column(Text)

    stage_id = Column(Integer, ForeignKey("stages.id"), nullable=False)
    projet_id = Column(Integer, ForeignKey("projets.id"), nullable=False)

    status = Column(Enum(taskStatusEnum), default=taskStatusEnum.TODO, nullable=False)
    priority = Column(Enum(taskPriorityEnum), default=taskPriorityEnum.MEDIUM, nullable=False)

    deadline = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # relationships
    stage = relationship("Stage", back_populates="tasks")
    projet = relationship("Projet", back_populates="tasks")
