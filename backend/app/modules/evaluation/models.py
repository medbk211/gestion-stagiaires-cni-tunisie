from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime

from app.core.database import Base


class Evaluation(Base):
    __tablename__ = "evaluations"

    id = Column(Integer, primary_key=True, index=True)

    # --- Relations ---
    stagiaire_id = Column(Integer, ForeignKey("stagiaires.id"), nullable=False)
    projet_id = Column(Integer, ForeignKey("projets.id"), nullable=False)
    encadreur_id = Column(Integer, ForeignKey("encadreurs.id"), nullable=False)

    # --- Evaluation content ---
    note = Column(Integer, nullable=False)  # exemple: من 0 إلى 20
    commentaire = Column(Text, nullable=True)

    # --- Metadata ---
    created_at = Column(DateTime, default=datetime.utcnow)

    # --- ORM Relationships ---
    stagiaire = relationship("Stagiaire", back_populates="evaluations")
    projet = relationship("Projet", back_populates="evaluations")
    encadreur = relationship("Encadreur", back_populates="evaluations")
