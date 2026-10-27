"""AT command transport for Huawei USB modems (pyserial).

The E173z-1 is driven in text mode (``AT+CMGF=1``). Messages that only use
characters with identical ASCII and GSM codes go out with ``AT+CSCS="GSM"``;
everything else is encoded as UCS-2 hex under ``AT+CSCS="UCS2"`` (which also
applies to the phone number). Emoji and other non-BMP characters are rejected.
"""

from __future__ import annotations

import logging
import re
import threading
import time
from typing import Any, Callable

import serial

from app.config import Settings
from app.errors import (
    MessageTooLong,
    ModemBusy,
    ModemTimeout,
    ModemUnavailable,
    SendRejected,
    SmsError,
    UnsupportedCharacter,
)
from app.transports.base import SendResult

_LOGGER = logging.getLogger(__name__)

# Subset of the GSM 03.38 alphabet whose code points are identical in ASCII.
# Characters such as @, $, _, {, }, [, ], ~, |, \ and ^ are deliberately
# excluded: their GSM codes differ from ASCII (or need an escape), so those
# messages are sent as UCS-2 instead. This keeps byte-level encoding unambiguous
# regardless of how a specific firmware interprets AT+CSCS="GSM".
GSM7_SAFE_ASCII = frozenset(
    " !\"#%&'()*+,-./0123456789:;<=>?"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz\n\r"
)

_FINAL_RE = re.compile(rb"(OK|ERROR|\+CMS ERROR:\s*\d+|\+CME ERROR:\s*\d+)\s*(?:\r?\n)?$")
_CMS_CODE_RE = re.compile(r"\+CMS ERROR:\s*(\d+)")
_MR_RE = re.compile(r"\+CMGS:\s*(\d+)")
_ERROR_MARKER = b"__ERROR__"

_CMS_REASONS = {
    1: "unassigned number",
    8: "operator determined barring",
    10: "call barred",
    21: "short message transfer rejected",
    27: "destination out of service",
    28: "unidentified subscriber",
    30: "unknown subscriber",
    38: "network out of order",
    41: "temporary failure",
    42: "congestion",
    47: "resources unavailable",
    50: "requested facility not supported",
    69: "requested facility not subscribed",
    500: "unknown modem error",
    515: "device busy",
}
# 515 is Huawei's "please wait"; 500 is often transient on the E173 family.
_RETRYABLE_CMS = frozenset({500, 515})


class _ReadTimeout(Exception):
    """Internal: the modem did not produce the expected bytes in time."""

    def __init__(self, buffer: bytes) -> None:
        super().__init__("modem read timed out")
        self.buffer = buffer


def _final_from_buffer(buffer: bytes) -> str | None:
    match = _FINAL_RE.search(buffer)
    return match.group(1).decode("ascii", "replace") if match else None


def _cms_code(final: str) -> int | None:
    match = _CMS_CODE_RE.search(final)
    return int(match.group(1)) if match else None


def _line_value(raw: str, prefix: str) -> str | None:
    for line in raw.replace("\r", "").split("\n"):
        line = line.strip()
        if line.startswith(prefix):
            return line[len(prefix) :].strip()
    return None


def _model_from_identity(raw: str) -> str | None:
    lines = [
        line.strip()
        for line in raw.replace("\r", "").split("\n")
        if line.strip() and not line.strip().startswith("AT") and line.strip() not in {"OK", "ERROR"}
    ]
    for line in lines:
        if re.search(r"\bE\d{3}[a-z]?\b", line, re.IGNORECASE):
            # Huawei identity lines look like "Model: E173"; keep just the model.
            _, _, tail = line.rpartition(":")
            return tail.strip() or line
    return lines[0] if lines else None



class AtModemTransport:
    """Sends SMS over a serial AT-command interface."""

    name = "at"

    def __init__(self, settings: Settings, serial_factory: Callable[..., Any] = serial.Serial) -> None:
        self._settings = settings
        self._serial_factory = serial_factory
        self._serial: Any | None = None
        self._lock = threading.Lock()
        self._active_port: str = settings.at_port
        self._probe_cache: dict[str, Any] | None = None
        self._probe_cache_time: float = 0.0
        self._probe_cache_ttl: float = 3.0

    @staticmethod
    def _auto_detect_port() -> str | None:
        try:
            from serial.tools import list_ports
            ports = list_ports.comports()
            for p in ports:
                if getattr(p, "vid", None) == 0x12D1 or (p.hwid and "12D1" in p.hwid.upper()):
                    desc = (p.description or "").lower()
                    if "pc ui" in desc or "modem" in desc:
                        return p.device
            for p in ports:
                desc = (p.description or "").lower()
                if "huawei" in desc or "3g modem" in desc or "mobile connect" in desc:
                    return p.device
            for p in ports:
                if getattr(p, "vid", None) == 0x12D1 or (p.hwid and "12D1" in p.hwid.upper()):
                    return p.device
        except Exception:
            _LOGGER.debug("port auto-detection failed", exc_info=True)
        return None

    # ------------------------------------------------------------------ lifecycle
    def close(self) -> None:
        with self._lock:
            self._close_serial()

    def _open(self) -> None:
        if self._serial is not None and getattr(self._serial, "is_open", False):
            return

        # Instant check when using real serial.Serial
        if self._serial_factory is serial.Serial:
            try:
                from serial.tools import list_ports
                avail = [p.device.upper() for p in list_ports.comports()]
                if not avail:
                    raise ModemUnavailable("no USB modem/serial port detected on host")
            except ModemUnavailable:
                raise
            except Exception:
                pass

        target_port = self._active_port or self._settings.at_port
        candidates = []
        detected = self._auto_detect_port()
        if detected:
            candidates.append(detected)
        if target_port and target_port not in candidates:
            candidates.append(target_port)

        last_exc: Exception | None = None
        for port in candidates:
            try:
                self._serial = self._serial_factory(
                    port=port,
                    baudrate=self._settings.at_baud,
                    timeout=0.03,
                    write_timeout=2,
                )
                self._active_port = port
                _LOGGER.info("opened AT port %s at %d baud", port, self._settings.at_baud)
                return
            except (serial.SerialException, OSError) as exc:
                self._serial = None
                last_exc = exc
                continue

        raise ModemUnavailable(f"cannot open serial port {target_port}: {last_exc}") from last_exc

    def _close_serial(self) -> None:
        serial_port, self._serial = self._serial, None
        if serial_port is None:
            return
        try:
            if getattr(serial_port, "is_open", False):
                serial_port.close()
        except Exception:  # pragma: no cover - hardware dependent
            _LOGGER.debug("error while closing the serial port", exc_info=True)

    # ------------------------------------------------------------------------ I/O
    def _read_chunk(self) -> bytes:
        if self._serial is None:
            raise ModemUnavailable("serial port is not open")
        try:
            pending = self._serial.in_waiting
            return self._serial.read(pending or 1)
        except (serial.SerialException, OSError) as exc:
            raise ModemUnavailable(f"serial read failed: {exc}") from exc

    def _write(self, data: str | bytes) -> None:
        if self._serial is None:
            raise ModemUnavailable("serial port is not open")
        payload = data.encode("ascii") if isinstance(data, str) else data
        try:
            self._serial.write(payload)
            self._serial.flush()
        except (serial.SerialException, OSError) as exc:
            raise ModemUnavailable(f"serial write failed: {exc}") from exc

    def _read_until(
        self,
        markers: tuple[bytes, ...],
        timeout: float,
        *,
        error_re: re.Pattern[bytes] | None = None,
    ) -> tuple[bytes, bytes]:
        buffer = bytearray()
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            chunk = self._read_chunk()
            if not chunk:
                continue
            buffer.extend(chunk)
            for marker in markers:
                if marker in buffer:
                    return bytes(buffer), marker
            if error_re is not None and error_re.search(bytes(buffer)):
                return bytes(buffer), _ERROR_MARKER
        raise _ReadTimeout(bytes(buffer))

    def _read_response(self, timeout: float) -> tuple[str, str]:
        buffer = bytearray()
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            chunk = self._read_chunk()
            if not chunk:
                continue
            buffer.extend(chunk)
            match = _FINAL_RE.search(bytes(buffer))
            if match:
                raw = bytes(buffer).decode("ascii", "replace")
                return raw, match.group(1).decode("ascii", "replace")
        raise _ReadTimeout(bytes(buffer))

    def _command(self, command: str, *, timeout: float | None = None) -> tuple[str, str]:
        self._write(command + "\r")
        raw, final = self._read_response(timeout or self._settings.at_command_timeout)
        _LOGGER.debug("AT %s -> %r", command, raw)
        return raw, final

    def _drain(self) -> None:
        if self._serial is None:
            return
        deadline = time.monotonic() + 0.1
        while time.monotonic() < deadline:
            try:
                pending = self._serial.in_waiting
                if pending:
                    self._serial.read(pending)
                    deadline = time.monotonic() + 0.1
                else:
                    time.sleep(0.02)
            except (serial.SerialException, OSError):
                self._close_serial()
                return

    # --------------------------------------------------------------------- sending
    def send(self, phone: str, text: str) -> SendResult:
        charset, number, payload = self._prepare(phone, text)
        if not self._lock.acquire(timeout=self._settings.send_lock_timeout):
            raise ModemBusy("another SMS is currently being sent", retry_after=2)
        try:
            try:
                return self._send_locked(charset, number, payload)
            except ModemTimeout:
                self._close_serial()
                raise
            except _ReadTimeout as exc:
                self._close_serial()
                raise ModemTimeout("modem did not answer; the serial port was reset") from exc
            except (serial.SerialException, OSError) as exc:
                self._close_serial()
                raise ModemUnavailable(f"serial connection failed: {exc}") from exc
        finally:
            self._lock.release()

    def _send_locked(self, charset: str, number: str, payload: str) -> SendResult:
        self._open()
        self._expect_ok("AT", "checking the modem")
        self._expect_ok("AT+CMGF=1", "enabling text mode")
        if self._settings.at_smsc:
            self._expect_ok(f'AT+CSCA="{self._settings.at_smsc}"', "configuring the SMSC")
        self._expect_ok(f'AT+CSCS="{charset}"', "selecting the character set")

        attempts = self._settings.at_retries + 1
        for attempt in range(attempts):
            try:
                return self._submit(number, payload)
            except SendRejected as exc:
                if not exc.retryable or attempt + 1 >= attempts:
                    raise
                _LOGGER.warning("modem busy (%s); retrying (attempt %d/%d)", exc.detail, attempt + 2, attempts)
                self._drain()
                time.sleep(self._settings.at_retry_delay)
        raise AssertionError("unreachable")  # pragma: no cover

    def _submit(self, number: str, payload: str) -> SendResult:
        self._write(f'AT+CMGS="{number}"\r')
        prompt, marker = self._read_until(
            (b">",), self._settings.at_command_timeout, error_re=_FINAL_RE
        )
        if marker == _ERROR_MARKER:
            final = _final_from_buffer(prompt)
            if final and final != "OK":
                raise self._rejected(final)
            raise SendRejected("modem did not present the message prompt", modem_code=final)
        _LOGGER.debug("CMGS prompt received after %r", prompt[-16:])

        self._write(payload.encode("ascii") + b"\x1a")
        try:
            raw, final = self._read_response(self._settings.at_send_timeout)
        except _ReadTimeout as exc:
            raise ModemTimeout(
                "no final result code after submitting the message; delivery state is unknown"
            ) from exc
        _LOGGER.debug("CMGS result: %r", raw)
        if final != "OK":
            raise self._rejected(final)
        match = _MR_RE.search(raw)
        return SendResult(message_id=match.group(1) if match else None, transport=self.name)

    def _expect_ok(self, command: str, what: str, *, timeout: float | None = None) -> str:
        try:
            raw, final = self._command(command, timeout=timeout)
        except _ReadTimeout as exc:
            raise ModemTimeout(f"no response to {command!r} while {what}") from exc
        if final != "OK":
            code = _cms_code(final)
            if code is not None:
                raise SendRejected(
                    f"{what} failed: {_CMS_REASONS.get(code, final)}",
                    modem_code=f"+CMS ERROR: {code}",
                    retryable=code in _RETRYABLE_CMS,
                )
            raise ModemUnavailable(f"{what} failed: {final}")
        return raw

    def _rejected(self, final: str) -> SendRejected:
        code = _cms_code(final)
        if code is not None:
            reason = _CMS_REASONS.get(code, "unknown modem error")
            return SendRejected(
                f"modem rejected the message: {reason}",
                modem_code=f"+CMS ERROR: {code}",
                retryable=code in _RETRYABLE_CMS,
            )
        if final.startswith("+CME ERROR"):
            return SendRejected(f"modem rejected the message: {final}", modem_code=final)
        return SendRejected("modem rejected the message", modem_code=final)

    @staticmethod
    def _prepare(phone: str, text: str) -> tuple[str, str, str]:
        if all(char in GSM7_SAFE_ASCII for char in text):
            return "GSM", phone, text
        if any(ord(char) > 0xFFFF for char in text):
            raise UnsupportedCharacter(
                "message contains characters outside the Basic Multilingual Plane (for example emoji)"
            )
        if len(text) > 70:
            raise MessageTooLong(
                f"message is {len(text)} characters; UCS-2 messages are limited to 70 characters "
                "for a single segment (GSM-safe text allows up to 160)"
            )
        return "UCS2", phone.encode("utf-16-be").hex().upper(), text.encode("utf-16-be").hex().upper()

    # ------------------------------------------------------------------ diagnostics
    def probe(self) -> dict[str, Any]:
        now = time.monotonic()
        if self._probe_cache is not None and (now - self._probe_cache_time) < self._probe_cache_ttl:
            return dict(self._probe_cache)

        port_to_report = self._active_port or self._settings.at_port
        info: dict[str, Any] = {"port": port_to_report, "reachable": False}
        fast_timeout = min(1.0, self._settings.send_lock_timeout)
        if not self._lock.acquire(timeout=fast_timeout):
            info["error"] = "modem busy"
            return info
        try:
            self._open()
            port_to_report = self._active_port or self._settings.at_port
            info["port"] = port_to_report
            cmd_timeout = min(1.2, self._settings.at_command_timeout)

            identity_raw, _ = self._command("ATI", timeout=cmd_timeout)
            info["reachable"] = True
            info["model"] = _model_from_identity(identity_raw)

            cpin_raw, cpin_final = self._command("AT+CPIN?", timeout=cmd_timeout)
            info["sim"] = _line_value(cpin_raw, "+CPIN:")
            if cpin_final != "OK":
                info["error"] = f"SIM not ready ({cpin_final})"

            creg_raw, _ = self._command("AT+CREG?", timeout=cmd_timeout)
            creg = _line_value(creg_raw, "+CREG:")
            if creg:
                info["registered"] = creg.split(",")[-1].strip() in {"1", "5"}

            csq_raw, _ = self._command("AT+CSQ", timeout=cmd_timeout)
            csq = _line_value(csq_raw, "+CSQ:")
            if csq:
                rssi_text = csq.split(",")[0].strip()
                if rssi_text.isdigit() and 0 <= int(rssi_text) <= 31:
                    info["signal"] = int(rssi_text)

            csca_raw, _ = self._command("AT+CSCA?", timeout=cmd_timeout)
            csca = _line_value(csca_raw, "+CSCA:")
            if csca is not None:
                match = re.search(r'"([^"]*)"', csca)
                info["smsc"] = match.group(1).strip() if match else csca
        except (SmsError, serial.SerialException, OSError) as exc:
            self._close_serial()
            info["error"] = str(exc)
        except _ReadTimeout as exc:
            self._close_serial()
            info["error"] = f"timed out waiting for the modem after {len(exc.buffer)} bytes"
        finally:
            self._lock.release()
            self._probe_cache = dict(info)
            self._probe_cache_time = time.monotonic()
        return info

