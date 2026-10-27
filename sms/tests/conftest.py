"""Shared fakes so the suite runs without hardware or a live modem."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

import pytest
import requests
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.transports.base import SendResult


class FakeSerial:
    """Scripted stand-in for ``serial.Serial``.

    Each script entry is ``(expected_write, response_bytes)``. The fake echoes
    the command unless the write is an SMS payload (terminated by Ctrl-Z).
    """

    def __init__(self, *, script: list[tuple[bytes, bytes]] | None = None, **kwargs: Any) -> None:
        self.port = kwargs.get("port")
        self.baudrate = kwargs.get("baudrate")
        self.is_open = True
        self.closed = False
        self.writes: list[bytes] = []
        self._script = list(script or [])
        self._buffer = bytearray()

    @property
    def in_waiting(self) -> int:
        return len(self._buffer)

    def read(self, size: int = 1) -> bytes:
        chunk = bytes(self._buffer[:size])
        del self._buffer[:size]
        return chunk

    def write(self, data: bytes) -> int:
        self.writes.append(bytes(data))
        expected, response = self._script.pop(0) if self._script else (None, b"")
        if expected is not None:
            assert data == expected, f"expected write {expected!r}, got {data!r}"
            if not expected.endswith(b"\x1a"):
                self._buffer.extend(expected + b"\r\n")
        self._buffer.extend(response)
        return len(data)

    def flush(self) -> None:
        return None

    def close(self) -> None:
        self.is_open = False
        self.closed = True


class FakeTransport:
    """In-memory transport used by the HTTP tests."""

    name = "fake"

    def __init__(
        self,
        *,
        result: SendResult | None = None,
        error: Exception | None = None,
        probe: dict[str, Any] | None = None,
    ) -> None:
        self.result = result or SendResult(message_id="42", transport=self.name)
        self.error = error
        self.probe_result = probe if probe is not None else {"reachable": True}
        self.sent: list[tuple[str, str]] = []
        self.closed = False

    def send(self, phone: str, text: str) -> SendResult:
        self.sent.append((phone, text))
        if self.error is not None:
            raise self.error
        return self.result

    def probe(self) -> dict[str, Any]:
        return dict(self.probe_result)

    def close(self) -> None:
        self.closed = True


class FakeResponse:
    def __init__(self, text: str = "", status_code: int = 200, headers: dict[str, str] | None = None) -> None:
        self.text = text
        self.status_code = status_code
        self.headers = headers or {}


class FakeHiLinkSession:
    """Minimal ``requests.Session`` replacement with queued responses."""

    def __init__(self, *, gets: list[Any] | None = None, posts: list[Any] | None = None) -> None:
        self.cookies = requests.cookies.RequestsCookieJar()
        self.calls: list[dict[str, Any]] = []
        self._gets = list(gets or [])
        self._posts = list(posts or [])
        self.closed = False

    def request(self, method: str, url: str, **kwargs: Any) -> FakeResponse:
        self.calls.append({"method": method, "url": url, **kwargs})
        queue = self._gets if method == "GET" else self._posts
        if not queue:
            raise AssertionError(f"unexpected {method} {url}")
        result = queue.pop(0)
        if isinstance(result, Exception):
            raise result
        return result

    def close(self) -> None:
        self.closed = True


@pytest.fixture
def settings_factory():
    def make(**overrides: Any) -> Settings:
        defaults: dict[str, Any] = {
            "_env_file": None,
            "transport": "at",
            "at_port": "COM_TEST",
            "at_command_timeout": 0.15,
            "at_send_timeout": 0.2,
            "at_retries": 1,
            "at_retry_delay": 0.0,
            "send_lock_timeout": 0.5,
            "cors_origins": "http://localhost:5173",
        }
        defaults.update(overrides)
        return Settings(**defaults)

    return make


@pytest.fixture
def app_factory():
    def make(transport: FakeTransport | None = None, **overrides: Any):
        defaults: dict[str, Any] = {
            "_env_file": None,
            "transport": "at",
            "at_port": "COM_TEST",
            "api_key": None,
            "max_sms_length": 160,
        }
        defaults.update(overrides)
        fake = transport or FakeTransport()
        return create_app(settings=Settings(**defaults), transport=fake), fake

    return make


@pytest.fixture
def api(app_factory):
    @contextmanager
    def _api(
        transport: FakeTransport | None = None,
        *,
        raise_server_exceptions: bool = True,
        **overrides: Any,
    ) -> Iterator[tuple[TestClient, FakeTransport]]:
        app, fake = app_factory(transport, **overrides)
        with TestClient(app, raise_server_exceptions=raise_server_exceptions) as client:
            yield client, fake

    return _api
