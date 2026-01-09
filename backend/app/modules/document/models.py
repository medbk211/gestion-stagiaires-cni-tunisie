from sqlalchemy import (
    Column, Integer, String, DateTime, Enum, ForeignKey
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
from app.shared.enums import TypeDocumentEnum


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    id_utilisateur = Column(Integer, ForeignKey("utilisateurs.id"), nullable=False)

    nom_fichier = Column(String(255), nullable=False)
    type_document = Column(Enum(TypeDocumentEnum), nullable=False)

    chemin_acces = Column(String(500), nullable=False)
    taille = Column(Integer, nullable=False)
    date_upload = Column(DateTime, default=datetime.utcnow)

    utilisateur = relationship("Utilisateur", back_populates="documents")

    __mapper_args__ = {
        "polymorphic_on": type_document,
        "polymorphic_identity": "document",
    }


class RapportFinal(Document):
    __tablename__ = "rapports_finals"

    id = Column(Integer, ForeignKey("documents.id"), primary_key=True)
    sujet = Column(String(255), nullable=False)
    resume = Column(String(1000))

    __mapper_args__ = {
        "polymorphic_identity": "rapport_final",
    }


class Attestation(Document):
    __tablename__ = "attestations"

    id = Column(Integer, ForeignKey("documents.id"), primary_key=True)
    date_emission = Column(DateTime, default=datetime.utcnow)
    valide_jusqua = Column(DateTime)

    __mapper_args__ = {
        "polymorphic_identity": "attestation",
    }
