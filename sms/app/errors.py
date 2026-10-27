"""Domain errors that are rendered as RFC 7807 problem details."""

from __future__ import annotations

from typing import Any


class SmsError(Exception):
    """Base class for errors that map cleanly onto an HTTP response."""

    status_code = 500
    code = "INTERNAL_ERROR"
    title = "SMS gateway error"

    def __init__(
        self,
        detail: str,
        *,
        retry_after: int | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(detail)
        self.detail = detail
        self.retry_after = retry_after
        self.extra: dict[str, Any] = dict(extra or {})

    def to_problem(self, *, request_id: str | None = None, instance: str | None = None) -> dict[str, Any]:
        problem: dict[str, Any] = {
            "type": f"https://sms-gateway.local/errors/{self.code.lower().replace('_', '-')}",
            "title": self.title,
            "status": self.status_code,
            "code": self.code,
            "detail": self.detail,
        }
        if request_id:
            problem["request_id"] = request_id
        if instance:
            problem["instance"] = instance
        problem.update(self.extra)
        return problem


class InvalidNumber(SmsError):
    status_code = 422
    code = "INVALID_NUMBER"
    title = "Invalid phone number"


class MessageTooLong(SmsError):
    status_code = 422
    code = "MESSAGE_TOO_LONG"
    title = "Message too long"


class UnsupportedCharacter(SmsError):
    status_code = 422
    code = "UNSUPPORTED_CHARACTER"
    title = "Unsupported character in message"


class Unauthorized(SmsError):
    status_code = 401
    code = "UNAUTHORIZED"
    title = "Invalid or missing API key"


class TransportMisconfigured(SmsError):
    status_code = 500
    code = "TRANSPORT_MISCONFIGURED"
    title = "SMS transport misconfigured"


class ModemUnavailable(SmsError):
    status_code = 503
    code = "MODEM_UNAVAILABLE"
    title = "Modem unavailable"


class ModemBusy(SmsError):
    status_code = 503
    code = "MODEM_BUSY"
    title = "Modem busy"


class ModemTimeout(SmsError):
    status_code = 504
    code = "MODEM_TIMEOUT"
    title = "Modem did not respond in time"


class SendRejected(SmsError):
    status_code = 502
    code = "SEND_REJECTED"
    title = "Modem rejected the message"

    def __init__(
        self,
        detail: str,
        *,
        modem_code: str | None = None,
        retryable: bool = False,
        extra: dict[str, Any] | None = None,
    ) -> None:
        merged: dict[str, Any] = dict(extra or {})
        if modem_code:
            merged["modem_code"] = modem_code
        super().__init__(detail, extra=merged)
        self.modem_code = modem_code
        self.retryable = retryable
