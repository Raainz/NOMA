from app.services.metrics import Point, haversine_m
from app.services.privacy import apply_privacy_zone


def line(n: int, step_lat: float = 0.0001):
    """Northbound line, ~11.1 m between points at the default step."""
    return [Point(i * 1000, 36.8 + i * step_lat, 10.18) for i in range(n)]


def dist(pts):
    return sum(haversine_m(a, b) for a, b in zip(pts, pts[1:]))


def test_cuts_both_ends():
    pts = line(200)  # ~2.2 km
    out = apply_privacy_zone(pts, 200)
    assert 0 < len(out) < len(pts)
    assert haversine_m(pts[0], out[0]) >= 200
    assert haversine_m(pts[-1], out[-1]) >= 200
    # What is left starts no earlier than 200 m in and ends no later than 200 m from the end.
    assert dist(out) <= dist(pts) - 400 + 1


def test_zone_zero_returns_everything():
    pts = line(50)
    assert apply_privacy_zone(pts, 0) == pts


def test_short_run_leaks_nothing():
    # ~220 m in total: both 200 m zones cover it entirely.
    assert apply_privacy_zone(line(20), 200) == []
    # Exactly twice the zone also leaves nothing.
    assert apply_privacy_zone(line(2, step_lat=0.01), 20_000) == []


def test_out_and_back_does_not_reveal_home():
    """A run that ends where it started: the cut is measured along the path at both ends."""
    pts = line(100) + list(reversed(line(100)))
    home = pts[0]
    out = apply_privacy_zone(pts, 300)
    assert out
    # Every remaining point is at least ~300 m of path from either end; for this straight
    # out-and-back that also means at least ~300 m from home as the crow flies.
    assert all(haversine_m(home, p) >= 290 for p in out)


def test_single_point_unchanged():
    p = [Point(0, 36.8, 10.18)]
    assert apply_privacy_zone(p, 200) == p
