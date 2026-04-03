from datetime import date

from app.core.security import hash_password
from app.modules.stage.models import Stage
from app.modules.stagiaires.models import Stagiaire
from app.shared.enums import RoleEnum, StatutStageEnum, TypeStageEnum


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


def test_encadreur_me_stagiaires_includes_stage_linked_intern(
    client,
    db_session,
    auth_as,
    make_encadreur,
    make_demande,
):
    encadreur = make_encadreur(db_session, email="enc.stage.list@example.com")
    demande = make_demande(
        db_session,
        email="demande.stage.list@example.com",
        encadreur_id=encadreur.id,
    )
    stagiaire = create_stagiaire(
        db_session,
        email="stagiaire.stage.list@example.com",
        encadreur_id=None,
    )

    db_session.add(
        Stage(
            demandestage_id=demande.id,
            stagiaire_id=stagiaire.id,
            encadreur_id=encadreur.id,
            projet_id=None,
            date_debut=date(2026, 3, 1),
            date_fin=date(2026, 6, 1),
            statut_stage=StatutStageEnum.EN_COURS,
            texte_objectif="Suivi du projet web",
        )
    )
    db_session.commit()

    with auth_as(encadreur):
        response = client.get("/encadreur/me/stagiaires")

    assert response.status_code == 200
    payload = response.json()
    assert [item["id"] for item in payload] == [stagiaire.id]


def test_encadreur_can_read_stage_linked_stagiaire_details(
    client,
    db_session,
    auth_as,
    make_encadreur,
    make_demande,
):
    encadreur = make_encadreur(db_session, email="enc.stage.detail@example.com")
    demande = make_demande(
        db_session,
        email="demande.stage.detail@example.com",
        encadreur_id=encadreur.id,
    )
    stagiaire = create_stagiaire(
        db_session,
        email="stagiaire.stage.detail@example.com",
        encadreur_id=None,
    )

    db_session.add(
        Stage(
            demandestage_id=demande.id,
            stagiaire_id=stagiaire.id,
            encadreur_id=encadreur.id,
            projet_id=None,
            date_debut=date(2026, 3, 1),
            date_fin=date(2026, 6, 1),
            statut_stage=StatutStageEnum.EN_COURS,
            texte_objectif="Encadrement detail",
        )
    )
    db_session.commit()

    with auth_as(encadreur):
        response = client.get(f"/stagiaires/{stagiaire.id}")

    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] == stagiaire.id
    assert payload["email"] == stagiaire.email
