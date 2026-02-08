from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey, Boolean, CheckConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from app.core.database import Base
import enum


class StatutAffectationEnum(str, enum.Enum):
    AFFECTEE = "AFFECTEE"
    EN_COURS = "EN_COURS"
    COMPLETEE = "COMPLETEE"
    ANNULEE = "ANNULEE"



class Affectation(Base):
    """
    Affectation model - Links together:
    - Demande (demand/application)
    - Projet (chosen project)
    - Encadreur (assigned supervisor)
    - Stagiaire (intern - once account created)
    """
    __tablename__ = "affectations"

    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign Keys
    demande_id = Column(Integer, ForeignKey("demandes_stage.id"), nullable=False, index=True)
    projet_id = Column(Integer, ForeignKey("projets.id"), nullable=False, index=True)
    encadreur_id = Column(Integer, ForeignKey("encadreurs.id"), nullable=False, index=True)
    stagiaire_id = Column(Integer, ForeignKey("stagiaires.id"), nullable=True, index=True)  # Can be null initially
    
    # Status tracking
    statut = Column(Enum(StatutAffectationEnum), default=StatutAffectationEnum.AFFECTEE, nullable=False)
    
    # Timestamps
    date_affectation = Column(DateTime, default=datetime.utcnow, nullable=False)
    date_debut_prevue = Column(DateTime, nullable=True)
    date_fin_prevue = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relations
    demande = relationship("DemandeStage", backref="affectations")
    projet = relationship("Projet", backref="affectations")
    encadreur = relationship("Encadreur", backref="affectations")
    stagiaire = relationship("Stagiaire", backref="affectations")
    
    # Constraints
    __table_args__ = (
        CheckConstraint(
            "date_fin_prevue >= date_debut_prevue OR date_debut_prevue IS NULL",
            name="ck_affectation_dates_valid"
        ),
    )


    
