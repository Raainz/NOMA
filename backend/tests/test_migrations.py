import os
import subprocess
import sys
import tempfile

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import create_engine

from app import models  # noqa: F401
from app.db import Base


def test_migrations_apply_and_match_models():
    """`alembic upgrade head` must produce exactly the schema the models describe."""
    db_file = os.path.join(tempfile.mkdtemp(prefix="noma_mig_"), "mig.db")
    env = {**os.environ, "DATABASE_URL": f"sqlite:///{db_file}"}
    backend_dir = os.path.dirname(os.path.dirname(__file__))
    subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], cwd=backend_dir, env=env, check=True)

    engine = create_engine(f"sqlite:///{db_file}")
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn, opts={"compare_type": True}), Base.metadata)
    assert diff == []
