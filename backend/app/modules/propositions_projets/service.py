import secrets
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import FRONTEND_URL
from app.modules.demande_stage.models import DemandeStage
from app.modules.matching.scoring import calculate_final_match
from app.modules.projet_stage.models import Projet
from app.modules.propositions_projets.models import PropositionProjet, StatutPropositionEnum
from app.shared.enums import DepartementEnum, ProjetStatusEnum, StatutDemandeEnum
from app.shared.sending_emails import send_email_with_template


async def proposer_top3_projets(demande_id: int, db: Session):
    demande = db.get(DemandeStage, demande_id)
    if not demande:
        raise HTTPException(status_code=404, detail=f"Demande {demande_id} introuvable")

    existing_proposition = (
        db.query(PropositionProjet)
        .filter(
            PropositionProjet.demande_id == demande_id,
            PropositionProjet.statut == StatutPropositionEnum.EN_ATTENTE,
        )
        .first()
    )

    if existing_proposition:
        raise HTTPException(
            status_code=409,
            detail="Des propositions en attente existent deja pour cette demande",
        )

    try:
        departement_enum = DepartementEnum(demande.departement_souhaite)
    except ValueError as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Departement invalide: {demande.departement_souhaite}",
        ) from exc

    projets = (
        db.query(Projet)
        .filter(
            Projet.status == ProjetStatusEnum.DISPONIBLE,
            Projet.departement == departement_enum,
        )
        .all()
    )

    results = []
    for projet in projets:
        score = calculate_final_match(demande, projet)
        if score is None:
            continue
        results.append(
            {
                "projet_id": projet.id,
                "code_projet": projet.code_projet,
                "intitule": projet.intitule,
                "departement": projet.departement.value,
                "type_stage": projet.type_stage.value if projet.type_stage else None,
                "score": score,
            }
        )

    results.sort(key=lambda x: x["score"], reverse=True)
    selected_projects = results[:3]

    if not selected_projects:
        raise HTTPException(
            status_code=400,
            detail="Aucun projet compatible disponible pour ce departement",
        )

    demande.statut = StatutDemandeEnum.EN_COURS

    main_token = secrets.token_urlsafe(32)
    date_expiration = datetime.utcnow() + timedelta(days=7)

    for projet_data in selected_projects:
        db.add(
            PropositionProjet(
                demande_id=demande_id,
                projet_id=projet_data["projet_id"],
                token=main_token,
                date_expiration=date_expiration,
                statut=StatutPropositionEnum.EN_ATTENTE,
            )
        )

    db.commit()

    selection_url = f"{FRONTEND_URL}/selection-projet?token={main_token}"

    email_result = await send_email_with_template(
        emails=[demande.email],
        subject="Selectionnez votre projet de stage - CNI",
        template_name="selection_projets.html",
        body={
            "prenom": demande.prenom,
            "nom": demande.nom,
            "selection_url": selection_url,
            "date_expiration": date_expiration.strftime("%d/%m/%Y a %H:%M"),
            "projets": selected_projects,
        },
    )

    if isinstance(email_result, dict) and "error" in email_result:
        return {
            "message": "Propositions creees mais envoi email echoue",
            "token": main_token,
            "projets": selected_projects,
            "count_propositions": len(selected_projects),
            "email_error": email_result.get("error"),
        }

    return {
        "message": f"{len(selected_projects)} projet(s) propose(s) et email envoye",
        "token": main_token,
        "projets": selected_projects,
        "count_propositions": len(selected_projects),
        "date_expiration": date_expiration.isoformat(),
    }


def choisir_projet(token: str, projet_id: int, db: Session):
    propositions = db.query(PropositionProjet).filter(PropositionProjet.token == token).all()

    if not propositions:
        raise HTTPException(status_code=404, detail="Token invalide")

    if propositions[0].date_expiration < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Token expire")

    if any(p.statut == StatutPropositionEnum.CHOISI for p in propositions):
        raise HTTPException(status_code=400, detail="Un projet a deja ete choisi")

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

    projet = db.get(Projet, projet_id)
    if projet:
        projet.status = ProjetStatusEnum.AFFECTE

    demande = db.get(DemandeStage, propositions[0].demande_id)
    if demande:
        demande.statut = StatutDemandeEnum.ACCEPTEE

    db.commit()

    return {
        "message": "Projet choisi et verrouille",
        "projet_id": projet_id,
        "projet_intitule": projet.intitule if projet else None,
    }


def voir_projets_choisis_encadreur(encadreur_id: int, db: Session):
    from app.modules.encadreurs.models import Encadreur

    encadreur = db.get(Encadreur, encadreur_id)
    if not encadreur:
        raise HTTPException(status_code=404, detail="Encadreur introuvable")

    propositions_choisies = (
        db.query(PropositionProjet)
        .join(Projet)
        .filter(
            PropositionProjet.statut == StatutPropositionEnum.CHOISI,
            Projet.departement == encadreur.departement,
        )
        .all()
    )

    resultats = []
    for prop in propositions_choisies:
        projet = db.get(Projet, prop.projet_id)
        demande = db.get(DemandeStage, prop.demande_id)

        if not projet or not demande:
            continue

        resultats.append(
            {
                "projet_id": projet.id,
                "code_projet": projet.code_projet,
                "intitule": projet.intitule,
                "description": projet.description,
                "stagiaire_nom": f"{demande.prenom} {demande.nom}",
                "stagiaire_email": demande.email,
                "date_choix": prop.date_choix.isoformat() if prop.date_choix else None,
                "demande_id": demande.id,
            }
        )

    return {
        "encadreur_id": encadreur_id,
        "departement": encadreur.departement.value if encadreur.departement else None,
        "projets_choisis": resultats,
    }
