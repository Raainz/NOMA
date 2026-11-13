from app.services.metrics import Point, compute_metrics, elevation_gain_m, haversine_m


def line(n, step_s=1, dlat=0.00003, alt=None):
    return [Point(i * step_s * 1000, 36.8 + i * dlat, 10.18, alt(i) if alt else None) for i in range(n)]


def test_haversine_one_millidegree_of_latitude():
    d = haversine_m(Point(0, 0, 0), Point(0, 0.001, 0))
    assert 111.0 < d < 111.4


def test_distance_pace_and_speed_on_straight_line():
    pts = line(61)  # 60 s at ~3.34 m/s
    m = compute_metrics(pts, 0, 60_000)
    assert 195 < m.distance_m < 205
    assert m.moving_time_s == 60
    assert m.avg_pace_s_per_km is not None and 290 < m.avg_pace_s_per_km < 310
    assert 11.5 < m.avg_speed_kmh < 12.5
    assert m.quality["gps_jumps_excluded"] == 0


def test_gps_jump_is_excluded_from_distance():
    pts = line(20)
    pts.insert(10, Point(10_000, 37.5, 10.18))  # ~80 km away for one second
    pts = sorted(pts, key=lambda p: p.t_ms)
    m = compute_metrics(pts, 0, 20_000)
    assert m.quality["gps_jumps_excluded"] >= 1
    assert m.distance_m < 200


def test_standing_still_has_no_pace():
    pts = [Point(i * 1000, 36.8, 10.18) for i in range(30)]
    m = compute_metrics(pts, 0, 29_000)
    assert m.distance_m == 0
    assert m.moving_time_s == 0
    assert m.avg_pace_s_per_km is None


def test_gap_in_trace_is_reported_and_not_counted_as_moving():
    pts = line(10) + [Point(100_000 + i * 1000, 36.8 + (10 + i) * 0.00003, 10.18) for i in range(10)]
    m = compute_metrics(pts, 0, 110_000)
    assert m.quality["gaps"] == 1
    assert m.moving_time_s < 20


def test_elevation_ignores_noise_but_counts_real_climb():
    noisy = [Point(i, 0, 0, 100 + (1.0 if i % 2 else -1.0)) for i in range(20)]
    assert elevation_gain_m(noisy) == 0
    climb = [Point(i, 0, 0, 100 + i * 2.0) for i in range(11)]  # +20 m
    assert 17 <= elevation_gain_m(climb) <= 20.01


def test_low_accuracy_points_are_counted():
    pts = [Point(i * 1000, 36.8 + i * 0.00003, 10.18, None, 80.0 if i < 3 else 5.0) for i in range(10)]
    assert compute_metrics(pts, 0, 9000).quality["low_accuracy_points"] == 3
