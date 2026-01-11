from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from sqlalchemy.orm import relationship
# from app.core.database import Base
from app.modules.utilisateur.models import Utilisateur

class Encadreur(Utilisateur):
    __tablename__ = "encadreurs"

    id = Column(Integer, ForeignKey("utilisateurs.id"), primary_key=True)

    matricule = Column(String(50), unique=True, index=True, nullable=False)

    grade = Column(String(100), nullable=False)
    poste = Column(String(100), nullable=False)

    departement = Column(String(100))
    structure = Column(String(150), nullable=False)

    actif_encadrement = Column(Boolean, default=True)
    peut_valider = Column(Boolean, default=False)

    max_stagiaires = Column(Integer, default=5)

    stagiaires = relationship(
        "Stagiaire",
        back_populates="encadreur"
    )

    __mapper_args__ = {
        "polymorphic_identity": "encadreur",
    }
