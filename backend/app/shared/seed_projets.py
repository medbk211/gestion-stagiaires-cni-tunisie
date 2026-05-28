from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.modules.encadreurs.models import Encadreur
from app.shared.enums import DepartementEnum, GradeEnum, RoleEnum

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def seed_encadreurs():
    db: Session = SessionLocal()

    default_password = "Encadreur@123"  # تنجم تبدلو كيف تحب

    encadreurs = [
        Encadreur(
            nom="Ben Salem",
            prenom="Aymen",
            email="aymen.bensalem@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC001",
            grade=GradeEnum.junior,
            departement=DepartementEnum.INFORMATIQUE,
            actif_encadrement=True
        ),
        Encadreur(
            nom="Trabelsi",
            prenom="Sana",
            email="sana.trabelsi@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC002",
            grade=GradeEnum.senior,
            departement=DepartementEnum.RH,
            actif_encadrement=True
        ),
        Encadreur(
            nom="Gharbi",
            prenom="Mohamed",
            email="mohamed.gharbi@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC003",
            grade=GradeEnum.expert,
            departement=DepartementEnum.FINANCES,
            actif_encadrement=True
        ),
        Encadreur(
            nom="Khemiri",
            prenom="Ines",
            email="ines.khemiri@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC004",
            grade=GradeEnum.junior,
            departement=DepartementEnum.EXPLOITATION,
            actif_encadrement=True
        ),
        Encadreur(
            nom="Bouaziz",
            prenom="Youssef",
            email="youssef.bouaziz@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC005",
            grade=GradeEnum.senior,
            departement=DepartementEnum.SUPPORT,
            actif_encadrement=True
        ),
        Encadreur(
            nom="Haddad",
            prenom="Rim",
            email="rim.haddad@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC006",
            grade=GradeEnum.expert,
            departement=DepartementEnum.ADMINISTRATION,
            actif_encadrement=True
        ),
        Encadreur(
            nom="Jlassi",
            prenom="Wael",
            email="wael.jlassi@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC007",
            grade=GradeEnum.junior,
            departement=DepartementEnum.INFORMATIQUE,
            actif_encadrement=True
        ),
        Encadreur(
            nom="Saidi",
            prenom="Amira",
            email="amira.saidi@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC008",
            grade=GradeEnum.senior,
            departement=DepartementEnum.RH,
            actif_encadrement=True
        ),
        Encadreur(
            nom="Bouzid",
            prenom="Ahmed",
            email="ahmed.bouzid@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC009",
            grade=GradeEnum.expert,
            departement=DepartementEnum.FINANCES,
            actif_encadrement=True
        ),
        Encadreur(
            nom="Chaabane",
            prenom="Sarra",
            email="sarra.chaabane@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC010",
            grade=GradeEnum.junior,
            departement=DepartementEnum.EXPLOITATION,
            actif_encadrement=True
        ),
        Encadreur(
            nom="Mansour",
            prenom="Nour",
            email="nour.mansour@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC011",
            grade=GradeEnum.senior,
            departement=DepartementEnum.SUPPORT,
            actif_encadrement=True
        ),
        Encadreur(
            nom="Kammoun",
            prenom="Houssem",
            email="houssem.kammoun@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC012",
            grade=GradeEnum.expert,
            departement=DepartementEnum.ADMINISTRATION,
            actif_encadrement=True
        ),
        Encadreur(
            nom="Mejri",
            prenom="Fares",
            email="fares.mejri@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC013",
            grade=GradeEnum.junior,
            departement=DepartementEnum.INFORMATIQUE,
            actif_encadrement=True
        ),
        Encadreur(
            nom="Baccouche",
            prenom="Hajar",
            email="hajar.baccouche@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC014",
            grade=GradeEnum.senior,
            departement=DepartementEnum.RH,
            actif_encadrement=True
        ),
        Encadreur(
            nom="Sassi",
            prenom="Malek",
            email="malek.sassi@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC015",
            grade=GradeEnum.expert,
            departement=DepartementEnum.FINANCES,
            actif_encadrement=True
        ),
        Encadreur(
            nom="Ferjani",
            prenom="Yassine",
            email="yassine.ferjani@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC016",
            grade=GradeEnum.junior,
            departement=DepartementEnum.EXPLOITATION,
            actif_encadrement=True
        ),
        Encadreur(
            nom="Zouari",
            prenom="Asma",
            email="asma.zouari@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC017",
            grade=GradeEnum.senior,
            departement=DepartementEnum.SUPPORT,
            actif_encadrement=True
        ),
        Encadreur(
            nom="Ben Youssef",
            prenom="Karim",
            email="karim.benyoussef@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC018",
            grade=GradeEnum.expert,
            departement=DepartementEnum.ADMINISTRATION,
            actif_encadrement=True
        ),
        Encadreur(
            nom="Ayari",
            prenom="Mariem",
            email="mariem.ayari@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC019",
            grade=GradeEnum.junior,
            departement=DepartementEnum.INFORMATIQUE,
            actif_encadrement=True
        ),
        Encadreur(
            nom="Hamdi",
            prenom="Slim",
            email="slim.hamdi@example.com",
            motDePasse=hash_password(default_password),
            role=RoleEnum.ENCADREUR,
            matricule="ENC020",
            grade=GradeEnum.senior,
            departement=DepartementEnum.EXPLOITATION,
            actif_encadrement=True
        ),
    ]

    try:
        db.add_all(encadreurs)
        db.commit()
        print("✅ 20 encadreurs insérés avec succès")
        print(f"🔑 Mot de passe par défaut: {default_password}")
    except Exception as e:
        db.rollback()
        print("❌ Erreur :", e)
    finally:
        db.close()


if __name__ == "__main__":
    seed_encadreurs()
