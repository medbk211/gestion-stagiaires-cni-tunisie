from sqlalchemy import Column, DateTime, Integer, String, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)
    idStage = Column(Integer, ForeignKey("stage.id"), nullable=False)
    note = Column(float, nullable=False)
    continu = Column(String, nullable=True)
    dateEvaluation = Column(DateTime, nullable=False)

    stage = relationship("Stage", back_populates="evaluations")