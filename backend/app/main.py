"""NOMA backend entry point."""

import logging

from fastapi import FastAPI

from app import errors
from app.routers import activities, auth, health, me

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

app = FastAPI(title="NOMA API", version="0.1.0")
errors.install(app)

app.include_router(health.router)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(me.router, prefix="/api/v1")
app.include_router(activities.router, prefix="/api/v1")
