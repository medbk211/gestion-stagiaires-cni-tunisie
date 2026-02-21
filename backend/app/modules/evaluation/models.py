from datetime import datetime
from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


class Evaluation(Base):
    __tablename__ = "evaluations"
    __table_args__ = (
        UniqueConstraint(
            "stagiaire_id",
            "projet_id",
            "encadreur_id",
            name="uq_evaluations_stagiaire_projet_encadreur",
        ),
        CheckConstraint("note >= 0 AND note <= 20", name="ck_evaluations_note_range"),
    )

    id = Column(Integer, primary_key=True, index=True)

    stagiaire_id = Column(Integer, ForeignKey("stagiaires.id"), nullable=False, index=True)
    projet_id = Column(Integer, ForeignKey("projets.id"), nullable=False, index=True)
    encadreur_id = Column(Integer, ForeignKey("encadreurs.id"), nullable=False, index=True)

    note = Column(Integer, nullable=False)
    commentaire = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    stagiaire = relationship("Stagiaire", back_populates="evaluations")
    projet = relationship("Projet", back_populates="evaluations")
    encadreur = relationship("Encadreur", back_populates="evaluations")
