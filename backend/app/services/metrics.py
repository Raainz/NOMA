"""Server-side activity metrics (versioned algorithm).

Pure functions: validate a GPS trace and recompute distance / time / pace /
elevation / quality. The phone remains responsible for live capture; this is
the durable reference used across devices.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

ALGORITHM_VERSION = "metrics-v1"

EARTH_RADIUS_M = 6_371_008.8
MOVING_SPEED_MS = 0.5  # below this a segment is not "moving"
MAX_PLAUSIBLE_SPEED_MS = 12.0  # ~43 km/h: faster segments are flagged as GPS jumps
GAP_SECONDS = 30.0  # longer silence between points is reported as a gap
ELEVATION_NOISE_M = 3.0  # hysteresis threshold for elevation gain
MAX_ACCURACY_M = 50.0


@dataclass(frozen=True)
class Point:
    t_ms: int
    lat: float
    lon: float
    alt: float | None = None
    accuracy: float | None = None
    speed: float | None = None


@dataclass
class Metrics:
    distance_m: float
    duration_s: float
    moving_time_s: float
    elevation_gain_m: float
    avg_pace_s_per_km: float | None
    avg_speed_kmh: float
    quality: dict = field(default_factory=dict)


def haversine_m(a: Point, b: Point) -> float:
    p1, p2 = math.radians(a.lat), math.radians(b.lat)
    dphi = p2 - p1
    dlmb = math.radians(b.lon - a.lon)
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(h)))


def elevation_gain_m(points: list[Point]) -> float:
    """Cumulative ascent ignoring altitude changes smaller than the noise threshold."""
    alts = [p.alt for p in points if p.alt is not None]
    if len(alts) < 2:
        return 0.0
    gain = 0.0
    ref = alts[0]
    for a in alts[1:]:
        if a - ref >= ELEVATION_NOISE_M:
            gain += a - ref
            ref = a
        elif ref - a >= ELEVATION_NOISE_M:
            ref = a
    return gain


def compute_metrics(points: list[Point], started_ms: int, ended_ms: int) -> Metrics:
    """Points must be ordered by time (validated by the caller)."""
    distance = 0.0
    moving = 0.0
    jumps = gaps = low_accuracy = 0

    for p in points:
        if p.accuracy is not None and p.accuracy > MAX_ACCURACY_M:
            low_accuracy += 1

    for prev, cur in zip(points, points[1:]):
        dt = (cur.t_ms - prev.t_ms) / 1000.0
        if dt <= 0:
            continue
        d = haversine_m(prev, cur)
        speed = d / dt
        if speed > MAX_PLAUSIBLE_SPEED_MS:
            jumps += 1  # excluded: almost certainly a GPS glitch
            continue
        if dt > GAP_SECONDS:
            gaps += 1
        distance += d
        if speed >= MOVING_SPEED_MS and dt <= GAP_SECONDS:
            moving += dt

    duration = max(0.0, (ended_ms - started_ms) / 1000.0)
    pace = (moving / (distance / 1000.0)) if distance >= 10 and moving > 0 else None
    avg_speed = (distance / moving) * 3.6 if moving > 0 else 0.0

    return Metrics(
        distance_m=round(distance, 1),
        duration_s=round(duration, 1),
        moving_time_s=round(moving, 1),
        elevation_gain_m=round(elevation_gain_m(points), 1),
        avg_pace_s_per_km=round(pace, 1) if pace is not None else None,
        avg_speed_kmh=round(avg_speed, 2),
        quality={
            "points": len(points),
            "gps_jumps_excluded": jumps,
            "gaps": gaps,
            "low_accuracy_points": low_accuracy,
            "elevation_source": "gps",
        },
    )
