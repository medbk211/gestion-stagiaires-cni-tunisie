from app.modules.auth.service import LOGIN_ATTEMPTS, REVOKED_REFRESH_TOKENS
from app.shared.enums import RoleEnum


def test_login_success_and_refresh(client, db_session, make_user):
    LOGIN_ATTEMPTS.clear()
    REVOKED_REFRESH_TOKENS.clear()
    make_user(
        db_session,
        email="admin.auth@example.com",
        role=RoleEnum.ADMIN,
        password="Password123!",
    )

    login_response = client.post(
        "/auth/login",
        data={"username": "admin.auth@example.com", "password": "Password123!"},
    )

    assert login_response.status_code == 200
    payload = login_response.json()
    assert payload["access_token"]
    assert payload["refresh_token"]
    assert payload["token_type"] == "bearer"

    refresh_response = client.post(
        "/auth/refresh",
        json={"refresh_token": payload["refresh_token"]},
    )
    assert refresh_response.status_code == 200
    refresh_payload = refresh_response.json()
    assert refresh_payload["access_token"]
    assert refresh_payload["refresh_token"]


def test_login_wrong_password_returns_401(client, db_session, make_user):
    LOGIN_ATTEMPTS.clear()
    make_user(
        db_session,
        email="admin.badpass@example.com",
        role=RoleEnum.ADMIN,
        password="Password123!",
    )

    response = client.post(
        "/auth/login",
        data={"username": "admin.badpass@example.com", "password": "WrongPassword!"},
    )
    assert response.status_code == 401


def test_forgot_password_unknown_email_is_generic(client):
    response = client.post(
        "/auth/forgot-password",
        json={"email": "unknown.user@example.com"},
    )
    assert response.status_code == 200
    assert "message" in response.json()
