from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class DemandeStageStatusHistory(Base):
    __tablename__ = "demandes_stage_status_history"

    id = Column(Integer, primary_key=True, index=True)
    demande_id = Column(Integer, ForeignKey("demandes_stage.id"), nullable=False, index=True)
    previous_status = Column(String(50), nullable=True)
    new_status = Column(String(50), nullable=False)
    reason = Column(Text, nullable=True)
    changed_by = Column(Integer, ForeignKey("utilisateurs.id"), nullable=True)
    changed_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    demande = relationship("DemandeStage", backref="status_history")
