from app.core.database import Base
from sqlalchemy import Column,Integer, String, Enum, Text, ForeignKey, JSON, DateTime
from app.shared.enums import DepartementEnum, TypeStageEnum, NiveauEnum, ProjetStatusEnum
from datetime import datetime
from sqlalchemy.orm import relationship



class Projet(Base):
    __tablename__ = "projets"

    id = Column(Integer, primary_key=True)
    code_projet = Column(String(50), unique=True, nullable=False)
    intitule = Column(String(200), nullable=False)
    departement = Column(Enum(DepartementEnum), nullable=False)
    type_stage = Column(Enum(TypeStageEnum))

    description = Column(Text)
    objectifs = Column(Text)
    livrables = Column(Text)

    duree_semaines = Column(Integer, default=4)
    charge_hebdo = Column(Integer, default=20)

    niveau_requis = Column(Enum(NiveauEnum))
    competences = Column(JSON, default=[])
    tags = Column(JSON, default=[])

    complexite = Column(Integer, default=3)  # 1=facile, 5=élevé
    priorite = Column(Integer, default=3)    # 1=urgent, 5=normal

    status = Column(Enum(ProjetStatusEnum), default=ProjetStatusEnum.DISPONIBLE)
    nombre_max_stagiaires = Column(Integer, default=1)
    encadreur_id = Column(Integer, ForeignKey("encadreurs.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    tasks = relationship("Task", back_populates="projet", cascade="all, delete-orphan")