"""
Service des statistiques pour le tableau de bord admin.
Agrège les comptes depuis les tables existantes (demandes, stagiaires, encadreurs, documents, affectations, projets).
"""
from sqlalchemy.orm import Session
from sqlalchemy import func


def get_dashboard_stats(db: Session) -> dict:
    """
    Retourne toutes les statistiques nécessaires au dashboard admin.
    """
    from app.modules.demande_stage.models import DemandeStage
    from app.modules.stagiaires.models import Stagiaire
    from app.modules.encadreurs.models import Encadreur
    from app.modules.document.models import Document
    from app.modules.affectations.models import Affectation
    from app.modules.projet_stage.models import Projet

    # Comptes globaux
    total_demandes = db.query(func.count(DemandeStage.id)).scalar() or 0
    total_stagiaires = db.query(func.count(Stagiaire.id)).scalar() or 0
    total_encadreurs = db.query(func.count(Encadreur.id)).scalar() or 0
    total_documents = db.query(func.count(Document.id)).scalar() or 0
    total_affectations = db.query(func.count(Affectation.id)).scalar() or 0
    total_projets = db.query(func.count(Projet.id)).scalar() or 0

    # Demandes par statut
    demandes_par_statut = (
        db.query(DemandeStage.statut, func.count(DemandeStage.id))
        .group_by(DemandeStage.statut)
        .all()
    )
    demandes_par_statut_list = [
        {"statut": s.value if hasattr(s, "value") else str(s), "count": c}
        for s, c in demandes_par_statut
    ]

    # Affectations par statut
    affectations_par_statut = (
        db.query(Affectation.statut, func.count(Affectation.id))
        .group_by(Affectation.statut)
        .all()
    )
    affectations_par_statut_list = [
        {"statut": s.value if hasattr(s, "value") else str(s), "count": c}
        for s, c in affectations_par_statut
    ]

    # Projets par statut
    projets_par_statut = (
        db.query(Projet.status, func.count(Projet.id))
        .group_by(Projet.status)
        .all()
    )
    projets_par_statut_list = [
        {"statut": s.value if hasattr(s, "value") else str(s), "count": c}
        for s, c in projets_par_statut
    ]

    # Projets par département
    projets_par_departement = (
        db.query(Projet.departement, func.count(Projet.id))
        .group_by(Projet.departement)
        .all()
    )
    projets_par_departement_list = [
        {"departement": d.value if hasattr(d, "value") else (str(d) if d else "N/A"), "count": c}
        for d, c in projets_par_departement
    ]

    # Dernières demandes (activité récente)
    dernieres_demandes = (
        db.query(DemandeStage)
        .order_by(DemandeStage.created_at.desc())
        .limit(8)
        .all()
    )
    activite_recente = []
    for d in dernieres_demandes:
        statut_val = d.statut.value if hasattr(d.statut, "value") else str(d.statut)
        activite_recente.append({
            "id": d.id,
            "nom": f"{d.prenom} {d.nom}",
            "action": "demande déposée",
            "statut": statut_val,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        })

    return {
        "totaux": {
            "demandes": total_demandes,
            "stagiaires": total_stagiaires,
            "encadreurs": total_encadreurs,
            "documents": total_documents,
            "affectations": total_affectations,
            "projets": total_projets,
        },
        "demandes_par_statut": demandes_par_statut_list,
        "affectations_par_statut": affectations_par_statut_list,
        "projets_par_statut": projets_par_statut_list,
        "projets_par_departement": projets_par_departement_list,
        "activite_recente": activite_recente,
    }
