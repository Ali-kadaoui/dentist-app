"""Transport contract shared by the AT and HiLink implementations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol, runtime_checkable


@dataclass(frozen=True, slots=True)
class SendResult:
    """Outcome of a single message submission."""

    message_id: str | None
    transport: str


@runtime_checkable
class SmsTransport(Protocol):
    name: str

    def send(self, phone: str, text: str) -> SendResult:
        """Send one SMS, or raise an app.errors.SmsError subclass."""

    def probe(self) -> dict[str, Any]:
        """Return live diagnostics; must not raise."""

    def close(self) -> None:
        """Release hardware/HTTP resources."""
