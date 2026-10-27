"""Application service that validates messages and drives a transport."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.config import Settings
from app.errors import MessageTooLong
from app.schemas import HealthResponse, ModemStatus, SendSmsRequest, SendSmsResponse
from app.transports.base import SmsTransport

_LOGGER = logging.getLogger(__name__)


def _cannot_send(details: dict[str, Any], settings: Settings) -> bool:
    """True when a responsive modem still cannot deliver a message right now."""
    sim = details.get("sim")
    if isinstance(sim, str) and sim.strip().upper() != "READY":
        return True
    if details.get("registered") is False:
        return True
    smsc = details.get("smsc")
    return isinstance(smsc, str) and not smsc.strip() and not settings.at_smsc


class SmsService:
    def __init__(self, transport: SmsTransport, settings: Settings) -> None:
        self._transport = transport
        self._settings = settings

    def send(self, payload: SendSmsRequest, *, request_id: str) -> SendSmsResponse:
        if len(payload.message) > self._settings.max_sms_length:
            raise MessageTooLong(
                f"message is {len(payload.message)} characters; "
                f"the limit is {self._settings.max_sms_length} for a single segment"
            )
        result = self._transport.send(payload.to, payload.message)
        return SendSmsResponse(
            request_id=request_id,
            to=payload.to,
            transport=result.transport,
            message_id=result.message_id,
            sent_at=datetime.now(timezone.utc),
        )

    def health(self, *, probe: bool) -> HealthResponse:
        status = "ok"
        modem: ModemStatus | None = None
        if probe:
            try:
                details = dict(self._transport.probe())
            except Exception as exc:  # pragma: no cover - probe() is not supposed to raise
                _LOGGER.exception("transport probe failed")
                details = {"reachable": False, "error": str(exc)}
            reachable = bool(details.pop("reachable", False))
            if not reachable or _cannot_send(details, self._settings):
                status = "degraded"
            modem = ModemStatus(reachable=reachable, **details)
        return HealthResponse(
            status=status,
            transport=self._transport.name,
            configured=True,
            modem=modem,
        )
