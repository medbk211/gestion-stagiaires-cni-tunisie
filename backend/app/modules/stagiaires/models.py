from sqlalchemy import Column, Integer, String, Date, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
from app.modules.utilisateur.models import Utilisateur
from app.shared.enums import TypeStageEnum, StatutStageEnum




class Stagiaire(Utilisateur):
    __tablename__ = "stagiaires"

    id = Column(Integer, ForeignKey("utilisateurs.id"), primary_key=True)

    matricule = Column(String(30), unique=True, index=True, nullable=False)

    type_stage = Column(Enum(TypeStageEnum), nullable=False)
    statut_stage = Column(Enum(StatutStageEnum), default=StatutStageEnum.EN_ATTENTE, nullable=False)

    date_debut_stage = Column(Date, nullable=False)
    date_fin_stage = Column(Date, nullable=False)

    etablissement = Column(String(150), nullable=False)
    niveau_etude = Column(String(100))

    encadreur_id = Column(Integer, ForeignKey("encadreurs.id"), nullable=True)
    encadreur = relationship(
        "Encadreur",
        backref="stagiaires",
        foreign_keys=[encadreur_id]
    )

    date_validation = Column(DateTime, nullable=True)
    note_finale = Column(Integer, nullable=True)

    __mapper_args__ = {
        "polymorphic_identity": "stagiaire",
    }
