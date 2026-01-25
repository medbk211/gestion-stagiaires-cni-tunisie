from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.modules.affectations.schemas import (
    AssignEncadreurRequest,
    ChoixProjetRequest
)
from app.modules.affectations.service import (
    proposer_top3_projets,
    voir_projets_par_token,
    choisir_projet,
    voir_projets_choisis_encadreur
)
from app.modules.demande_stage.models import DemandeStage
from app.modules.projet_stage.models import Projet

router = APIRouter()


@router.post("/demande/{demande_id}/proposer-projets")
async def proposer_projets(demande_id: int, db: Session = Depends(get_db)):
    """
    ADMIN propose 3 projets → SYSTEM crée tokens + envoie mail
    """
    try:
        return await proposer_top3_projets(demande_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/selection-projet")
def get_projets_par_token(token: str, db: Session = Depends(get_db)):
    """
    STAGIAIRE (offline) clique lien → voit les 3 projets
    """
    return voir_projets_par_token(token, db)


@router.post("/choisir-projet")
def post_choisir_projet(payload: ChoixProjetRequest, db: Session = Depends(get_db)):
    """
    STAGIAIRE choisit 1 projet → SYSTEM verrouille choix
    """
    return choisir_projet(payload.token, payload.projet_id, db)


@router.get("/encadreur/{encadreur_id}/projets-choisis")
def get_projets_choisis_encadreur(encadreur_id: int, db: Session = Depends(get_db)):
    """
    ENCADREUR voit projets choisis
    """
    return voir_projets_choisis_encadreur(encadreur_id, db)


@router.post("/assign-encadreur")
def assigner_encadreur(payload: AssignEncadreurRequest):
    return {"message": "Encadreur assigné avec succès"}


@router.get("/list")
def list_all_propositions(db: Session = Depends(get_db)):
    """
    ADMIN voit toutes les propositions/affectations
    """
    from app.modules.affectations.models import PropositionProjet
    
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
