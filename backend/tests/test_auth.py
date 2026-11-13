from tests.conftest import register


def test_health_and_ready(client):
    assert client.get("/health").json() == {"status": "ok"}
    r = client.get("/ready")
    assert r.status_code == 200 and r.json()["database"] == "up"


def test_request_id_is_echoed_and_errors_are_normalised(client):
    r = client.get("/api/v1/me", headers={"X-Request-ID": "abc123"})
    assert r.status_code == 401
    assert r.headers["X-Request-ID"] == "abc123"
    err = r.json()["error"]
    assert err["code"] == "unauthorized" and err["request_id"] == "abc123"


def test_register_and_duplicate_email(client):
    tokens = register(client, "A@Example.com")
    assert tokens["token_type"] == "bearer" and tokens["expires_in"] > 0
    r = client.post("/api/v1/auth/register", json={"email": "a@example.com", "password": "another-pass"})
    assert r.status_code == 409 and r.json()["error"]["code"] == "email_taken"


def test_register_validation(client):
    r = client.post("/api/v1/auth/register", json={"email": "nope", "password": "short"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "validation_error"


def test_login(client):
    register(client)
    ok = client.post("/api/v1/auth/login", json={"email": "runner@example.com", "password": "correct-horse"})
    assert ok.status_code == 200
    bad = client.post("/api/v1/auth/login", json={"email": "runner@example.com", "password": "wrong-pass"})
    unknown = client.post("/api/v1/auth/login", json={"email": "who@example.com", "password": "whatever1"})
    assert bad.status_code == unknown.status_code == 401
    assert bad.json()["error"]["code"] == unknown.json()["error"]["code"] == "invalid_credentials"


def test_refresh_rotates_and_reuse_revokes_everything(client):
    first = register(client)
    second = client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert second.status_code == 200
    new = second.json()
    assert new["refresh_token"] != first["refresh_token"]

    # Replaying the already-rotated token is treated as theft.
    replay = client.post("/api/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert replay.status_code == 401 and replay.json()["error"]["code"] == "refresh_token_reused"
    # ...and the legitimate new token no longer works either.
    after = client.post("/api/v1/auth/refresh", json={"refresh_token": new["refresh_token"]})
    assert after.status_code == 401


def test_logout_revokes_refresh_token(client):
    tokens = register(client)
    assert client.post("/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]}).status_code == 204
    r = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 401


def test_me_requires_valid_token_and_can_be_patched(client, auth):
    assert client.get("/api/v1/me", headers={"Authorization": "Bearer garbage"}).status_code == 401
    me = client.get("/api/v1/me", headers=auth).json()
    assert me["email"] == "runner@example.com" and "password_hash" not in me
    r = client.patch("/api/v1/me", headers=auth, json={"display_name": "Nour", "preferred_units": "imperial"})
    assert r.status_code == 200 and r.json()["display_name"] == "Nour" and r.json()["preferred_units"] == "imperial"
    bad = client.patch("/api/v1/me", headers=auth, json={"preferred_units": "furlongs"})
    assert bad.status_code == 422
