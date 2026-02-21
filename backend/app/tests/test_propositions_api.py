def test_proposer_projets_accepts_less_than_three_available(
    client,
    db_session,
    make_demande,
    make_projet,
):
    demande = make_demande(db_session, email="proposition.2@example.com")
    make_projet(db_session, code_projet="PRJ-PROP-001")
    make_projet(db_session, code_projet="PRJ-PROP-002")

    response = client.post(f"/propositions_projets_router/demande/{demande.id}/proposer-projets")
    assert response.status_code == 200
    payload = response.json()
    assert payload["count_propositions"] == 2
    assert len(payload["projets"]) == 2
