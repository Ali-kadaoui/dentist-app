"""HiLink transport tests with a fake HTTP session."""

from __future__ import annotations

import base64
import hashlib

import pytest
import requests

from app.errors import ModemTimeout, ModemUnavailable, SendRejected
from app.transports.hilink import HiLinkTransport
from conftest import FakeHiLinkSession, FakeResponse

SES_TOK = (
    "<response><SesInfo>SessionID=abc123;Path=/;Max-Age=300</SesInfo>"
    "<TokInfo>token-1</TokInfo></response>"
)
SES_TOK_2 = SES_TOK.replace("token-1", "token-2")
OK = "<response>OK</response>"


def make_transport(settings_factory, session, **overrides) -> HiLinkTransport:
    overrides.setdefault("transport", "hilink")
    overrides.setdefault("hilink_base_url", "http://192.168.8.1")
    return HiLinkTransport(settings_factory(**overrides), session=session)


def test_send_uses_the_hilink_xml_api(settings_factory):
    session = FakeHiLinkSession(gets=[FakeResponse(SES_TOK)], posts=[FakeResponse(OK)])
    transport = make_transport(settings_factory, session)

    result = transport.send("+15551234567", "Hello & <world>")

    assert result.transport == "hilink"
    assert result.message_id is None
    get_call, post_call = session.calls
    assert get_call["url"] == "http://192.168.8.1/api/webserver/SesTokInfo"
    assert post_call["url"] == "http://192.168.8.1/api/sms/send-sms"
    assert post_call["headers"]["__RequestVerificationToken"] == "token-1"
    assert post_call["headers"]["Content-Type"] == "text/xml"
    assert any(cookie.name == "SessionID" and cookie.value == "abc123" for cookie in session.cookies)
    body = post_call["data"].decode("utf-8")
    assert "<Phone>+15551234567</Phone>" in body
    assert "<Content>Hello &amp; &lt;world&gt;</Content>" in body
    assert "<Length>15</Length>" in body


def test_expired_token_is_refreshed_once(settings_factory):
    session = FakeHiLinkSession(
        gets=[FakeResponse(SES_TOK), FakeResponse(SES_TOK_2)],
        posts=[FakeResponse("<response>113002</response>"), FakeResponse(OK)],
    )
    transport = make_transport(settings_factory, session)

    transport.send("+15551234567", "Hi")

    assert [call["method"] for call in session.calls] == ["GET", "POST", "GET", "POST"]
    assert session.calls[3]["headers"]["__RequestVerificationToken"] == "token-2"


def test_rejected_message_keeps_the_modem_code(settings_factory):
    session = FakeHiLinkSession(
        gets=[FakeResponse(SES_TOK)], posts=[FakeResponse("<response>ERROR</response>")]
    )
    transport = make_transport(settings_factory, session)

    with pytest.raises(SendRejected) as excinfo:
        transport.send("+15551234567", "Hi")

    assert excinfo.value.modem_code == "HILINK ERROR"


def test_http_timeout_maps_to_modem_timeout(settings_factory):
    session = FakeHiLinkSession(gets=[FakeResponse(SES_TOK)], posts=[requests.Timeout("slow")])
    transport = make_transport(settings_factory, session)

    with pytest.raises(ModemTimeout):
        transport.send("+15551234567", "Hi")


def test_connection_error_maps_to_modem_unavailable(settings_factory):
    session = FakeHiLinkSession(gets=[requests.ConnectionError("refused")])
    transport = make_transport(settings_factory, session)

    with pytest.raises(ModemUnavailable) as excinfo:
        transport.send("+15551234567", "Hi")

    assert "refused" in str(excinfo.value)


def test_login_sends_base64_password(settings_factory):
    session = FakeHiLinkSession(
        gets=[
            FakeResponse(SES_TOK),
            FakeResponse("<response><State>0</State><password_type>0</password_type></response>"),
        ],
        posts=[FakeResponse(OK), FakeResponse(OK)],
    )
    transport = make_transport(
        settings_factory, session, hilink_username="admin", hilink_password="secret"
    )

    transport.send("+15551234567", "Hi")

    assert [call["method"] for call in session.calls] == ["GET", "GET", "POST", "POST"]
    login_call = session.calls[2]
    assert login_call["url"] == "http://192.168.8.1/api/user/login"
    body = login_call["data"].decode("utf-8")
    encoded = base64.b64encode(b"secret").decode("ascii")
    assert "<Username>admin</Username>" in body
    assert f"<Password>{encoded}</Password>" in body
    assert "<password_type>0</password_type>" in body


def test_login_hashes_password_when_firmware_requests_it(settings_factory):
    session = FakeHiLinkSession(
        gets=[
            FakeResponse(SES_TOK),
            FakeResponse("<response><State>0</State><password_type>1</password_type></response>"),
        ],
        posts=[FakeResponse(OK), FakeResponse(OK)],
    )
    transport = make_transport(
        settings_factory, session, hilink_username="admin", hilink_password="secret"
    )

    transport.send("+15551234567", "Hi")

    inner = base64.b64encode(hashlib.sha256(b"secret").hexdigest().encode("ascii"))
    concentrated = b"admin" + inner + b"token-1"
    expected = base64.b64encode(hashlib.sha256(concentrated).hexdigest().encode("ascii")).decode("ascii")
    body = session.calls[2]["data"].decode("utf-8")
    assert f"<Password>{expected}</Password>" in body


def test_content_can_be_sent_as_base64(settings_factory):
    session = FakeHiLinkSession(gets=[FakeResponse(SES_TOK)], posts=[FakeResponse(OK)])
    transport = make_transport(settings_factory, session, hilink_content_base64=True)

    transport.send("+15551234567", "Hi")

    body = session.calls[1]["data"].decode("utf-8")
    assert f"<Content>{base64.b64encode(b'Hi').decode('ascii')}</Content>" in body
    assert "<Length>2</Length>" in body


def test_probe_reads_device_information(settings_factory):
    session = FakeHiLinkSession(
        gets=[
            FakeResponse(SES_TOK),
            FakeResponse("<response><DeviceName>E173z-1</DeviceName></response>"),
        ]
    )
    transport = make_transport(settings_factory, session)

    info = transport.probe()

    assert info == {
        "base_url": "http://192.168.8.1",
        "reachable": True,
        "model": "E173z-1",
    }


def test_probe_reports_unreachable_modem_instead_of_raising(settings_factory):
    session = FakeHiLinkSession(gets=[requests.ConnectionError("refused")])
    transport = make_transport(settings_factory, session)

    info = transport.probe()

    assert info["reachable"] is False
    assert "refused" in info["error"]


def test_close_closes_the_http_session(settings_factory):
    session = FakeHiLinkSession()
    transport = make_transport(settings_factory, session)

    transport.close()

    assert session.closed is True

