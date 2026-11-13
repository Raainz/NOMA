from tests.conftest import make_activity, register

SYNC = "/api/v1/activities/sync"
API = "/api/v1"


def headers(client, email):
    tokens = register(client, email=email)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def go_public(client, h, handle, **extra):
    r = client.patch(f"{API}/me/profile", headers=h, json={"handle": handle, "is_public": True, **extra})
    assert r.status_code == 200, r.text
    return r.json()


def sync(client, h, client_id="a1", n=400, **kw):
    # n=400 points at ~3.3 m each is ~1.3 km: longer than two privacy zones.
    r = client.post(SYNC, headers=h, json=make_activity(client_id, n=n, **kw))
    assert r.status_code == 201, r.text
    return r.json()


def set_visibility(client, h, activity_id, visibility):
    return client.patch(f"{API}/activities/{activity_id}/visibility", headers=h, json={"visibility": visibility})


# ---- profile --------------------------------------------------------------


def test_everything_is_private_by_default(client):
    h = headers(client, "a@example.com")
    me = client.get(f"{API}/me", headers=h).json()
    assert me["is_public"] is False and me["handle"] is None and me["privacy_zone_m"] == 200
    assert sync(client, h)["visibility"] == "private"


def test_handle_is_normalised_validated_and_unique(client):
    a, b = headers(client, "a@example.com"), headers(client, "b@example.com")
    assert go_public(client, a, "@Amine_Runs")["handle"] == "amine_runs"

    taken = client.patch(f"{API}/me/profile", headers=b, json={"handle": "AMINE_runs"})
    assert taken.status_code == 409 and taken.json()["error"]["code"] == "handle_taken"
    for bad in ("ab", "has space", "x" * 31, "admin", "é-é-é"):
        assert client.patch(f"{API}/me/profile", headers=b, json={"handle": bad}).status_code == 422, bad


def test_cannot_go_public_without_handle(client):
    h = headers(client, "a@example.com")
    r = client.patch(f"{API}/me/profile", headers=h, json={"is_public": True})
    assert r.status_code == 422 and r.json()["error"]["code"] == "handle_required"
    assert client.patch(f"{API}/me/profile", headers=h, json={"handle": None}).status_code == 422


def test_profile_fields_and_clearing(client):
    h = headers(client, "a@example.com")
    r = client.patch(
        f"{API}/me/profile", headers=h, json={"city": " La Marsa ", "level": "debutant", "bio": "Courir tôt"}
    )
    assert r.json()["city"] == "La Marsa" and r.json()["level"] == "debutant"
    cleared = client.patch(f"{API}/me/profile", headers=h, json={"city": None, "level": None}).json()
    assert cleared["city"] is None and cleared["level"] is None and cleared["bio"] == "Courir tôt"
    assert client.patch(f"{API}/me/profile", headers=h, json={"level": "pro"}).status_code == 422
    assert client.patch(f"{API}/me/profile", headers=h, json={"privacy_zone_m": 5000}).status_code == 422


# ---- public profile visibility ----------------------------------------------


def test_private_profile_looks_missing(client):
    a, b = headers(client, "a@example.com"), headers(client, "b@example.com")
    client.patch(f"{API}/me/profile", headers=a, json={"handle": "hidden_one"})  # not public
    assert client.get(f"{API}/users/hidden_one", headers=b).status_code == 404
    assert client.get(f"{API}/users/hidden_one", headers=a).status_code == 200  # owner sees it
    assert client.get(f"{API}/users/nobody_here", headers=b).status_code == 404


def test_profile_requires_auth(client):
    h = headers(client, "a@example.com")
    go_public(client, h, "runner_one")
    assert client.get(f"{API}/users/runner_one").status_code == 401


def test_public_profile_does_not_leak_email_or_settings(client):
    a, b = headers(client, "a@example.com"), headers(client, "b@example.com")
    go_public(client, a, "runner_one", city="Tunis", level="intermediaire")
    body = client.get(f"{API}/users/runner_one", headers=b).json()
    assert body["city"] == "Tunis" and body["is_me"] is False and body["is_following"] is False
    assert not {"email", "privacy_zone_m", "timezone", "is_public"} & set(body)


# ---- follow -----------------------------------------------------------------


def test_follow_unfollow_and_lists(client):
    a, b = headers(client, "a@example.com"), headers(client, "b@example.com")
    a_id = go_public(client, a, "runner_a")["id"]
    b_id = go_public(client, b, "runner_b")["id"]

    first = client.post(f"{API}/users/{a_id}/follow", headers=b)
    again = client.post(f"{API}/users/{a_id}/follow", headers=b)
    assert first.status_code == 201 and again.status_code == 200
    assert again.json() == {"is_following": True, "followers_count": 1}

    assert client.get(f"{API}/users/runner_a", headers=b).json()["is_following"] is True
    assert [u["handle"] for u in client.get(f"{API}/me/following", headers=b).json()["items"]] == ["runner_a"]
    assert [u["handle"] for u in client.get(f"{API}/me/followers", headers=a).json()["items"]] == ["runner_b"]
    assert client.get(f"{API}/me/followers", headers=b).json()["items"] == []
    assert b_id  # the other direction stays empty: following is not mutual

    assert client.delete(f"{API}/users/{a_id}/follow", headers=b).status_code == 204
    assert client.delete(f"{API}/users/{a_id}/follow", headers=b).status_code == 204  # idempotent
    assert client.get(f"{API}/me/following", headers=b).json()["items"] == []


def test_follow_rules(client):
    a, b = headers(client, "a@example.com"), headers(client, "b@example.com")
    a_id = client.get(f"{API}/me", headers=a).json()["id"]
    assert client.post(f"{API}/users/{a_id}/follow", headers=a).json()["error"]["code"] == "cannot_follow_self"
    # A private (or unknown) runner cannot be followed, and the answer does not reveal which.
    assert client.post(f"{API}/users/{a_id}/follow", headers=b).status_code == 404
    assert client.post(f"{API}/users/00000000-0000-0000-0000-000000000000/follow", headers=b).status_code == 404
    assert client.post(f"{API}/users/{a_id}/follow").status_code == 401


def test_going_private_hides_runner_from_lists_but_unfollow_still_works(client):
    a, b = headers(client, "a@example.com"), headers(client, "b@example.com")
    a_id = go_public(client, a, "runner_a")["id"]
    client.post(f"{API}/users/{a_id}/follow", headers=b)
    client.patch(f"{API}/me/profile", headers=a, json={"is_public": False})
    assert client.get(f"{API}/me/following", headers=b).json()["items"] == []
    assert client.get(f"{API}/users/runner_a", headers=b).status_code == 404
    assert client.delete(f"{API}/users/{a_id}/follow", headers=b).status_code == 204


# ---- search -----------------------------------------------------------------


def test_search_lists_only_public_runners(client):
    a, b, c = (headers(client, f"{x}@example.com") for x in "abc")
    go_public(client, a, "amine_runs", city="Tunis")
    go_public(client, b, "amira_ariana", city="Ariana")
    client.patch(f"{API}/me/profile", headers=c, json={"handle": "amel_private"})  # private

    r = client.get(f"{API}/users", headers=c, params={"q": "am"}).json()
    assert [u["handle"] for u in r["items"]] == ["amine_runs", "amira_ariana"]
    assert [u["handle"] for u in client.get(f"{API}/users", headers=c, params={"city": "ariana"}).json()["items"]] == [
        "amira_ariana"
    ]
    # SQL wildcards in the query are literal characters, not patterns.
    assert client.get(f"{API}/users", headers=c, params={"q": "%"}).json()["items"] == []
    # Never lists the caller.
    assert "amine_runs" not in [u["handle"] for u in client.get(f"{API}/users", headers=a).json()["items"]]


def test_search_pagination(client):
    viewer = headers(client, "v@example.com")
    for i in range(3):
        go_public(client, headers(client, f"r{i}@example.com"), f"runner_{i}")
    page1 = client.get(f"{API}/users", headers=viewer, params={"limit": 2}).json()
    assert [u["handle"] for u in page1["items"]] == ["runner_0", "runner_1"] and page1["next_cursor"]
    page2 = client.get(f"{API}/users", headers=viewer, params={"limit": 2, "cursor": page1["next_cursor"]}).json()
    assert [u["handle"] for u in page2["items"]] == ["runner_2"] and page2["next_cursor"] is None


# ---- activity visibility ------------------------------------------------------


def test_sharing_requires_a_public_profile(client):
    a = headers(client, "a@example.com")
    act = sync(client, a)
    r = set_visibility(client, a, act["id"], "public")
    assert r.status_code == 409 and r.json()["error"]["code"] == "profile_not_public"
    assert set_visibility(client, a, act["id"], "private").status_code == 200
    assert set_visibility(client, a, act["id"], "everyone").status_code == 422


def test_only_the_owner_can_change_visibility(client):
    a, b = headers(client, "a@example.com"), headers(client, "b@example.com")
    go_public(client, a, "runner_a")
    act = sync(client, a)
    assert set_visibility(client, b, act["id"], "public").status_code == 404


def test_activity_visibility_levels(client):
    owner = headers(client, "o@example.com")
    follower, stranger = headers(client, "f@example.com"), headers(client, "s@example.com")
    owner_id = go_public(client, owner, "runner_o")["id"]
    go_public(client, follower, "runner_f")
    client.post(f"{API}/users/{owner_id}/follow", headers=follower)

    private = sync(client, owner, "p", start_ms=1_780_000_000_000)
    shared = sync(client, owner, "f", start_ms=1_780_100_000_000)
    public = sync(client, owner, "u", start_ms=1_780_200_000_000)
    set_visibility(client, owner, shared["id"], "followers")
    set_visibility(client, owner, public["id"], "public")

    def listed(h):
        r = client.get(f"{API}/users/runner_o/activities", headers=h)
        assert r.status_code == 200, r.text
        return {a["id"] for a in r.json()["items"]}

    assert listed(stranger) == {public["id"]}
    assert listed(follower) == {public["id"], shared["id"]}
    assert listed(owner) == {public["id"], shared["id"], private["id"]}

    one = lambda h, a: client.get(f"{API}/users/runner_o/activities/{a['id']}", headers=h).status_code
    assert one(stranger, public) == 200
    assert one(stranger, shared) == 404 and one(stranger, private) == 404
    assert one(follower, shared) == 200 and one(follower, private) == 404

    # Counts on the profile follow the same rules.
    assert client.get(f"{API}/users/runner_o", headers=stranger).json()["activities_count"] == 1
    assert client.get(f"{API}/users/runner_o", headers=follower).json()["activities_count"] == 2
    assert client.get(f"{API}/users/runner_o", headers=owner).json()["activities_count"] == 3


def test_unfollow_removes_access_to_followers_only_activities(client):
    owner, f = headers(client, "o@example.com"), headers(client, "f@example.com")
    owner_id = go_public(client, owner, "runner_o")["id"]
    go_public(client, f, "runner_f")
    act = sync(client, owner)
    set_visibility(client, owner, act["id"], "followers")
    client.post(f"{API}/users/{owner_id}/follow", headers=f)
    assert client.get(f"{API}/users/runner_o/activities/{act['id']}", headers=f).status_code == 200
    client.delete(f"{API}/users/{owner_id}/follow", headers=f)
    assert client.get(f"{API}/users/runner_o/activities/{act['id']}", headers=f).status_code == 404


def test_going_private_hides_previously_public_activities(client):
    owner, other = headers(client, "o@example.com"), headers(client, "x@example.com")
    go_public(client, owner, "runner_o")
    act = sync(client, owner)
    set_visibility(client, owner, act["id"], "public")
    client.patch(f"{API}/me/profile", headers=owner, json={"is_public": False})
    assert client.get(f"{API}/users/runner_o/activities", headers=other).status_code == 404
    assert client.get(f"{API}/users/runner_o/activities/{act['id']}", headers=other).status_code == 404


def test_public_activity_hides_diagnostics_and_trims_privacy_zone(client):
    owner, other = headers(client, "o@example.com"), headers(client, "x@example.com")
    go_public(client, owner, "runner_o")
    act = sync(client, owner)
    set_visibility(client, owner, act["id"], "public")

    own_view = client.get(f"{API}/activities/{act['id']}", headers=owner, params={"include_points": True}).json()
    seen = client.get(
        f"{API}/users/runner_o/activities/{act['id']}", headers=other, params={"include_points": True}
    ).json()

    assert not {"client_metrics", "client_activity_id", "quality", "algorithm_version"} & set(seen)
    assert 0 < len(seen["points"]) < len(own_view["points"])
    first = own_view["points"][0]
    assert all(p["latitude"] != first["latitude"] for p in seen["points"][:1])
    # The nearest remaining point is about the zone distance from the real start (northbound line).
    metres = (seen["points"][0]["latitude"] - first["latitude"]) * 111_195
    assert 195 <= metres <= 215
    # Points are renumbered, so the trimmed count is not leaked through `seq`.
    assert seen["points"][0]["seq"] == 0
    # Without include_points no trace is returned at all.
    assert client.get(f"{API}/users/runner_o/activities/{act['id']}", headers=other).json()["points"] is None


def test_short_run_shows_no_trace_to_others(client):
    owner, other = headers(client, "o@example.com"), headers(client, "x@example.com")
    go_public(client, owner, "runner_o")
    act = sync(client, owner, n=60)  # ~200 m: entirely inside the privacy zone
    set_visibility(client, owner, act["id"], "public")
    seen = client.get(
        f"{API}/users/runner_o/activities/{act['id']}", headers=other, params={"include_points": True}
    ).json()
    assert seen["points"] == []


def test_zone_can_be_widened_or_disabled(client):
    owner, other = headers(client, "o@example.com"), headers(client, "x@example.com")
    go_public(client, owner, "runner_o", privacy_zone_m=0)
    act = sync(client, owner, n=60)
    set_visibility(client, owner, act["id"], "public")
    seen = client.get(
        f"{API}/users/runner_o/activities/{act['id']}", headers=other, params={"include_points": True}
    ).json()
    assert len(seen["points"]) == 60


def test_deleting_an_activity_removes_it_from_the_public_list(client):
    owner, f = headers(client, "o@example.com"), headers(client, "f@example.com")
    owner_id = go_public(client, owner, "runner_o")["id"]
    go_public(client, f, "runner_f")
    client.post(f"{API}/users/{owner_id}/follow", headers=f)
    act = sync(client, owner)
    set_visibility(client, owner, act["id"], "public")
    assert client.delete(f"{API}/activities/{act['id']}", headers=owner).status_code == 204
    assert client.get(f"{API}/users/runner_o/activities", headers=f).json()["items"] == []
