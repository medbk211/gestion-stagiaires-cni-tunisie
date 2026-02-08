from datetime import datetime
from app.modules.stagiaires.models import Stagiaire

def generate_matricule(db):
    year = datetime.now().year

    last_stagiaire = (
        db.query(Stagiaire)
        .filter(Stagiaire.matricule.like(f"STG-{year}-%"))
        .order_by(Stagiaire.id.desc())
        .first()
    )

    if last_stagiaire:
        last_number = int(last_stagiaire.matricule.split("-")[-1])
        new_number = last_number + 1
    else:
        new_number = 1

    return f"STG-{year}-{new_number:04d}"