import json
import logging
import secrets
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.modules.demande_stage.models import DemandeStage
from app.modules.projet_stage.models import Projet
from app.modules.propositions_projets.models import PropositionProjet, StatutPropositionEnum
from app.modules.notifications.service import create_notification
from app.shared.enums import StatutDemandeEnum, ProjetStatusEnum, DepartementEnum
from app.modules.matching.scoring import calculate_final_match
from app.shared.sending_emails import send_email_with_template
from app.core.config import FRONTEND_URL
from fastapi import HTTPException

logger = logging.getLogger(__name__)


def _notify_encadreur_assignment(
    db: Session,
    encadreur_id: int,
    demande: DemandeStage | None = None,
    projet: Projet | None = None,
):
    if not encadreur_id:
        return

    stagiaire_label = f"{demande.prenom} {demande.nom}".strip() if demande else "un candidat"
    projet_label = projet.intitule if projet and projet.intitule else None
    message = (
        f'Vous etes assigne comme encadreur pour {stagiaire_label} sur le projet "{projet_label}".'
        if projet_label
        else f"Vous etes assigne comme encadreur pour {stagiaire_label}."
    )

    payload = json.dumps(
        {
            "type": "encadreur_assignment",
            "route": "/encadreur/dashboard",
            "demande_id": demande.id if demande else None,
            "projet_id": projet.id if projet else None,
        }
    )

    try:
        create_notification(
            db,
            user_id=encadreur_id,
            title="Nouvelle affectation d'encadrement",
            message=message,
            category="affectation",
            payload=payload,
        )
    except Exception:
        logger.exception(
            "Impossible de creer la notification encadreur (encadreur_id=%s, demande_id=%s)",
            encadreur_id,
            demande.id if demande else None,
        )


def assigner_encadreur(demande_id: int, encadreur_id: int, db: Session):
    """
    ADMIN assigne un encadreur à une demande de stage
    """
    from app.modules.encadreurs.models import Encadreur
    
    # Vérifier si la demande existe
    demande = db.query(DemandeStage).get(demande_id)
    if not demande:
        raise HTTPException(status_code=404, detail="Demande introuvable")
    
    # Vérifier si l'encadreur existe
    encadreur = db.query(Encadreur).get(encadreur_id)
    if not encadreur:
        raise HTTPException(status_code=404, detail="Encadreur introuvable")
    
    # Vérifier si l'encadreur est actif pour l'encadrement
    if not encadreur.actif_encadrement:
        raise HTTPException(status_code=400, detail="Cet encadreur n'est pas actif pour l'encadrement")
    
    # Mettre à jour la demande avec l'encadreur
    demande.encadreur_id = encadreur_id
    db.commit()
    db.refresh(demande)

    _notify_encadreur_assignment(
        db,
        encadreur_id=encadreur.id,
        demande=demande,
        projet=None,
    )
    
    return {
        "message": "Encadreur proposé, en attente de validation",
        "demande_id": demande_id,
        "encadreur_id": encadreur_id,
        "encadreur_nom": f"{encadreur.prenom} {encadreur.nom}",
        "stagiaire_nom": f"{demande.prenom} {demande.nom}"
    }


# ============ NEW AFFECTATION FUNCTIONS ============

async def create_affectation(affectation_data, db: Session):
    """
    Create a new affectation linking demand, project, and supervisor.
    """
    from app.modules.affectations.models import Affectation
    from app.modules.encadreurs.models import Encadreur
    from app.modules.stagiaires.models import Stagiaire
    
    # Validate demand exists
    demande = db.query(DemandeStage).filter(
        DemandeStage.id == affectation_data.demande_id
    ).first()
    if not demande:
        raise ValueError(f"Demand {affectation_data.demande_id} not found")
    
    # Ensure there is only one affectation per demande
    existing_for_demande = (
        db.query(Affectation)
        .filter(Affectation.demande_id == affectation_data.demande_id)
        .first()
    )
    if existing_for_demande:
        raise ValueError("Une affectation existe déjà pour cette demande")
    
    # Validate project exists
    projet = db.query(Projet).filter(
        Projet.id == affectation_data.projet_id
    ).first()
    if not projet:
        raise ValueError(f"Project {affectation_data.projet_id} not found")
    
    # Validate supervisor exists
    encadreur = db.query(Encadreur).filter(
        Encadreur.id == affectation_data.encadreur_id
    ).first()
    if not encadreur:
        raise ValueError(f"Supervisor {affectation_data.encadreur_id} not found")
    
    # Validate supervisor is active
    if not encadreur.actif_encadrement:
        raise ValueError("Supervisor is not active for mentoring")
    
    # Validate supervisor capacity
    current_stagiaires = len(encadreur.stagiaires) if hasattr(encadreur, 'stagiaires') else 0
    if current_stagiaires >= encadreur.max_stagiaires:
        raise ValueError(f"Supervisor has reached max capacity ({encadreur.max_stagiaires})")
    
    # Validate intern if provided
    if affectation_data.stagiaire_id:
        stagiaire = db.query(Stagiaire).filter(
            Stagiaire.id == affectation_data.stagiaire_id
        ).first()
        if not stagiaire:
            raise ValueError(f"Intern {affectation_data.stagiaire_id} not found")
    
    # Create affectation
    affectation = Affectation(
        demande_id=affectation_data.demande_id,
        projet_id=affectation_data.projet_id,
        encadreur_id=affectation_data.encadreur_id,
        stagiaire_id=None,
        date_debut_prevue=affectation_data.date_debut_prevue,
        date_fin_prevue=affectation_data.date_fin_prevue,
    )
    
    db.add(affectation)
    db.commit()
    db.refresh(affectation)

    _notify_encadreur_assignment(
        db,
        encadreur_id=encadreur.id,
        demande=demande,
        projet=projet,
    )
    
    return affectation


def get_affectation_by_id(affectation_id: int, db: Session):
    """
    Get affectation by ID with all related objects.
    """
    from app.modules.affectations.models import Affectation
    
    affectation = db.query(Affectation).filter(
        Affectation.id == affectation_id
    ).first()
    
    return affectation


def get_all_affectations(db: Session, skip: int = 0, limit: int = 100):
    """
    Get all affectations with pagination.
    """
    from app.modules.affectations.models import Affectation
    
    return db.query(Affectation).offset(skip).limit(limit).all()


async def update_affectation_status(affectation_id: int, affectation_data, db: Session):
    """
    Update affectation status or dates.
    """
    from app.modules.affectations.models import Affectation
    from app.modules.stagiaires.models import Stagiaire
    
    affectation = db.query(Affectation).filter(
        Affectation.id == affectation_id
    ).first()
    
    if not affectation:
        return None
    
    # Validate stagiaire if updating
    if affectation_data.stagiaire_id and affectation_data.stagiaire_id != affectation.stagiaire_id:
        stagiaire = db.query(Stagiaire).filter(
            Stagiaire.id == affectation_data.stagiaire_id
        ).first()
        if not stagiaire:
            raise ValueError(f"Intern {affectation_data.stagiaire_id} not found")
    
    # Update fields
    if affectation_data.statut:
        affectation.statut = affectation_data.statut
    
    if affectation_data.stagiaire_id:
        affectation.stagiaire_id = affectation_data.stagiaire_id
    
    if affectation_data.date_debut_prevue:
        affectation.date_debut_prevue = affectation_data.date_debut_prevue
    
    if affectation_data.date_fin_prevue:
        affectation.date_fin_prevue = affectation_data.date_fin_prevue
    
    db.commit()
    db.refresh(affectation)
    
    return affectation


def delete_affectation(affectation_id: int, db: Session) -> bool:
    """
    Delete/cancel an affectation.
    """
    from app.modules.affectations.models import Affectation
    
    affectation = db.query(Affectation).filter(
        Affectation.id == affectation_id
    ).first()
    
    if not affectation:
        return False
    
    db.delete(affectation)
    db.commit()
    
    return True


def get_affectations_by_stagiaire(stagiaire_id: int, db: Session):
    """
    Get all affectations for a specific intern.
    """
    from app.modules.affectations.models import Affectation
    
    return db.query(Affectation).filter(
        Affectation.stagiaire_id == stagiaire_id
    ).all()


def get_affectations_by_encadreur(encadreur_id: int, db: Session):
    """
    Get all affectations for a specific supervisor.
    """
    from app.modules.affectations.models import Affectation
    
    return db.query(Affectation).filter(
        Affectation.encadreur_id == encadreur_id
    ).all()


def get_affectations_by_projet(projet_id: int, db: Session):
    """
    Get all affectations for a specific project.
    """
    from app.modules.affectations.models import Affectation
    
    return db.query(Affectation).filter(
        Affectation.projet_id == projet_id
    ).all()
