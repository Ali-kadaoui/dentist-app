"""FastAPI application entrypoint."""

from __future__ import annotations

import logging
import re
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.config import Settings, get_settings
from app.errors import SmsError
from app.services.sms_service import SmsService
from app.transports.base import SmsTransport
from app.transports.factory import build_transport

_LOGGER = logging.getLogger(__name__)
_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
_DESCRIPTION = """
Small HTTP gateway that sends SMS through a Huawei USB modem.

* `TRANSPORT=at` drives the modem with AT commands over pyserial (E173z-1).
* `TRANSPORT=hilink` talks to the modem's HiLink HTTP API instead.

Only single-segment messages are supported in this version; see `MAX_SMS_LENGTH`.
"""


def _request_id(request: Request) -> str:
    provided = request.headers.get("X-Request-ID", "")
    return provided if _REQUEST_ID_RE.match(provided) else uuid.uuid4().hex


def create_app(settings: Settings | None = None, transport: SmsTransport | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        logging.getLogger("app").setLevel(settings.log_level.upper())
        app.state.settings = settings
        app.state.transport = transport or build_transport(settings)
        app.state.service = SmsService(app.state.transport, settings)
        _LOGGER.info("SMS gateway ready (transport=%s)", app.state.transport.name)
        try:
            yield
        finally:
            app.state.transport.close()

    app = FastAPI(
        title="Huawei SMS Gateway",
        version="0.1.0",
        description=_DESCRIPTION,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-API-Key", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        request.state.request_id = _request_id(request)
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        return response

    @app.exception_handler(SmsError)
    async def sms_error_handler(request: Request, exc: SmsError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        headers: dict[str, str] = {}
        if request_id:
            headers["X-Request-ID"] = request_id
        if exc.retry_after is not None:
            headers["Retry-After"] = str(exc.retry_after)
        return JSONResponse(
            exc.to_problem(request_id=request_id, instance=request.url.path),
            status_code=exc.status_code,
            headers=headers or None,
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        request_id = getattr(request.state, "request_id", None)
        problem = {
            "type": "https://sms-gateway.local/errors/invalid-request",
            "title": "Request validation failed",
            "status": 422,
            "code": "INVALID_REQUEST",
            "detail": "The request body is not valid.",
            "errors": [
                {
                    "field": ".".join(str(part) for part in error["loc"][1:]),
                    "message": error["msg"],
                }
                for error in exc.errors()
            ],
            "instance": request.url.path,
        }
        headers: dict[str, str] = {}
        if request_id:
            problem["request_id"] = request_id
            headers["X-Request-ID"] = request_id
        return JSONResponse(problem, status_code=422, headers=headers or None)

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        _LOGGER.exception("unhandled error while processing %s %s", request.method, request.url.path)
        request_id = getattr(request.state, "request_id", None)
        problem = {
            "type": "https://sms-gateway.local/errors/internal-error",
            "title": "Internal server error",
            "status": 500,
            "code": "INTERNAL_ERROR",
            "detail": "An unexpected error occurred.",
            "instance": request.url.path,
        }
        headers: dict[str, str] = {}
        if request_id:
            problem["request_id"] = request_id
            headers["X-Request-ID"] = request_id
        return JSONResponse(problem, status_code=500, headers=headers or None)

    app.include_router(router)
    return app


app = create_app()
