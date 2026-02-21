from sqlalchemy import (
    Column, Integer, String, Boolean,
    ForeignKey, Enum, CheckConstraint
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.modules.utilisateur.models import Utilisateur
from app.shared.enums import GradeEnum, DepartementEnum


class Encadreur(Utilisateur):
    __tablename__ = "encadreurs"

    id = Column(
        Integer,
        ForeignKey("utilisateurs.id", ondelete="CASCADE"),
        primary_key=True
    )

    matricule = Column(String(50), unique=True, index=True, nullable=False)

    grade = Column(
        Enum(GradeEnum),
        nullable=False
    )

    departement = Column(Enum(DepartementEnum), index=True)

    actif_encadrement = Column(Boolean, default=True, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    max_stagiaires = Column(
        Integer,
        default=5,
        nullable=False
    )


    __table_args__ = (
        CheckConstraint(
            "max_stagiaires >= 1",
            name="ck_encadreur_max_stagiaires_positive"
        ),
    )

    __mapper_args__ = {
        "polymorphic_identity": "encadreur",
    }
    tasks = relationship(
        "Task",
        back_populates="encadreur",
        cascade="all, delete-orphan",
    )
    evaluations = relationship(
        "Evaluation",
        back_populates="encadreur",
        cascade="all, delete-orphan",
    )
    planning_events = relationship(
        "PlanningEvent",
        back_populates="encadreur",
        cascade="all, delete-orphan",
    )

    # ========================
    # Business Helpers
    # ========================
    @property
    def nb_stagiaires_actuels(self) -> int:
        return len(self.stagiaires)

    def peut_prendre_stagiaire(self) -> bool:
        return (
            self.actif_encadrement
            and self.nb_stagiaires_actuels < self.max_stagiaires
        )
