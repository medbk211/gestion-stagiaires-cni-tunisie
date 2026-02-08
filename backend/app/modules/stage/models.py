from app.core.database import Base
from sqlalchemy import Column, Integer, String, Date, ForeignKey, Enum
from sqlalchemy.orm import relationship
from app.shared.enums import StatutStageEnum

class Stage(Base):
    __tablename__ = "stages"

    id = Column(Integer, primary_key=True, index=True)

    demandestage_id = Column(Integer, ForeignKey("demandes_stage.id"), nullable=False)
    stagiaire_id = Column(Integer, ForeignKey("stagiaires.id"), nullable=False)
    encadreur_id = Column(Integer, ForeignKey("encadreurs.id"), nullable=False)
    projet_id = Column(Integer, ForeignKey("projets.id"), nullable=True)

    date_debut = Column(Date, nullable=False)
    date_fin = Column(Date, nullable=False)

    statut_stage = Column(Enum(StatutStageEnum),
                          default=StatutStageEnum.EN_COURS,
                          nullable=False)

    texte_objectif = Column(String(500), nullable=False)

    demande_stage = relationship("DemandeStage", backref="stage")
    stagiaire = relationship("Stagiaire", backref="stages")
    encadreur = relationship("Encadreur", backref="stages")
    projet = relationship("Projet", backref="stages", uselist=False)

   
    tasks = relationship("Task", back_populates="stage", cascade="all, delete-orphan")
