from tests.conftest import make_activity, register

SYNC = "/api/v1/activities/sync"


def test_sync_creates_and_computes_server_metrics(client, auth):
    r = client.post(SYNC, headers=auth, json=make_activity())
    assert r.status_code == 201, r.text
    a = r.json()
    assert 190 < a["distance_m"] < 210
    assert a["algorithm_version"] == "metrics-v1"
    assert a["client_metrics"] == {"distance_m": 197.0}  # kept for diagnostics
    assert a["quality"]["points"] == 60


def test_sync_is_idempotent(client, auth):
    body = make_activity("activity_same")
    first = client.post(SYNC, headers=auth, json=body)
    again = client.post(SYNC, headers=auth, json=body)
    assert first.status_code == 201 and again.status_code == 200
    assert first.json()["id"] == again.json()["id"]
    assert len(client.get("/api/v1/activities", headers=auth).json()["items"]) == 1


def test_sync_same_id_different_content_conflicts(client, auth):
    client.post(SYNC, headers=auth, json=make_activity("activity_x"))
    changed = make_activity("activity_x", n=80)
    r = client.post(SYNC, headers=auth, json=changed)
    assert r.status_code == 409 and r.json()["error"]["code"] == "activity_conflict"


def test_sync_validation(client, auth):
    unordered = make_activity()
    unordered["points"][5], unordered["points"][6] = unordered["points"][6], unordered["points"][5]
    assert client.post(SYNC, headers=auth, json=unordered).status_code == 422

    naive = make_activity("activity_naive")
    naive["started_at"] = "2026-06-01T10:00:00"
    assert client.post(SYNC, headers=auth, json=naive).status_code == 422

    short = make_activity("activity_short", n=2)
    short["points"] = short["points"][:1]
    assert client.post(SYNC, headers=auth, json=short).status_code == 422

    bad_coord = make_activity("activity_coord")
    bad_coord["points"][0]["latitude"] = 123
    assert client.post(SYNC, headers=auth, json=bad_coord).status_code == 422

    bad_id = make_activity("bad id!")
    assert client.post(SYNC, headers=auth, json=bad_id).status_code == 422


def test_sync_requires_auth(client):
    assert client.post(SYNC, json=make_activity()).status_code == 401


def test_list_is_paginated_newest_first(client, auth):
    for i in range(3):
        body = make_activity(f"activity_{i}", start_ms=1_780_000_000_000 + i * 3_600_000)
        assert client.post(SYNC, headers=auth, json=body).status_code == 201

    page1 = client.get("/api/v1/activities?limit=2", headers=auth).json()
    assert [a["client_activity_id"] for a in page1["items"]] == ["activity_2", "activity_1"]
    assert page1["next_cursor"]

    page2 = client.get(f"/api/v1/activities?limit=2&cursor={page1['next_cursor']}", headers=auth).json()
    assert [a["client_activity_id"] for a in page2["items"]] == ["activity_0"]
    assert page2["next_cursor"] is None

    assert client.get("/api/v1/activities?cursor=garbage", headers=auth).status_code == 422


def test_detail_with_and_without_points(client, auth):
    created = client.post(SYNC, headers=auth, json=make_activity()).json()
    plain = client.get(f"/api/v1/activities/{created['id']}", headers=auth).json()
    assert plain["points"] is None
    full = client.get(f"/api/v1/activities/{created['id']}?include_points=true", headers=auth).json()
    assert len(full["points"]) == 60
    assert full["points"][0]["seq"] == 0 and full["points"][0]["timestamp"] == 1_780_000_000_000


def test_activities_are_private_to_their_owner(client, auth):
    created = client.post(SYNC, headers=auth, json=make_activity()).json()
    other = register(client, "other@example.com")
    other_auth = {"Authorization": f"Bearer {other['access_token']}"}

    assert client.get(f"/api/v1/activities/{created['id']}", headers=other_auth).status_code == 404
    assert client.delete(f"/api/v1/activities/{created['id']}", headers=other_auth).status_code == 404
    assert client.get("/api/v1/activities", headers=other_auth).json()["items"] == []
    # The same client id is independent per user.
    assert client.post(SYNC, headers=other_auth, json=make_activity()).status_code == 201


def test_delete_removes_activity_and_points(client, auth):
    created = client.post(SYNC, headers=auth, json=make_activity()).json()
    assert client.delete(f"/api/v1/activities/{created['id']}", headers=auth).status_code == 204
    assert client.get(f"/api/v1/activities/{created['id']}", headers=auth).status_code == 404
    # Deleting frees the client id for a fresh upload.
    assert client.post(SYNC, headers=auth, json=make_activity()).status_code == 201
