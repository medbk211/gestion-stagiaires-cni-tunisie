import os
from contextlib import contextmanager
from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Force a local SQLite database for tests/CI before importing app modules.
os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SECRET_KEY", "test-secret-key")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")
os.environ.setdefault("MAIL_USERNAME", "test@example.com")
os.environ.setdefault("MAIL_PASSWORD", "test-password")
os.environ.setdefault("MAIL_FROM", "test@example.com")
os.environ.setdefault("MAIL_SERVER", "smtp.example.com")
os.environ.setdefault("MAIL_PORT", "587")

from app.core.database import Base, get_db  # noqa: E402
from app.core.security import get_current_user, hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.modules.demande_stage.models import DemandeStage  # noqa: E402
from app.modules.encadreurs.models import Encadreur  # noqa: E402
from app.modules.projet_stage.models import Projet  # noqa: E402
from app.modules.utilisateur.models import Utilisateur  # noqa: E402
from app.shared.enums import (  # noqa: E402
    DepartementEnum,
    GradeEnum,
    ProjetStatusEnum,
    RoleEnum,
    StatutDemandeEnum,
    TypeStageEnum,
)

TEST_ENGINE = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)


@pytest.fixture(scope="session", autouse=True)
def prepare_database():
    Base.metadata.drop_all(bind=TEST_ENGINE)
    Base.metadata.create_all(bind=TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture(scope="session", autouse=True)
def override_db_dependency():
    def _override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture(autouse=True)
def clean_database():
    db = TestingSessionLocal()
    try:
        for table in reversed(Base.metadata.sorted_tables):
            db.execute(table.delete())
        db.commit()
    finally:
        db.close()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def auth_as():
    @contextmanager
    def _auth(user: Utilisateur):
        app.dependency_overrides[get_current_user] = lambda: user
        try:
            yield
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    return _auth


def create_user(
    db,
    *,
    email: str,
    role: RoleEnum = RoleEnum.ADMIN,
    password: str = "Password123!",
    nom: str = "Test",
    prenom: str = "User",
    actif: bool = True,
):
    user = Utilisateur(
        nom=nom,
        prenom=prenom,
        email=email,
        motDePasse=hash_password(password),
        role=role,
        actif=actif,
        emailVerifie=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_encadreur(
    db,
    *,
    email: str,
    password: str = "Password123!",
    actif_encadrement: bool = True,
):
    encadreur = Encadreur(
        nom="Enc",
        prenom="Adreur",
        email=email,
        motDePasse=hash_password(password),
        role=RoleEnum.ENCADREUR,
        actif=True,
        emailVerifie=True,
        matricule=f"ENC-{int(datetime.utcnow().timestamp() * 1000000)}",
        grade=GradeEnum.junior,
        departement=DepartementEnum.INFORMATIQUE,
        actif_encadrement=actif_encadrement,
        is_active=True,
        max_stagiaires=5,
    )
    db.add(encadreur)
    db.commit()
    db.refresh(encadreur)
    return encadreur


def create_demande(
    db,
    *,
    email: str,
    encadreur_id: int | None = None,
):
    demande = DemandeStage(
        nom="Nom",
        prenom="Prenom",
        email=email,
        telephone="55123456",
        etablissement="INSAT",
        niveau_etude=TypeStageEnum.PFE.value,
        departement_souhaite=DepartementEnum.INFORMATIQUE.value,
        date_debut_souhaitee=date(2026, 3, 1),
        date_fin_souhaitee=date(2026, 6, 1),
        competences=["Python"],
        tags=["Web"],
        statut=StatutDemandeEnum.EN_ATTENTE,
        encadreur_id=encadreur_id,
    )
    db.add(demande)
    db.commit()
    db.refresh(demande)
    return demande


def create_projet(db, *, code_projet: str = "PRJ-001"):
    projet = Projet(
        code_projet=code_projet,
        intitule="Projet Test",
        departement=DepartementEnum.INFORMATIQUE,
        type_stage=TypeStageEnum.PFE,
        description="Desc",
        objectifs="Obj",
        livrables="Liv",
        duree_semaines=12,
        charge_hebdo=35,
        competences=["Python"],
        tags=["Web"],
        complexite=3,
        priorite=3,
        status=ProjetStatusEnum.DISPONIBLE,
        nombre_max_stagiaires=1,
    )
    db.add(projet)
    db.commit()
    db.refresh(projet)
    return projet


@pytest.fixture
def make_user():
    return create_user


@pytest.fixture
def make_encadreur():
    return create_encadreur


@pytest.fixture
def make_demande():
    return create_demande


@pytest.fixture
def make_projet():
    return create_projet
