"""Pydantic models for the public HTTP API."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_serializer

E164_RE = re.compile(r"^\+[1-9]\d{6,14}$")
# Control characters are rejected because they can terminate AT command input.
CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class SendSmsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    to: str = Field(
        ...,
        description="Recipient number in E.164 format (spaces, dashes and parentheses are ignored)",
        examples=["+15551234567"],
    )
    message: str = Field(
        ...,
        min_length=1,
        description="Message text; limited to MAX_SMS_LENGTH characters (single segment)",
        examples=["Hello from the SMS gateway"],
    )

    @field_validator("to")
    @classmethod
    def _normalise_number(cls, value: str) -> str:
        cleaned = re.sub(r"[\s\-().]", "", value)
        if not E164_RE.match(cleaned):
            raise ValueError("must be an E.164 number such as +15551234567")
        return cleaned

    @field_validator("message")
    @classmethod
    def _check_message(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        if CONTROL_RE.search(value):
            raise ValueError("must not contain control characters")
        return value


class SendSmsResponse(BaseModel):
    request_id: str = Field(..., description="Server correlation id, also returned as the X-Request-ID header")
    status: Literal["sent"] = "sent"
    to: str
    transport: str
    message_id: str | None = Field(default=None, description="Modem message reference, when the device reports one")
    sent_at: datetime


class ModemStatus(BaseModel):
    reachable: bool
    port: str | None = None
    base_url: str | None = None
    model: str | None = None
    sim: str | None = None
    smsc: str | None = Field(
        default=None, description="Message centre reported by AT+CSCA (empty when the SIM has none)"
    )
    signal: int | None = Field(default=None, description="AT+CSQ RSSI, 0-31 (higher is better)")
    registered: bool | None = None
    error: str | None = None

    @model_serializer(mode="wrap")
    def _omit_unset_fields(self, handler: Any) -> dict[str, Any]:
        """Only expose the details the transport actually reported."""
        data = handler(self)
        return {key: value for key, value in data.items() if value is not None}


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    transport: str
    configured: bool
    modem: ModemStatus | None = None
