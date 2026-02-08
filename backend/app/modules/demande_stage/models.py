from sqlalchemy import Column, Integer, String, Date, Enum, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.core.database import Base
from app.shared.enums import StatutDemandeEnum



class DemandeStage(Base):
    __tablename__ = "demandes_stage"

    id = Column(Integer, primary_key=True, index=True)

    # Infos personnelles (avant إنشاء user)
    nom = Column(String(100), nullable=False)
    prenom = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False, unique=True)
    telephone = Column(String(20), nullable=False)

    # Infos académiques
    etablissement = Column(String(200), nullable=False)
    niveau_etude = Column(String(100), nullable=False)
    departement_souhaite = Column(String(100), nullable=False)

    # Dates proposées
    date_debut_souhaitee = Column(Date, nullable=False)
    date_fin_souhaitee = Column(Date, nullable=False)

    statut = Column(
        Enum(StatutDemandeEnum),
        default=StatutDemandeEnum.EN_ATTENTE,
        nullable=False
    )

    # Associer un encadreur
    encadreur_id = Column(Integer, ForeignKey("encadreurs.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relation (optionnelle)
    
    documents = relationship(
        "Document",
        back_populates="demande",
        cascade="all, delete-orphan"
    )
    
    encadreur = relationship("Encadreur", backref="demandes")
