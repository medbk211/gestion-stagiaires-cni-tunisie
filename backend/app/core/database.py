# app/core/database.py
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import DATABASE_URL


engine = create_engine(
    DATABASE_URL,
    echo=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# ✅ Register models here (important for relationships)
from app.modules.utilisateur.models import Utilisateur
from app.modules.auth.models import ResetMotDePasse
from app.modules.encadreurs.models import Encadreur
from app.modules.stagiaires.models import Stagiaire
from app.modules.demande_stage.models import DemandeStage
from app.modules.stage.models import Stage
from app.modules.document.models import Document
# from app.modules.evaluation.models import Evaluation
from app.modules.projet_stage.models import Projet
from app.modules.propositions_projets.models import PropositionProjet
# from app.modules.affectations.models import Affectation


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
            db.close()


def test_db_connection():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("✅ Connected")
    except Exception as e:
        print("❌ Connection failed:", e)
