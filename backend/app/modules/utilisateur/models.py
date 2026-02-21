from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Enum
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
from app.shared.enums import RoleEnum

class Utilisateur(Base):
    __tablename__ = "utilisateurs"

    id = Column(Integer, primary_key=True, index=True)

    nom = Column(String(100), nullable=False)
    prenom = Column(String(100), nullable=False)

    email = Column(String(150), unique=True, index=True, nullable=False)
    motDePasse = Column(String(255), nullable=False)

    role = Column(Enum(RoleEnum), nullable=False)

    actif = Column(Boolean, default=True)
    emailVerifie = Column(Boolean, default=False)

    dateCreation = Column(DateTime, default=datetime.utcnow)
    dateModification = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )

    dernierLogin = Column(DateTime, nullable=True)

    reset_tokens = relationship(
        "ResetMotDePasse",
        back_populates="utilisateur",
        cascade="all, delete-orphan"
    )

    # 🔥 أضف هذا
    documents = relationship(
        "Document",
        back_populates="user",
        cascade="all, delete-orphan"
    )
