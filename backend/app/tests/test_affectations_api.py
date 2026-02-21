from app.shared.enums import RoleEnum


def test_assign_encadreur_requires_admin(client, db_session, make_demande, make_encadreur):
    demande = make_demande(db_session, email="assign.noauth@example.com")
    encadreur = make_encadreur(db_session, email="enc.noauth@example.com")

    response = client.post(
        "/affectation/assign-encadreur",
        json={"demande_id": demande.id, "encadreur_id": encadreur.id},
    )
    assert response.status_code == 401


def test_admin_can_assign_encadreur(
    client,
    db_session,
    auth_as,
    make_user,
    make_demande,
    make_encadreur,
):
    admin = make_user(
        db_session,
        email="admin.assign@example.com",
        role=RoleEnum.ADMIN,
        password="Password123!",
    )
    demande = make_demande(db_session, email="assign.ok@example.com")
    encadreur = make_encadreur(db_session, email="enc.assign@example.com")

    with auth_as(admin):
        response = client.post(
            "/affectation/assign-encadreur",
            json={"demande_id": demande.id, "encadreur_id": encadreur.id},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["demande_id"] == demande.id
    assert payload["encadreur_id"] == encadreur.id


def test_admin_can_create_affectation(
    client,
    db_session,
    auth_as,
    make_user,
    make_demande,
    make_encadreur,
    make_projet,
):
    admin = make_user(
        db_session,
        email="admin.create.aff@example.com",
        role=RoleEnum.ADMIN,
        password="Password123!",
    )
    demande = make_demande(db_session, email="create.aff@example.com")
    encadreur = make_encadreur(db_session, email="enc.create.aff@example.com")
    projet = make_projet(db_session, code_projet="PRJ-AFF-001")

    with auth_as(admin):
        response = client.post(
            "/affectation/",
            json={
                "demande_id": demande.id,
                "projet_id": projet.id,
                "encadreur_id": encadreur.id,
            },
        )

    assert response.status_code == 201
    payload = response.json()
    assert payload["demande_id"] == demande.id
    assert payload["projet_id"] == projet.id
    assert payload["encadreur_id"] == encadreur.id
