"""HTTP endpoints."""

from __future__ import annotations

import secrets

from fastapi import APIRouter, Depends, Query, Request

from app.config import Settings
from app.errors import Unauthorized
from app.schemas import HealthResponse, SendSmsRequest, SendSmsResponse
from app.services.sms_service import SmsService

router = APIRouter(tags=["sms"])


def get_service(request: Request) -> SmsService:
    return request.app.state.service


def require_api_key(request: Request) -> None:
    settings: Settings = request.app.state.settings
    if not settings.api_key:
        return
    provided = request.headers.get("X-API-Key", "")
    if not provided or not secrets.compare_digest(provided, settings.api_key):
        raise Unauthorized("provide a valid X-API-Key header")


@router.post(
    "/send-sms",
    response_model=SendSmsResponse,
    dependencies=[Depends(require_api_key)],
    summary="Send a single SMS",
)
def send_sms(
    payload: SendSmsRequest,
    request: Request,
    service: SmsService = Depends(get_service),
) -> SendSmsResponse:
    return service.send(payload, request_id=request.state.request_id)


@router.get("/health", response_model=HealthResponse, summary="Liveness check with an optional modem probe")
def health(
    request: Request,
    probe: bool = Query(False, description="Query the modem for live status"),
    service: SmsService = Depends(get_service),
) -> HealthResponse:
    return service.health(probe=probe)
