"""Normalised error responses: {"error": {"code", "message", "request_id"}}."""

import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("noma")


class AppError(Exception):
    def __init__(self, status_code: int, code: str, message: str):
        self.status_code = status_code
        self.code = code
        self.message = message


def _body(request: Request, code: str, message: str, details=None) -> dict:
    err = {"code": code, "message": message, "request_id": getattr(request.state, "request_id", None)}
    if details is not None:
        err["details"] = details
    return {"error": err}


def install(app: FastAPI) -> None:
    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request.state.request_id = request.headers.get("x-request-id") or uuid.uuid4().hex
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError):
        return JSONResponse(_body(request, exc.code, exc.message), status_code=exc.status_code)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException):
        return JSONResponse(_body(request, f"http_{exc.status_code}", str(exc.detail)), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError):
        details = [{"loc": [str(p) for p in e["loc"]], "msg": e["msg"]} for e in exc.errors()]
        return JSONResponse(_body(request, "validation_error", "Invalid request", details), status_code=422)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        # Never leak internals or GPS payloads; the request id correlates with the log line.
        log.exception("unhandled error request_id=%s", getattr(request.state, "request_id", None))
        return JSONResponse(_body(request, "internal_error", "Internal server error"), status_code=500)
