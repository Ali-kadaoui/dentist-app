"""AT transport tests against a scripted serial port."""

from __future__ import annotations

import pytest
import serial

from app.errors import (
    MessageTooLong,
    ModemBusy,
    ModemTimeout,
    ModemUnavailable,
    SendRejected,
    UnsupportedCharacter,
)
from app.transports.at_modem import AtModemTransport
from app.transports.base import SendResult
from conftest import FakeSerial

PHONE = "+15551234567"
CMGS = f'AT+CMGS="{PHONE}"\r'.encode("ascii")


def _header(charset: str = "GSM", smsc: str | None = None) -> list[tuple[bytes, bytes]]:
    script = [(b"AT\r", b"\r\nOK\r\n"), (b"AT+CMGF=1\r", b"\r\nOK\r\n")]
    if smsc:
        script.append((f'AT+CSCA="{smsc}"\r'.encode("ascii"), b"\r\nOK\r\n"))
    script.append((f'AT+CSCS="{charset}"\r'.encode("ascii"), b"\r\nOK\r\n"))
    return script


def make_transport(settings, script, *, factory_error: Exception | None = None):
    created: list[FakeSerial] = []

    def factory(**kwargs):
        if factory_error is not None:
            raise factory_error
        port = FakeSerial(script=list(script), **kwargs)
        created.append(port)
        return port

    return AtModemTransport(settings, serial_factory=factory), created


def test_send_gsm_message(settings_factory):
    script = [
        *_header(),
        (CMGS, b"\r\n> "),
        (b"Hello world\x1a", b"\r\n+CMGS: 7\r\nOK\r\n"),
    ]
    transport, created = make_transport(settings_factory(), script)

    result = transport.send(PHONE, "Hello world")

    assert result == SendResult(message_id="7", transport="at")
    assert created[0].writes == [expected for expected, _ in script]


def test_configured_smsc_is_set(settings_factory):
    script = [
        *_header(smsc="+15550001111"),
        (CMGS, b"\r\n> "),
        (b"Hi\x1a", b"\r\n+CMGS: 3\r\nOK\r\n"),
    ]
    transport, created = make_transport(settings_factory(at_smsc="+15550001111"), script)

    transport.send(PHONE, "Hi")

    assert b'AT+CSCA="+15550001111"\r' in created[0].writes


def test_send_cyrillic_uses_ucs2_hex(settings_factory):
    message = "Привет"
    encoded_number = PHONE.encode("utf-16-be").hex().upper()
    encoded_text = message.encode("utf-16-be").hex().upper()
    script = [
        *_header("UCS2"),
        (f'AT+CMGS="{encoded_number}"\r'.encode("ascii"), b"\r\n> "),
        (encoded_text.encode("ascii") + b"\x1a", b"\r\n+CMGS: 9\r\nOK\r\n"),
    ]
    transport, created = make_transport(settings_factory(), script)

    result = transport.send(PHONE, message)

    assert result.message_id == "9"
    assert created[0].writes[-1] == encoded_text.encode("ascii") + b"\x1a"


def test_dollar_sign_falls_back_to_ucs2(settings_factory):
    message = "Total $5"
    encoded_text = message.encode("utf-16-be").hex().upper()
    script = [
        *_header("UCS2"),
        (f'AT+CMGS="{PHONE.encode("utf-16-be").hex().upper()}"\r'.encode("ascii"), b"\r\n> "),
        (encoded_text.encode("ascii") + b"\x1a", b"\r\n+CMGS: 4\r\nOK\r\n"),
    ]
    transport, _ = make_transport(settings_factory(), script)

    assert transport.send(PHONE, message).message_id == "4"


def test_non_bmp_character_is_rejected_before_opening_the_port(settings_factory):
    transport, created = make_transport(settings_factory(), [])

    with pytest.raises(UnsupportedCharacter):
        transport.send(PHONE, "Hi \U0001f600")

    assert created == []


def test_long_ucs2_message_is_rejected(settings_factory):
    transport, created = make_transport(settings_factory(), [])

    with pytest.raises(MessageTooLong):
        transport.send(PHONE, "Ж" * 71)

    assert created == []


def test_cms_515_is_retried(settings_factory):
    script = [
        *_header(),
        (CMGS, b"\r\n+CMS ERROR: 515\r\n"),
        (CMGS, b"\r\n> "),
        (b"Retry me\x1a", b"\r\n+CMGS: 12\r\nOK\r\n"),
    ]
    transport, created = make_transport(settings_factory(at_retries=1), script)

    result = transport.send(PHONE, "Retry me")

    assert result.message_id == "12"
    assert sum(1 for write in created[0].writes if write.startswith(b"AT+CMGS")) == 2


def test_non_retryable_cms_error_is_rejected(settings_factory):
    script = [*_header(), (CMGS, b"\r\n+CMS ERROR: 500\r\n")]
    transport, created = make_transport(settings_factory(at_retries=0), script)

    with pytest.raises(SendRejected) as excinfo:
        transport.send(PHONE, "No credit")

    assert excinfo.value.modem_code == "+CMS ERROR: 500"
    assert excinfo.value.status_code == 502
    assert sum(1 for write in created[0].writes if write.startswith(b"AT+CMGS")) == 1


def test_error_instead_of_prompt_is_rejected(settings_factory):
    script = [*_header(), (CMGS, b"\r\n+CMS ERROR: 305\r\n")]
    transport, _ = make_transport(settings_factory(), script)

    with pytest.raises(SendRejected) as excinfo:
        transport.send(PHONE, "Bad mode")

    assert excinfo.value.modem_code == "+CMS ERROR: 305"


def test_prompt_timeout_is_not_retried_and_resets_the_port(settings_factory):
    script = [*_header(), (CMGS, b"")]
    settings = settings_factory(at_command_timeout=0.05, at_retries=3)
    transport, created = make_transport(settings, script)

    with pytest.raises(ModemTimeout):
        transport.send(PHONE, "Timeout")

    assert created[0].closed is True
    assert sum(1 for write in created[0].writes if write.startswith(b"AT+CMGS")) == 1
    assert transport._serial is None


def test_port_is_reopened_after_close(settings_factory):
    script = [
        *_header(),
        (CMGS, b"\r\n> "),
        (b"Again\x1a", b"\r\n+CMGS: 21\r\nOK\r\n"),
    ]
    calls: list[FakeSerial] = []

    def factory(**kwargs):
        port = FakeSerial(script=list(script), **kwargs)
        calls.append(port)
        return port

    transport = AtModemTransport(settings_factory(), serial_factory=factory)
    transport.send(PHONE, "Again")
    transport.close()
    transport.send(PHONE, "Again")

    assert len(calls) == 2
    assert calls[0].closed is True


def test_send_is_rejected_when_modem_is_busy(settings_factory):
    transport, _ = make_transport(settings_factory(send_lock_timeout=0.01), [])
    assert transport._lock.acquire()

    try:
        with pytest.raises(ModemBusy):
            transport.send(PHONE, "Busy")
    finally:
        transport._lock.release()


def test_open_failure_maps_to_modem_unavailable(settings_factory):
    transport, _ = make_transport(
        settings_factory(), [], factory_error=serial.SerialException("access denied")
    )

    with pytest.raises(ModemUnavailable) as excinfo:
        transport.send(PHONE, "Hi")

    assert "access denied" in str(excinfo.value)


def test_probe_reports_device_details(settings_factory):
    script = [
        (b"ATI\r", b"\r\nHuawei Technologies Co., Ltd.\r\nE173z-1\r\nOK\r\n"),
        (b"AT+CPIN?\r", b"\r\n+CPIN: READY\r\nOK\r\n"),
        (b"AT+CREG?\r", b"\r\n+CREG: 0,1\r\nOK\r\n"),
        (b"AT+CSQ\r", b"\r\n+CSQ: 18,99\r\nOK\r\n"),
        (b"AT+CSCA?\r", b'\r\n+CSCA: "+447785016005",145\r\nOK\r\n'),
    ]
    transport, _ = make_transport(settings_factory(), script)

    info = transport.probe()

    assert info == {
        "port": "COM_TEST",
        "reachable": True,
        "model": "E173z-1",
        "sim": "READY",
        "smsc": "+447785016005",
        "registered": True,
        "signal": 18,
    }


def test_probe_reads_the_model_from_huawei_identity(settings_factory):
    script = [
        (
            b"ATI\r",
            b"\r\nManufacturer: huawei\r\nModel: E173\r\nRevision: 21.157.48.00.864\r\nOK\r\n",
        ),
        (b"AT+CPIN?\r", b"\r\n+CPIN: READY\r\nOK\r\n"),
        (b"AT+CREG?\r", b"\r\n+CREG: 0,3\r\nOK\r\n"),
        (b"AT+CSQ\r", b"\r\n+CSQ: 11,99\r\nOK\r\n"),
        (b"AT+CSCA?\r", b'\r\n+CSCA: "",128\r\nOK\r\n'),
    ]
    transport, _ = make_transport(settings_factory(), script)

    info = transport.probe()

    assert info["model"] == "E173"
    assert info["sim"] == "READY"
    assert info["smsc"] == ""
    assert info["registered"] is False
    assert info["signal"] == 11


def test_probe_reports_unusable_port_instead_of_raising(settings_factory):
    transport, _ = make_transport(
        settings_factory(), [], factory_error=serial.SerialException("access denied")
    )

    info = transport.probe()

    assert info["reachable"] is False
    assert "access denied" in info["error"]

