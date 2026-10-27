"""Huawei HiLink HTTP API transport (requests)."""

from __future__ import annotations

import base64
import hashlib
import logging
import threading
import xml.etree.ElementTree as ET
from typing import Any
from xml.sax.saxutils import escape

import requests

from app.config import Settings
from app.errors import ModemBusy, ModemTimeout, ModemUnavailable, SendRejected, SmsError
from app.transports.base import SendResult

_LOGGER = logging.getLogger(__name__)

_TOKEN_ERRORS = frozenset({"113001", "113002"})


def _child_text(root: ET.Element, name: str) -> str | None:
    for child in root.iter():
        if child.tag.rsplit("}", 1)[-1] == name:
            return child.text
    return None


def _xml(fields: dict[str, Any]) -> str:
    body = "".join(f"<{key}>{escape(str(value))}</{key}>" for key, value in fields.items())
    return f'<?xml version="1.0" encoding="UTF-8"?><request>{body}</request>'


def _response_value(response: requests.Response) -> str:
    text = (response.text or "").strip()
    if not text:
        return f"HTTP {response.status_code}"
    try:
        root = ET.fromstring(text)
    except ET.ParseError:
        return text[:200]
    value = (root.text or "").strip()
    if value:
        return value
    child = next(iter(root), None)
    if child is not None and child.text:
        return child.text.strip()
    return f"HTTP {response.status_code}"


class HiLinkTransport:
    """Sends SMS through the HiLink web API exposed by Huawei routers."""

    name = "hilink"

    def __init__(self, settings: Settings, session: requests.Session | None = None) -> None:
        self._settings = settings
        self._session = session or requests.Session()
        self._lock = threading.Lock()
        self._token: str | None = None
        self._logged_in = False

    def close(self) -> None:
        with self._lock:
            try:
                self._session.close()
            except Exception:  # pragma: no cover - defensive
                _LOGGER.debug("error while closing the HTTP session", exc_info=True)

    # ------------------------------------------------------------------------ HTTP
    def _url(self, path: str) -> str:
        return f"{self._settings.hilink_base_url}/api/{path.lstrip('/')}"

    def _request(self, method: str, path: str, **kwargs: Any) -> requests.Response:
        headers = dict(kwargs.pop("headers", {}))
        if self._token:
            headers.setdefault("__RequestVerificationToken", self._token)
        headers.setdefault("Referer", f"{self._settings.hilink_base_url}/")
        kwargs.setdefault("timeout", (5.0, self._settings.hilink_timeout))
        try:
            response = self._session.request(method, self._url(path), headers=headers, **kwargs)
        except requests.Timeout as exc:
            raise ModemTimeout(f"HiLink request timed out: {method} {path}") from exc
        except requests.RequestException as exc:
            raise ModemUnavailable(
                f"cannot reach the HiLink API at {self._settings.hilink_base_url}: {exc}"
            ) from exc
        if response.status_code >= 500:
            raise ModemUnavailable(f"HiLink API returned HTTP {response.status_code}")
        if response.status_code in (401, 403):
            raise SendRejected(
                "HiLink API requires authentication", modem_code=f"HTTP {response.status_code}"
            )
        return response

    def _refresh_token(self) -> None:
        response = self._request("GET", "webserver/SesTokInfo")
        if response.status_code != 200:
            raise ModemUnavailable(f"HiLink SesTokInfo returned HTTP {response.status_code}")
        try:
            root = ET.fromstring(response.text)
        except ET.ParseError as exc:
            raise SendRejected("HiLink SesTokInfo returned malformed XML") from exc
        token = _child_text(root, "TokInfo")
        if not token:
            raise SendRejected("HiLink SesTokInfo did not include a token")
        self._token = token.strip()
        session_info = _child_text(root, "SesInfo") or ""
        for part in session_info.split(";"):
            key, _, value = part.partition("=")
            if key.strip() == "SessionID" and value.strip():
                self._session.cookies.set("SessionID", value.strip())
        _LOGGER.debug("refreshed the HiLink session token")

    # ----------------------------------------------------------------------- login
    def _ensure_session(self) -> None:
        if self._token is None:
            self._refresh_token()
        if not self._logged_in and self._settings.hilink_username and self._settings.hilink_password:
            self._login()

    def _login(self) -> None:
        state_response = self._request("GET", "user/state-login")
        password_type = 0
        state: str | None = None
        try:
            state_root = ET.fromstring(state_response.text)
            state = _child_text(state_root, "State")
            raw_type = _child_text(state_root, "password_type")
            if raw_type and raw_type.strip().isdigit():
                password_type = int(raw_type.strip())
        except ET.ParseError:
            _LOGGER.debug("could not parse HiLink login state", exc_info=True)
        if state and state.strip() == "1":
            self._logged_in = True
            return

        username = self._settings.hilink_username or ""
        password = self._settings.hilink_password or ""
        if password_type == 1 and self._token:
            digest = hashlib.sha256(password.encode("utf-8")).hexdigest().encode("ascii")
            concentrated = username.encode("utf-8") + base64.b64encode(digest) + self._token.encode("utf-8")
            encoded = base64.b64encode(hashlib.sha256(concentrated).hexdigest().encode("ascii")).decode("ascii")
        else:
            encoded = base64.b64encode(password.encode("utf-8")).decode("ascii")
        body = _xml({"Username": username, "Password": encoded, "password_type": password_type})
        response = self._request(
            "POST",
            "user/login",
            data=body.encode("utf-8"),
            headers={"Content-Type": self._settings.hilink_content_type},
        )
        result = _response_value(response)
        if result != "OK":
            raise ModemUnavailable(f"HiLink login failed ({result})")
        new_token = response.headers.get("__RequestVerificationToken") or response.headers.get(
            "__RequestVerificationTokenone"
        )
        if new_token:
            self._token = new_token
        self._logged_in = True

    # --------------------------------------------------------------------- sending
    def send(self, phone: str, text: str) -> SendResult:
        if not self._lock.acquire(timeout=self._settings.send_lock_timeout):
            raise ModemBusy("another SMS is currently being sent", retry_after=2)
        try:
            for attempt in range(2):
                self._ensure_session()
                body = self._build_body(phone, text)
                response = self._request(
                    "POST",
                    "sms/send-sms",
                    data=body.encode("utf-8"),
                    headers={"Content-Type": self._settings.hilink_content_type},
                )
                result = _response_value(response)
                if result == "OK":
                    return SendResult(message_id=None, transport=self.name)
                if result in _TOKEN_ERRORS and attempt == 0:
                    _LOGGER.info("HiLink token expired (%s); refreshing and retrying", result)
                    self._refresh_token()
                    continue
                raise SendRejected(
                    f"HiLink rejected the message ({result})", modem_code=f"HILINK {result}"
                )
            raise SendRejected("HiLink rejected the message after refreshing the session")
        finally:
            self._lock.release()

    def _build_body(self, phone: str, text: str) -> str:
        content = text
        if self._settings.hilink_content_base64:
            content = base64.b64encode(text.encode("utf-8")).decode("ascii")
        return (
            '<?xml version="1.0" encoding="UTF-8"?>'
            "<request>"
            "<Index>-1</Index>"
            f"<Phones><Phone>{escape(phone)}</Phone></Phones>"
            "<Sca></Sca>"
            f"<Content>{escape(content)}</Content>"
            f"<Length>{len(text)}</Length>"
            "<Reserved>1</Reserved>"
            "<Date>-1</Date>"
            "</request>"
        )

    # ------------------------------------------------------------------ diagnostics
    def probe(self) -> dict[str, Any]:
        info: dict[str, Any] = {"base_url": self._settings.hilink_base_url, "reachable": False}
        if not self._lock.acquire(timeout=self._settings.send_lock_timeout):
            info["error"] = "modem busy"
            return info
        try:
            self._refresh_token()
            info["reachable"] = True
            try:
                response = self._request("GET", "device/information")
                root = ET.fromstring(response.text)
                info["model"] = _child_text(root, "DeviceName") or _child_text(root, "deviceName")
            except Exception:  # best effort: not every firmware exposes device information
                _LOGGER.debug("could not read HiLink device information", exc_info=True)
        except SmsError as exc:
            info["error"] = str(exc)
        finally:
            self._lock.release()
        return info

