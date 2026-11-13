"""Privacy zone: hide the start and end of a trace before anyone but the owner sees it.

Pure functions (no database, no web framework) so they are easy to test.
"""

from __future__ import annotations

from collections.abc import Sequence

from app.services.metrics import Point, haversine_m

MAX_PRIVACY_ZONE_M = 1000


def apply_privacy_zone(points: Sequence[Point], zone_m: float) -> list[Point]:
    """Drop the points within `zone_m` metres (along the path) of the start and of the end.

    If the trace is too short to leave anything once both ends are cut, nothing is returned:
    a short run must not leak its location through the part that remains.
    """
    pts = list(points)
    if zone_m <= 0 or len(pts) < 2:
        return pts

    # Cumulative distance along the path from the first point.
    cum = [0.0]
    for a, b in zip(pts, pts[1:]):
        cum.append(cum[-1] + haversine_m(a, b))
    total = cum[-1]
    if total <= 2 * zone_m:
        return []

    return [p for p, d in zip(pts, cum) if zone_m <= d <= total - zone_m]
