"""HTTP API tests using the fake transport."""

from __future__ import annotations

import re

import pytest

from app.errors import ModemBusy, ModemTimeout, ModemUnavailable, SendRejected
from conftest import FakeTransport

PAYLOAD = {"to": "+15551234567", "message": "Hello"}


def test_send_sms_success(api):
    with api() as (client, fake):
        response = client.post("/send-sms", json={"to": "+1 (555) 123-4567", "message": "Hello"})

        assert response.status_code == 200
        body = response.json()
        assert body["status"] == "sent"
        assert body["to"] == "+15551234567"
        assert body["transport"] == "fake"
        assert body["message_id"] == "42"
        assert response.headers["X-Request-ID"] == body["request_id"]
        assert fake.sent == [("+15551234567", "Hello")]


def test_request_id_is_echoed(api):
    with api() as (client, _fake):
        response = client.post("/send-sms", json=PAYLOAD, headers={"X-Request-ID": "corr-123"})

        assert response.status_code == 200
        assert response.headers["X-Request-ID"] == "corr-123"
        assert response.json()["request_id"] == "corr-123"


def test_invalid_request_id_is_replaced(api):
    with api() as (client, _fake):
        response = client.post("/send-sms", json=PAYLOAD, headers={"X-Request-ID": "bad id!"})

        generated = response.json()["request_id"]
        assert generated != "bad id!"
        assert re.fullmatch(r"[0-9a-f]{32}", generated)


def test_invalid_number_returns_problem_details(api):
    with api() as (client, fake):
        response = client.post("/send-sms", json={"to": "12345", "message": "Hello"})

        assert response.status_code == 422
        body = response.json()
        assert body["code"] == "INVALID_REQUEST"
        assert body["errors"][0]["field"] == "to"
        assert "E.164" in body["errors"][0]["message"]
        assert fake.sent == []


def test_unknown_fields_are_rejected(api):
    with api() as (client, _fake):
        response = client.post("/send-sms", json={**PAYLOAD, "unexpected": True})

        assert response.status_code == 422
        assert response.json()["code"] == "INVALID_REQUEST"


def test_message_longer_than_limit_is_rejected(api):
    with api(max_sms_length=5) as (client, fake):
        response = client.post("/send-sms", json={"to": "+15551234567", "message": "123456"})

        assert response.status_code == 422
        assert response.json()["code"] == "MESSAGE_TOO_LONG"
        assert fake.sent == []


@pytest.mark.parametrize(
    ("error", "status", "code"),
    [
        (ModemTimeout("timed out"), 504, "MODEM_TIMEOUT"),
        (ModemUnavailable("no port"), 503, "MODEM_UNAVAILABLE"),
        (ModemBusy("busy", retry_after=2), 503, "MODEM_BUSY"),
        (SendRejected("no credit", modem_code="+CMS ERROR: 500"), 502, "SEND_REJECTED"),
    ],
)
def test_transport_errors_are_mapped_to_problem_details(api, error, status, code):
    with api(FakeTransport(error=error)) as (client, _fake):
        response = client.post("/send-sms", json=PAYLOAD)

    assert response.status_code == status
    assert response.json()["code"] == code
    assert response.json()["status"] == status


def test_busy_response_sets_retry_after(api):
    with api(FakeTransport(error=ModemBusy("busy", retry_after=3))) as (client, _fake):
        response = client.post("/send-sms", json=PAYLOAD)

    assert response.headers["Retry-After"] == "3"


def test_api_key_is_enforced_for_sending_only(api):
    with api(api_key="secret") as (client, fake):
        missing = client.post("/send-sms", json=PAYLOAD)
        wrong = client.post("/send-sms", json=PAYLOAD, headers={"X-API-Key": "wrong"})
        allowed = client.post("/send-sms", json=PAYLOAD, headers={"X-API-Key": "secret"})
        health = client.get("/health")

        assert missing.status_code == 401
        assert missing.json()["code"] == "UNAUTHORIZED"
        assert wrong.status_code == 401
        assert allowed.status_code == 200
        assert health.status_code == 200
        assert fake.sent == [("+15551234567", "Hello")]


def test_health_without_probe(api):
    with api() as (client, _fake):
        response = client.get("/health")

        assert response.status_code == 200
        assert response.json() == {
            "status": "ok",
            "transport": "fake",
            "configured": True,
            "modem": None,
        }


def test_health_with_probe(api):
    transport = FakeTransport(
        probe={
            "reachable": True,
            "port": "COM3",
            "model": "E173z-1",
            "sim": "READY",
            "registered": True,
            "signal": 18,
        }
    )
    with api(transport) as (client, _fake):
        response = client.get("/health", params={"probe": "true"})

        body = response.json()
        assert response.status_code == 200
        assert body["status"] == "ok"
        assert body["modem"] == {
            "reachable": True,
            "port": "COM3",
            "model": "E173z-1",
            "sim": "READY",
            "registered": True,
            "signal": 18,
        }


@pytest.mark.parametrize(
    "probe",
    [
        {"reachable": True, "sim": "SIM PIN", "registered": True},
        {"reachable": True, "sim": "READY", "registered": False, "smsc": "+447785016005"},
        {"reachable": True, "sim": "READY", "registered": True, "smsc": ""},
    ],
)
def test_health_is_degraded_when_the_probed_modem_cannot_send(api, probe):
    transport = FakeTransport(probe=probe)
    with api(transport) as (client, _fake):
        body = client.get("/health", params={"probe": "true"}).json()

    assert body["status"] == "degraded"


def test_health_is_ok_when_the_message_centre_is_configured(api):
    transport = FakeTransport(
        probe={"reachable": True, "sim": "READY", "registered": True, "smsc": ""}
    )
    with api(transport, at_smsc="+447785016005") as (client, _fake):
        body = client.get("/health", params={"probe": "true"}).json()

    assert body["status"] == "ok"


def test_health_is_degraded_when_the_modem_is_unreachable(api):
    transport = FakeTransport(probe={"reachable": False, "error": "no port"})
    with api(transport) as (client, _fake):
        response = client.get("/health", params={"probe": "true"})

        body = response.json()
        assert response.status_code == 200
        assert body["status"] == "degraded"
        assert body["modem"] == {"reachable": False, "error": "no port"}


def test_unhandled_errors_return_problem_details(api):
    transport = FakeTransport(error=RuntimeError("boom"))
    with api(transport, raise_server_exceptions=False) as (client, _fake):
        response = client.post("/send-sms", json=PAYLOAD)

    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL_ERROR"
    assert response.headers["X-Request-ID"]


def test_transport_is_closed_on_shutdown(api):
    with api() as (client, fake):
        assert client.get("/health").status_code == 200

    assert fake.closed is True

