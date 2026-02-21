import json
import logging
import secrets
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.modules.demande_stage.models import DemandeStage
from app.modules.projet_stage.models import Projet
from app.modules.propositions_projets.models import PropositionProjet, StatutPropositionEnum
from app.modules.choix_projet.models import ChoixProjet
from app.modules.notifications.service import create_notification
from app.modules.utilisateur.models import Utilisateur
from app.shared.enums import RoleEnum, StatutDemandeEnum, ProjetStatusEnum
from fastapi import HTTPException

logger = logging.getLogger(__name__)


def _notify_admins_project_selection(db: Session, demande: DemandeStage | None, projet: Projet | None):
    if not demande:
        return

    admins = db.query(Utilisateur).filter(Utilisateur.role == RoleEnum.ADMIN).all()
    if not admins:
        return

    candidat_nom = f"{demande.prenom} {demande.nom}".strip()
    projet_label = projet.intitule if projet and projet.intitule else "projet selectionne"
    route = f"/admin/demandes/{demande.id}"
    payload = json.dumps(
        {
            "type": "project_selection",
            "route": route,
            "demande_id": demande.id,
        }
    )

    for admin in admins:
        try:
            create_notification(
                db,
                user_id=admin.id,
                title="Projet choisi par un candidat",
                message=f'{candidat_nom} a choisi le projet "{projet_label}".',
                category="project_selection",
                payload=payload,
            )
        except Exception:
            logger.exception(
                "Impossible de creer la notification admin (user_id=%s, demande_id=%s)",
                admin.id,
                demande.id,
            )





def voir_projets_par_token(token: str, db: Session):
    propositions = (
        db.query(PropositionProjet)
        .filter(PropositionProjet.token == token)
        .all()
    )

    if not propositions:
        raise HTTPException(status_code=404, detail="Token invalide")

    if propositions[0].date_expiration < datetime.utcnow():
        for prop in propositions:
            if prop.statut == StatutPropositionEnum.EN_ATTENTE:
                prop.statut = StatutPropositionEnum.EXPIRE
        db.commit()
        raise HTTPException(status_code=410, detail="Token expiré")

    if any(p.statut == StatutPropositionEnum.CHOISI for p in propositions):
        raise HTTPException(status_code=400, detail="Un projet a déjà été choisi")

    projets_details = []
    for prop in propositions:
        projet = db.query(Projet).get(prop.projet_id)
        if projet:
            projets_details.append({
                "projet_id": projet.id,
                "code_projet": projet.code_projet,
                "intitule": projet.intitule,
                "description": projet.description,
                "objectifs": projet.objectifs,
                "livrables": projet.livrables,
                "departement": projet.departement.value,
                "type_stage": projet.type_stage.value if projet.type_stage else None,
                "duree_semaines": projet.duree_semaines,
                "niveau_requis": projet.niveau_requis.value if projet.niveau_requis else None,
                "competences": projet.competences or []
            })

    return {
        "projets": projets_details,
        "date_expiration": propositions[0].date_expiration.isoformat()
    }


def choisir_projet(token: str, projet_id: int, db: Session):
    propositions = (
        db.query(PropositionProjet)
        .filter(PropositionProjet.token == token)
        .all()
    )

    if not propositions:
        raise HTTPException(status_code=404, detail="Token invalide")

    if propositions[0].date_expiration < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Token expiré")

    if any(p.statut == StatutPropositionEnum.CHOISI for p in propositions):
        raise HTTPException(status_code=400, detail="Un projet a déjà été choisi")

    proposition_choisie = None
    for prop in propositions:
        if prop.projet_id == projet_id:
            proposition_choisie = prop
            break

    if not proposition_choisie:
        raise HTTPException(status_code=400, detail="Ce projet n'est pas dans les propositions")

    proposition_choisie.statut = StatutPropositionEnum.CHOISI
    proposition_choisie.date_choix = datetime.utcnow()

    for prop in propositions:
        if prop.id != proposition_choisie.id:
            prop.statut = StatutPropositionEnum.EXPIRE

    projet = db.query(Projet).get(projet_id)
    if projet:
        projet.status = ProjetStatusEnum.AFFECTE
    
    demande = db.query(DemandeStage).get(propositions[0].demande_id)
    
    choix = ChoixProjet(
        demande_id=demande.id if demande else propositions[0].demande_id,
        projet_id=projet_id,
        date_choix=datetime.utcnow()
    )
    db.add(choix)
    db.commit()

    _notify_admins_project_selection(db, demande, projet)





    return {
        "message": "Projet choisi et verrouillé ✅",
        "projet_id": projet_id,
        "projet_intitule": projet.intitule if projet else None
    }


def voir_projets_choisis_encadreur(encadreur_id: int, db: Session):
    from app.modules.encadreurs.models import Encadreur

    encadreur = db.query(Encadreur).get(encadreur_id)
    if not encadreur:
        raise HTTPException(status_code=404, detail="Encadreur introuvable")

    propositions_choisies = (
        db.query(PropositionProjet)
        .join(Projet)
        .filter(
            PropositionProjet.statut == StatutPropositionEnum.CHOISI,
            Projet.departement == encadreur.departement
        )
        .all()
    )

    resultats = []
    for prop in propositions_choisies:
        projet = db.query(Projet).get(prop.projet_id)
        demande = db.query(DemandeStage).get(prop.demande_id)

        if projet and demande:
            resultats.append({
                "projet_id": projet.id,
                "code_projet": projet.code_projet,
                "intitule": projet.intitule,
                "description": projet.description,
                "stagiaire_nom": f"{demande.prenom} {demande.nom}",
                "stagiaire_email": demande.email,
                "date_choix": prop.date_choix.isoformat() if prop.date_choix else None,
                "demande_id": demande.id
            })

    return {
        "encadreur_id": encadreur_id,
        "departement": encadreur.departement.value if encadreur.departement else None,
        "projets_choisis": resultats
    }
