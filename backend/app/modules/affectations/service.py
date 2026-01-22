import secrets
from sqlalchemy.orm import Session
from app.modules.demande_stage.models import DemandeStage
from app.modules.projet_stage.models import Projet
from app.shared.enums import StatutDemandeEnum, ProjetStatusEnum

from app.modules.matching.scoring import calculate_final_match
# from app.services.mail import send_mail


def     proposer_top3_projets(demande_id: int, db: Session):
    demande = db.query(DemandeStage).get(demande_id)
    if not demande:
        raise ValueError("Demande introuvable")

    projets = (
    db.query(Projet)
    .filter(
        Projet.status == ProjetStatusEnum.DISPONIBLE,
        Projet.departement == demande.departement_souhaite
    )
    .all()
)


    results = []

    for projet in projets:
        score = calculate_final_match(demande, projet)

        results.append({
            "projet_id": projet.id,
            "code_projet": projet.code_projet,
            "intitule": projet.intitule,
            "departement": projet.departement.value,
            "type_stage": projet.type_stage.value if projet.type_stage else None,

            "score": score
        })

    
    results.sort(key=lambda x: x["score"], reverse=True)

    top3 = results[:3]

   

    return top3
