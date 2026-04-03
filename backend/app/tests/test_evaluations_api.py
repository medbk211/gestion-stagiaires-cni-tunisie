from datetime import date

from app.core.security import hash_password
from app.modules.stage.models import Stage
from app.modules.stagiaires.models import Stagiaire
from app.modules.tasks.models import Task
from app.shared.enums import (
    RoleEnum,
    StatutStageEnum,
    TypeStageEnum,
    taskPriorityEnum,
    taskStatusEnum,
)


def create_stagiaire(
    db,
    *,
    email: str,
    encadreur_id: int | None = None,
):
    stagiaire = Stagiaire(
        nom="Sta",
        prenom="Giaire",
        email=email,
        motDePasse=hash_password("Password123!"),
        role=RoleEnum.STAGIAIRE,
        actif=True,
        emailVerifie=True,
        matricule=f"STG-{email.split('@', 1)[0]}",
        type_stage=TypeStageEnum.PFE,
        statut_stage=StatutStageEnum.EN_COURS,
        date_debut_stage=date(2026, 3, 1),
        date_fin_stage=date(2026, 6, 1),
        etablissement="INSAT",
        niveau_etude="MASTER",
        encadreur_id=encadreur_id,
    )
    db.add(stagiaire)
    db.commit()
    db.refresh(stagiaire)
    return stagiaire


def create_stage(
    db,
    *,
    demande_id: int,
    stagiaire_id: int,
    encadreur_id: int,
    projet_id: int,
):
    stage = Stage(
        demandestage_id=demande_id,
        stagiaire_id=stagiaire_id,
        encadreur_id=encadreur_id,
        projet_id=projet_id,
        date_debut=date(2026, 3, 1),
        date_fin=date(2026, 6, 1),
        statut_stage=StatutStageEnum.EN_COURS,
        texte_objectif="Evaluation finale du stage",
    )
    db.add(stage)
    db.commit()
    db.refresh(stage)
    return stage


def create_task(
    db,
    *,
    stage_id: int,
    projet_id: int,
    encadreur_id: int,
    title: str,
    status: taskStatusEnum,
):
    task = Task(
        title=title,
        description="Task de test",
        stage_id=stage_id,
        projet_id=projet_id,
        created_by=encadreur_id,
        status=status,
        priority=taskPriorityEnum.MEDIUM,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def test_encadreur_cannot_create_evaluation_until_all_tasks_are_completed(
    client,
    db_session,
    auth_as,
    make_encadreur,
    make_demande,
    make_projet,
):
    encadreur = make_encadreur(db_session, email="enc.eval.blocked@example.com")
    demande = make_demande(
        db_session,
        email="demande.eval.blocked@example.com",
        encadreur_id=encadreur.id,
    )
    projet = make_projet(db_session, code_projet="PRJ-EVAL-BLOCKED")
    stagiaire = create_stagiaire(
        db_session,
        email="stagiaire.eval.blocked@example.com",
        encadreur_id=encadreur.id,
    )
    stage = create_stage(
        db_session,
        demande_id=demande.id,
        stagiaire_id=stagiaire.id,
        encadreur_id=encadreur.id,
        projet_id=projet.id,
    )

    create_task(
        db_session,
        stage_id=stage.id,
        projet_id=projet.id,
        encadreur_id=encadreur.id,
        title="Tache en cours",
        status=taskStatusEnum.IN_PROGRESS,
    )
    create_task(
        db_session,
        stage_id=stage.id,
        projet_id=projet.id,
        encadreur_id=encadreur.id,
        title="Tache validee",
        status=taskStatusEnum.VALIDATED,
    )

    with auth_as(encadreur):
        response = client.post(
            "/evaluations/",
            json={
                "stagiaire_id": stagiaire.id,
                "projet_id": projet.id,
                "note": 15,
                "commentaire": "Pret presque final",
            },
        )

    assert response.status_code == 400
    assert "terminer toutes ses taches" in response.json()["detail"]


def test_encadreur_can_create_evaluation_when_all_tasks_are_completed(
    client,
    db_session,
    auth_as,
    make_encadreur,
    make_demande,
    make_projet,
):
    encadreur = make_encadreur(db_session, email="enc.eval.ready@example.com")
    demande = make_demande(
        db_session,
        email="demande.eval.ready@example.com",
        encadreur_id=encadreur.id,
    )
    projet = make_projet(db_session, code_projet="PRJ-EVAL-READY")
    stagiaire = create_stagiaire(
        db_session,
        email="stagiaire.eval.ready@example.com",
        encadreur_id=encadreur.id,
    )
    stage = create_stage(
        db_session,
        demande_id=demande.id,
        stagiaire_id=stagiaire.id,
        encadreur_id=encadreur.id,
        projet_id=projet.id,
    )

    create_task(
        db_session,
        stage_id=stage.id,
        projet_id=projet.id,
        encadreur_id=encadreur.id,
        title="Tache soumise",
        status=taskStatusEnum.DONE,
    )
    create_task(
        db_session,
        stage_id=stage.id,
        projet_id=projet.id,
        encadreur_id=encadreur.id,
        title="Tache validee",
        status=taskStatusEnum.VALIDATED,
    )

    with auth_as(encadreur):
        response = client.post(
            "/evaluations/",
            json={
                "stagiaire_id": stagiaire.id,
                "projet_id": projet.id,
                "note": 18,
                "commentaire": "Tres bon travail",
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["stagiaire_id"] == stagiaire.id
    assert payload["projet_id"] == projet.id
    assert payload["note"] == 18

    db_session.refresh(stagiaire)
    assert stagiaire.note_finale == 18
    assert stagiaire.date_validation is not None
