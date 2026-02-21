from app.shared.enums import RoleEnum


def test_send_message_and_get_conversation_thread(
    client,
    db_session,
    auth_as,
    make_user,
):
    admin = make_user(
        db_session,
        email="admin.msg@example.com",
        role=RoleEnum.ADMIN,
        password="Password123!",
    )
    stagiaire = make_user(
        db_session,
        email="stagiaire.msg@example.com",
        role=RoleEnum.STAGIAIRE,
        password="Password123!",
    )

    with auth_as(admin):
        send_response = client.post(
            "/communication/send",
            json={
                "recipient_id": stagiaire.id,
                "subject": "Welcome",
                "content": "Bonjour et bienvenue.",
            },
        )

    assert send_response.status_code == 201
    send_payload = send_response.json()
    assert send_payload["recipient_id"] == stagiaire.id
    assert send_payload["subject"] == "Welcome"

    with auth_as(stagiaire):
        conversations_response = client.get("/communication/conversations")
        thread_response = client.get(f"/communication/with/{admin.id}")

    assert conversations_response.status_code == 200
    conversations = conversations_response.json()
    assert len(conversations) >= 1
    assert any(c["contact"]["id"] == admin.id for c in conversations)

    assert thread_response.status_code == 200
    thread_payload = thread_response.json()
    assert thread_payload["contact"]["id"] == admin.id
    assert len(thread_payload["messages"]) >= 1
