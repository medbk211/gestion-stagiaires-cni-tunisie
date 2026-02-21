from app.modules.notifications.service import create_notification
from app.shared.enums import RoleEnum


def test_notifications_end_to_end(client, db_session, auth_as, make_user):
    user = make_user(
        db_session,
        email="user.notif@example.com",
        role=RoleEnum.ADMIN,
        password="Password123!",
    )

    first = create_notification(
        db_session,
        user_id=user.id,
        title="Notif 1",
        message="Message 1",
        category="general",
    )
    create_notification(
        db_session,
        user_id=user.id,
        title="Notif 2",
        message="Message 2",
        category="general",
    )

    with auth_as(user):
        unread_response = client.get("/notifications/me/unread-count")
        list_response = client.get("/notifications/me")
        mark_one_response = client.patch(f"/notifications/{first.id}/read")
        mark_all_response = client.patch("/notifications/me/read-all")
        unread_after_response = client.get("/notifications/me/unread-count")

    assert unread_response.status_code == 200
    assert unread_response.json()["unread_count"] == 2

    assert list_response.status_code == 200
    assert len(list_response.json()) == 2

    assert mark_one_response.status_code == 200
    assert mark_one_response.json()["id"] == first.id
    assert mark_one_response.json()["read_at"] is not None

    assert mark_all_response.status_code == 200
    assert "message" in mark_all_response.json()

    assert unread_after_response.status_code == 200
    assert unread_after_response.json()["unread_count"] == 0
