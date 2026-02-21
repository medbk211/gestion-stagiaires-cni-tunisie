from app.shared.enums import RoleEnum


def test_demande_options_public_endpoint(client):
    response = client.get("/projets-stage/demandes-stage/options")
    assert response.status_code == 200
    payload = response.json()
    assert "departements" in payload
    assert "types_stage" in payload
    assert "competences_by_departement" in payload
    assert "tags" in payload


def test_create_demande_stage_success(client):
    response = client.post(
        "/projets-stage/demandes-stage",
        data={
            "nom": "Ali",
            "prenom": "Briki",
            "email": "ali.demande@example.com",
            "telephone": "55112233",
            "etablissement": "ENIT",
            "niveau_etude": "PFE",
            "departement_souhaite": "INFORMATIQUE",
            "date_debut_souhaitee": "2026-03-01",
            "date_fin_souhaitee": "2026-06-01",
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["id"] > 0
    assert payload["message"]


def test_list_demandes_requires_auth(client):
    response = client.get("/projets-stage/demandes-stage")
    assert response.status_code == 401


def test_admin_can_list_demandes(client, db_session, auth_as, make_user, make_demande):
    admin = make_user(
        db_session,
        email="admin.demandes@example.com",
        role=RoleEnum.ADMIN,
        password="Password123!",
    )
    make_demande(db_session, email="stagiaire.demandes@example.com")

    with auth_as(admin):
        response = client.get("/projets-stage/demandes-stage")

    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) == 1
