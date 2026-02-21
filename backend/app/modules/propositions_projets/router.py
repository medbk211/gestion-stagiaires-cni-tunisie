from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db

from app.modules.propositions_projets import service

router = APIRouter()

@router.post("/demande/{demande_id}/proposer-projets")
async def proposer_projets(demande_id: int, db: Session = Depends(get_db)):
    return await service.proposer_top3_projets(demande_id, db)



@router.get("/list")
def list_all_propositions(db: Session = Depends(get_db)):
    from app.modules.propositions_projets.models import PropositionProjet
    from app.modules.demande_stage.models import DemandeStage
    from app.modules.projet_stage.models import Projet

    propositions = db.query(PropositionProjet).order_by(PropositionProjet.created_at.desc()).all()

    resultats = []
    for prop in propositions:
        demande = db.query(DemandeStage).get(prop.demande_id)
        projet = db.query(Projet).get(prop.projet_id)

        if demande and projet:
            resultats.append({
                "id": prop.id,
                "demande_id": demande.id,
                "stagiaire_nom": f"{demande.prenom} {demande.nom}",
                "stagiaire_email": demande.email,
                "projet_id": projet.id,
                "projet_code": projet.code_projet,
                "projet_intitule": projet.intitule,
                "departement": projet.departement.value if projet.departement else None,
                "statut": prop.statut.value,
                "token": prop.token,
                "date_expiration": prop.date_expiration.isoformat() if prop.date_expiration else None,
                "date_choix": prop.date_choix.isoformat() if prop.date_choix else None,
                "created_at": prop.created_at.isoformat() if prop.created_at else None
            })

    return resultats
