"""Selects the transport implementation from configuration."""

from __future__ import annotations

from app.config import Settings
from app.errors import TransportMisconfigured
from app.transports.at_modem import AtModemTransport
from app.transports.base import SmsTransport
from app.transports.hilink import HiLinkTransport


def build_transport(settings: Settings) -> SmsTransport:
    if settings.transport == "at":
        if not settings.at_port.strip():
            raise TransportMisconfigured("AT_PORT must be set when TRANSPORT=at")
        return AtModemTransport(settings)
    if settings.transport == "hilink":
        if not settings.hilink_base_url.strip():
            raise TransportMisconfigured("HILINK_BASE_URL must be set when TRANSPORT=hilink")
        return HiLinkTransport(settings)
    raise TransportMisconfigured(f"unsupported TRANSPORT {settings.transport!r}; use 'at' or 'hilink'")
