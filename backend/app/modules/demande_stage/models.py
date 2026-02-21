from datetime import datetime

from sqlalchemy import JSON, Column, Date, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.shared.enums import StatutDemandeEnum


class DemandeStage(Base):
    __tablename__ = 'demandes_stage'

    id = Column(Integer, primary_key=True, index=True)

    # Infos personnelles (avant creation du user)
    nom = Column(String(100), nullable=False)
    prenom = Column(String(100), nullable=False)
    email = Column(String(150), nullable=False, unique=True)
    telephone = Column(String(20), nullable=False)

    # Infos academiques
    etablissement = Column(String(200), nullable=False)
    niveau_etude = Column(String(100), nullable=False)
    departement_souhaite = Column(String(100), nullable=False)

    # Dates souhaitees
    date_debut_souhaitee = Column(Date, nullable=False)
    date_fin_souhaitee = Column(Date, nullable=False)

    # Preferences candidature (pour matching)
    competences = Column(JSON, default=list, nullable=False)
    tags = Column(JSON, default=list, nullable=False)

    statut = Column(
        Enum(StatutDemandeEnum),
        default=StatutDemandeEnum.EN_ATTENTE,
        nullable=False,
    )

    # Encadreur assigne (optionnel)
    encadreur_id = Column(Integer, ForeignKey('encadreurs.id'), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    documents = relationship('Document', back_populates='demande', cascade='all, delete-orphan')
    encadreur = relationship('Encadreur', backref='demandes')
