import os
import tempfile

# Settings must exist before the app is imported. Tests run on a throwaway SQLite file.
_DB_FILE = os.path.join(tempfile.mkdtemp(prefix="noma_test_"), "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE}"
os.environ["JWT_SECRET"] = "test-secret-test-secret-test-secret-0123456789"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, get_engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def _fresh_db():
    Base.metadata.drop_all(get_engine())
    Base.metadata.create_all(get_engine())
    yield


@pytest.fixture
def client():
    return TestClient(app)


def register(client, email="runner@example.com", password="correct-horse"):
    r = client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def auth(client):
    tokens = register(client)
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def make_points(n=60, start_ms=1_780_000_000_000, step_ms=1000, dlat=0.00003, alt=None):
    """A straight northbound run (~3.3 m/s at the default step)."""
    return [
        {
            "latitude": 36.8 + i * dlat,
            "longitude": 10.18,
            "altitude": alt(i) if alt else None,
            "accuracy": 5.0,
            "speed": 3.3,
            "timestamp": start_ms + i * step_ms,
        }
        for i in range(n)
    ]


def make_activity(client_id="activity_1", n=60, **kw):
    pts = make_points(n, **kw)
    iso = lambda ms: __import__("datetime").datetime.fromtimestamp(ms / 1000, __import__("datetime").timezone.utc).isoformat()
    return {
        "client_activity_id": client_id,
        "name": "Morning run",
        "started_at": iso(pts[0]["timestamp"]),
        "ended_at": iso(pts[-1]["timestamp"]),
        "points": pts,
        "client_metrics": {"distance_m": 197.0},
    }
