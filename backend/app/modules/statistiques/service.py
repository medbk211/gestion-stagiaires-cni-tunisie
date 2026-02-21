"""
Service des statistiques pour les tableaux de bord.
"""

from datetime import date, datetime, time

from sqlalchemy import func
from sqlalchemy.orm import Session


def _apply_date_range(query, model, start_date: date | None, end_date: date | None):
    if start_date:
        query = query.filter(model.created_at >= datetime.combine(start_date, time.min))
    if end_date:
        query = query.filter(model.created_at <= datetime.combine(end_date, time.max))
    return query


def get_dashboard_stats(
    db: Session,
    start_date: date | None = None,
    end_date: date | None = None,
    departement: str | None = None,
    encadreur_id: int | None = None,
) -> dict:
    from app.modules.affectations.models import Affectation
    from app.modules.demande_stage.models import DemandeStage
    from app.modules.document.models import Document
    from app.modules.encadreurs.models import Encadreur
    from app.modules.projet_stage.models import Projet
    from app.modules.stagiaires.models import Stagiaire

    demandes_query = db.query(DemandeStage)
    demandes_query = _apply_date_range(demandes_query, DemandeStage, start_date, end_date)
    if departement:
        demandes_query = demandes_query.filter(DemandeStage.departement_souhaite == departement)
    if encadreur_id:
        demandes_query = demandes_query.filter(DemandeStage.encadreur_id == encadreur_id)

    total_demandes = demandes_query.with_entities(func.count(DemandeStage.id)).scalar() or 0
    total_stagiaires = db.query(func.count(Stagiaire.id)).scalar() or 0
    total_encadreurs = db.query(func.count(Encadreur.id)).scalar() or 0
    documents_query = db.query(Document)
    if start_date:
        documents_query = documents_query.filter(Document.created_at >= datetime.combine(start_date, time.min))
    if end_date:
        documents_query = documents_query.filter(Document.created_at <= datetime.combine(end_date, time.max))
    total_documents = documents_query.with_entities(func.count(Document.id)).scalar() or 0
    total_affectations = db.query(func.count(Affectation.id)).scalar() or 0

    projets_query = db.query(Projet)
    if departement:
        projets_query = projets_query.filter(Projet.departement == departement)
    total_projets = projets_query.with_entities(func.count(Projet.id)).scalar() or 0

    demandes_par_statut = (
        demandes_query.with_entities(DemandeStage.statut, func.count(DemandeStage.id))
        .group_by(DemandeStage.statut)
        .all()
    )
    demandes_par_statut_list = [
        {'statut': s.value if hasattr(s, 'value') else str(s), 'count': c}
        for s, c in demandes_par_statut
    ]

    affectations_par_statut = (
        db.query(Affectation.statut, func.count(Affectation.id)).group_by(Affectation.statut).all()
    )
    affectations_par_statut_list = [
        {'statut': s.value if hasattr(s, 'value') else str(s), 'count': c}
        for s, c in affectations_par_statut
    ]

    projets_par_statut = (
        projets_query.with_entities(Projet.status, func.count(Projet.id)).group_by(Projet.status).all()
    )
    projets_par_statut_list = [
        {'statut': s.value if hasattr(s, 'value') else str(s), 'count': c}
        for s, c in projets_par_statut
    ]

    projets_par_departement = (
        projets_query.with_entities(Projet.departement, func.count(Projet.id))
        .group_by(Projet.departement)
        .all()
    )
    projets_par_departement_list = [
        {
            'departement': d.value if hasattr(d, 'value') else (str(d) if d else 'N/A'),
            'count': c,
        }
        for d, c in projets_par_departement
    ]

    dernieres_demandes = demandes_query.order_by(DemandeStage.created_at.desc()).limit(8).all()
    activite_recente = []
    for d in dernieres_demandes:
        statut_val = d.statut.value if hasattr(d.statut, 'value') else str(d.statut)
        activite_recente.append(
            {
                'id': d.id,
                'nom': f'{d.prenom} {d.nom}',
                'action': 'demande deposee',
                'statut': statut_val,
                'created_at': d.created_at.isoformat() if d.created_at else None,
            }
        )

    return {
        'totaux': {
            'demandes': total_demandes,
            'stagiaires': total_stagiaires,
            'encadreurs': total_encadreurs,
            'documents': total_documents,
            'affectations': total_affectations,
            'projets': total_projets,
        },
        'demandes_par_statut': demandes_par_statut_list,
        'affectations_par_statut': affectations_par_statut_list,
        'projets_par_statut': projets_par_statut_list,
        'projets_par_departement': projets_par_departement_list,
        'activite_recente': activite_recente,
    }


def get_encadreur_overview(db: Session, encadreur_id: int) -> dict:
    from app.modules.evaluation.models import Evaluation
    from app.modules.stage.models import Stage
    from app.modules.tasks.models import Task
    from app.shared.enums import taskStatusEnum

    total_stages = db.query(func.count(Stage.id)).filter(Stage.encadreur_id == encadreur_id).scalar() or 0
    total_tasks = (
        db.query(func.count(Task.id))
        .join(Stage, Stage.id == Task.stage_id)
        .filter(Stage.encadreur_id == encadreur_id)
        .scalar()
        or 0
    )
    tasks_validated = (
        db.query(func.count(Task.id))
        .join(Stage, Stage.id == Task.stage_id)
        .filter(Stage.encadreur_id == encadreur_id, Task.status == taskStatusEnum.VALIDATED)
        .scalar()
        or 0
    )
    tasks_in_review = (
        db.query(func.count(Task.id))
        .join(Stage, Stage.id == Task.stage_id)
        .filter(Stage.encadreur_id == encadreur_id, Task.status == taskStatusEnum.DONE)
        .scalar()
        or 0
    )
    evaluations_count = db.query(func.count(Evaluation.id)).filter(Evaluation.encadreur_id == encadreur_id).scalar() or 0

    return {
        'totaux': {
            'stages': total_stages,
            'tasks': total_tasks,
            'tasks_validated': tasks_validated,
            'tasks_in_review': tasks_in_review,
            'evaluations': evaluations_count,
        }
    }
