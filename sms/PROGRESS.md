# Project Progress — Huawei E173z-1 SMS Gateway

> **Persistent project record.** Maintenance rule: at the end of every major step,
> fix or hardware finding, update the status snapshot (§1), the affected file notes,
> and append a dated entry to the changelog (§13) with the validation command and its
> result.
>
> Last updated: **2026-10-17** · Repository root: `c:\Users\kadao\Desktop\New folder (2)`

## 1. Status snapshot

| Item | State |
| --- | --- |
| Overall | Feature-complete for single-segment SMS; tests green; live hardware partially validated |
| Test suite | **48 passed** (21 API + 16 AT + 11 HiLink), `exit=0`, ~0.6 s |
| Runtime | Python **3.12.10** in `.venv` (Windows 11, PowerShell) |
| Libraries | fastapi 0.143.3 · starlette 1.8.0 · pydantic 2.14.1 · pyserial 3.5 · requests 2.34.2 |
| Active transport | `at` (pyserial, text mode `AT+CMGF=1`) on **COM9**; `hilink` implemented as fallback |
| Hardware | HUAWEI `Model: E173`, firmware `21.157.48.00.864` |
| SIM state | `+CPIN: READY`, `+CSQ: 11` (weak), **`+CREG: 0,3`** (registration denied), `+CSCA: "",128` (no SMSC) |
| Real send | **Not yet possible** — blocked by SIM provisioning, not by code |
| Git | Repository not initialised; `.gitignore` is prepared |

## 2. Goal and scope

A small, typed HTTP service that turns `POST /send-sms` into a real SMS through a
Huawei E173z-1 USB stick, with:

1. **AT-command transport as the primary path** (`pyserial`, text mode), because it
   works with the plain "3G Modem" serial interface and needs no web-UI session.
2. **HiLink HTTP transport as fallback** for firmware that only exposes the modem
   web API (`http://192.168.8.1`).
3. Machine-readable RFC 9457-style errors, one message at a time on the modem,
   a hardware-free test suite, and a CLI for on-site diagnostics.

Out of scope for v0.1: multipart/concatenated SMS, inbound SMS, delivery reports,
PDU-mode encoding, persistent send queue.

## 3. Hardware identification

### 3.1 Serial ports reported by pyserial on this machine

| Port | Windows description | Result |
| --- | --- | --- |
| `COM7` | HUAWEI Mobile Connect - 3G Application Interface | `reachable: false` — `timed out waiting for the modem after 0 bytes` (not an AT port) |
| `COM8` | HUAWEI Mobile Connect - 3G PC UI Interface | `PermissionError(13, 'Access is denied')` — the connection manager owns it |
| `COM9` | HUAWEI Mobile Connect - 3G Modem #2 | **works** — this is the port the gateway uses |

`comports()` reports `hwid = "USB VID:PID=12D1:0000 SER=\"\""` (VID `12D1` = Huawei;
the driver does not expose a PID), which is why port selection is manual via `AT_PORT`.

### 3.2 Raw AT transcript (`COM9`, 115200 8N1)

```text
ATI        -> Manufacturer: huawei / Model: E173 / Revision: 21.157.48.00.864
AT+CPIN?   -> +CPIN: READY
AT+CREG?   -> +CREG: 0,3
AT+COPS?   -> +COPS: 0
AT+CSQ     -> +CSQ: 11    (RSSI; probe reports signal: 11)
AT+CSCA?   -> +CSCA: "",128
AT+CMGF=1  -> OK          (AT+CMGF? -> +CMGF: 1)   text mode supported
AT+CSCS="GSM"  -> OK      (AT+CSCS? -> "GSM")      GSM charset accepted
AT+CSCS="UCS2" -> OK      (AT+CSCS? -> "UCS2")     UCS-2 charset accepted
```

Re-verified on 2026-10-17 with `python -m scripts.probe_modem --port COM9`:
`{"port": "COM9", "reachable": true, "model": "E173", "sim": "READY",
"registered": false, "signal": 11, "smsc": ""}`.

### 3.3 Interpretation

- **`+CREG: 0,3` = registration denied.** `+COPS: 0` confirms no operator is
  selected. The modem answers every command, so the serial path is healthy; the
  subscription/SIM is not authorised on the network (inactive or unprovisioned SIM,
  or a blocked IMEI). `0,2` would mean "still searching".
- **`+CSCA: "",128` = no SMSC stored on the SIM.** Even with registration, a send
  would fail until `AT_SMSC` is configured (the transport writes it with
  `AT+CSCA` before `AT+CMGS`).
- **`+CSQ: 11` ≈ −91 dBm** — usable but weak; an antenna/USB-extension may help.
- The device accepts **text mode** and both charsets, so the primary transport
  design (no PDU encoder) is valid for this firmware.
- The modem was left in its default state afterwards (`AT+CMGF=0`, `AT+CSCS="GSM"`).

## 4. Project structure

```
New folder (2)/
├── app/
│   ├── __init__.py               3 lines   package marker
│   ├── config.py                56 lines   pydantic-settings Settings + get_settings()
│   ├── errors.py               109 lines   SmsError hierarchy → problem details
│   ├── schemas.py               82 lines   request/response/health models
│   ├── main.py                 137 lines   create_app(), lifespan, middleware, handlers
│   ├── api/
│   │   ├── __init__.py           1 line
│   │   └── routes.py            50 lines   POST /send-sms, GET /health, API-key dependency
│   ├── services/
│   │   ├── __init__.py           1 line
│   │   └── sms_service.py       66 lines   validation, transport calls, health readiness
│   └── transports/
│       ├── __init__.py           6 lines
│       ├── base.py              28 lines   SendResult + SmsTransport protocol
│       ├── factory.py           21 lines   TRANSPORT → implementation, misconfig guard
│       ├── at_modem.py         380 lines   pyserial AT transport (primary)
│       └── hilink.py           230 lines   HiLink HTTP transport (fallback)
├── scripts/probe_modem.py       87 lines   --list-ports / --port / --send CLI
├── tests/
│   ├── conftest.py             172 lines   FakeSerial, FakeTransport, FakeHiLinkSession, fixtures
│   ├── test_at_modem.py        268 lines   16 tests
│   ├── test_hilink.py          183 lines   11 tests
│   └── test_api.py             208 lines   21 tests
├── requirements.txt                       fastapi, uvicorn[standard], pydantic(-settings), pyserial, requests
├── requirements-dev.txt                   + pytest 8.x, httpx 0.28.x
├── pyproject.toml                         pytest config (testpaths, pythonpath, -q)
├── .env.example                           documented configuration template
├── .gitignore                             .venv, __pycache__, .env, *.log …
├── README.md                   220 lines   user documentation
└── PROGRESS.md                            this file
```

Design: layered — HTTP (`api/routes.py`) → service (`sms_service.py`) → transport
protocol (`transports/base.py`) → concrete transport (`at_modem.py` | `hilink.py`).
`main.create_app(settings, transport)` accepts overrides so tests can inject fakes.

## 5. Core files

### 5.1 `app/config.py`

`Settings(BaseSettings)` reads environment variables / `.env` (`extra="ignore"`),
plus `get_settings()` cached with `lru_cache`.

| Group | Fields (defaults) |
| --- | --- |
| Transport | `transport: Literal["at", "hilink"] = "at"` |
| AT | `at_port="COM3"`, `at_baud=115200` (≥1200), `at_command_timeout=5.0`, `at_send_timeout=30.0`, `at_retries=1` (0–3), `at_retry_delay=3.0`, `at_smsc=None` |
| HiLink | `hilink_base_url="http://192.168.8.1"` (validator strips trailing `/`), `hilink_username/password=None`, `hilink_timeout=15.0`, `hilink_content_type="text/xml"`, `hilink_content_base64=False` |
| API | `api_key=None`, `cors_origins="http://localhost:5173,http://localhost:3000"`, `send_lock_timeout=5.0`, `max_sms_length=160` (1–1000), `log_level="INFO"` |

`cors_origin_list` splits `cors_origins` on commas. Numeric fields use Pydantic
constraints (`Field(gt=0)`, `ge=…`) so bad configuration fails fast at startup.

### 5.2 `app/schemas.py`

- `SendSmsRequest` — `extra="forbid"`, trims whitespace; `to` is normalised by
  stripping spaces, `-`, `.`, `(` and `)` and must match
  `^\+[1-9]\d{6,14}$` (E.164); `message` must be non-blank and free of control
  characters (`\x00-\x08\x0b\x0c\x0e-\x1f\x7f`) because they could terminate AT input.
- `SendSmsResponse` — `request_id`, `status="sent"`, `to`, `transport`,
  `message_id` (`+CMGS` reference, `null` for HiLink), `sent_at` (UTC).
- `ModemStatus` — `reachable`, `port`, `base_url`, `model`, `sim`, `smsc`, `signal`,
  `registered`, `error`; a `model_serializer(mode="wrap")` drops `None` fields so
  `/health` only shows what the transport actually reported.
- `HealthResponse` — `status: Literal["ok", "degraded"]`, `transport`,
  `configured`, `modem: ModemStatus | None`.

### 5.3 `app/errors.py`

`SmsError` carries `status_code`, `code`, `title`, `detail`, optional `retry_after`
and `extra`, and renders `to_problem(request_id, instance)` →
`type`, `title`, `status`, `code`, `detail`, `instance`, `request_id` (+ extras).

| Class | HTTP | `code` |
| --- | --- | --- |
| `InvalidNumber` | 422 | `INVALID_NUMBER` |
| `MessageTooLong` | 422 | `MESSAGE_TOO_LONG` |
| `UnsupportedCharacter` | 422 | `UNSUPPORTED_CHARACTER` |
| `Unauthorized` | 401 | `UNAUTHORIZED` |
| `TransportMisconfigured` | 500 | `TRANSPORT_MISCONFIGURED` |
| `ModemUnavailable` | 503 | `MODEM_UNAVAILABLE` |
| `ModemBusy` | 503 | `MODEM_BUSY` |
| `ModemTimeout` | 504 | `MODEM_TIMEOUT` |
| `SendRejected` | 502 | `SEND_REJECTED` (+ `modem_code`, `retryable`) |

### 5.4 `app/main.py`

- `create_app(settings=None, transport=None)` — factory used by `uvicorn` and tests;
  module-level `app = create_app()`.
- `lifespan` sets `app.state.settings`, builds the transport via
  `build_transport(settings)` (unless one is injected), creates `SmsService`, logs
  readiness, and calls `transport.close()` on shutdown.
- CORS middleware from `cors_origin_list`; allowed headers `Content-Type`,
  `X-API-Key`, `X-Request-ID`; `X-Request-ID` exposed.
- Request-ID middleware: accepts a client value matching
  `^[A-Za-z0-9._-]{1,64}$`, otherwise generates `uuid4().hex`; echoes it on every
  response and stores it on `request.state`.
- Handlers: `SmsError` → problem JSON (+ `Retry-After` when set);
  `RequestValidationError` → `INVALID_REQUEST` with `errors[{field, message}]`;
  `Exception` → logged `INTERNAL_ERROR`. All include `instance` and `request_id`.

### 5.5 `app/api/routes.py`

- `require_api_key` — no-op when `API_KEY` is unset; otherwise compares the
  `X-API-Key` header with `secrets.compare_digest` and raises `Unauthorized` (401).
  Applied **only** to `/send-sms`, so `/health` stays usable by monitoring.
- `POST /send-sms` → `SmsService.send(payload, request_id=request.state.request_id)`.
- `GET /health?probe=<bool>` → `SmsService.health(probe=...)`.

### 5.6 `app/services/sms_service.py`

- `send()` enforces `MAX_SMS_LENGTH`, calls the transport, and timestamps the
  response with `datetime.now(timezone.utc)`.
- `health(probe=False)` — static `{"status": "ok", "configured": true}` with no
  hardware access.
- `health(probe=True)` — calls `transport.probe()` (guarded by `try/except` so a
  buggy probe cannot 500), then marks `degraded` when:
  1. `reachable` is false, **or**
  2. `sim` is present and not `READY`, **or**
  3. `registered` is `False`, **or**
  4. `smsc` is empty **and** no `AT_SMSC` override is configured.
  This is the readiness rule added after the live test on the unprovisioned SIM.

### 5.7 Transports

**`base.py`** — `SendResult(message_id, transport)` frozen dataclass and a
`runtime_checkable` `SmsTransport` protocol: `name`, `send()`, `probe()` (must never
raise), `close()`.

**`factory.py`** — `build_transport(settings)`:
`at` → `AtModemTransport` (requires non-empty `AT_PORT`), `hilink` →
`HiLinkTransport` (requires `HILINK_BASE_URL`), anything else →
`TransportMisconfigured`.

**`at_modem.py`** — 380 lines, pyserial, text mode:

- `_open()` / `_close_serial()`: lazy open with 1 s settle + `reset_input_buffer`;
  reopen after a failure, so a single hiccup does not kill the service.
- Byte-level reader `_read_until()` / `_read_response()` accepts `+CMGS:` text,
  `OK`, `ERROR`, `+CMS ERROR: n`, `+CME ERROR: n`; `_FINAL_RE` matches only at the
  end of the buffer; a monotonic deadline replaces per-byte timeouts.
- `_prepare()` picks the charset: message entirely inside `GSM7_SAFE_ASCII`
  (letters, digits, space, `!"#%&'()*+,-./:;<=>?`, CR, LF) → `AT+CSCS="GSM"` with
  the plain number; otherwise UCS-2 (number **and** text as UTF-16-BE hex,
  `AT+CSCS="UCS2"`). Non-BMP input → `UnsupportedCharacter` **before** the port is
  opened; UCS-2 text > 70 chars → `MessageTooLong`.
- `_send_locked()` per send: `AT` → `AT+CMGF=1` → optional `AT+CSCA="…"` (only when
  `AT_SMSC` is set) → `AT+CSCS="…"` → `AT+CMGS="…"` → prompt `> ` → payload + `0x1A`
  → final result `OK`; the `+CMGS: <n>` reference becomes `message_id`.
- Retry policy: CMS `500` and `515` are treated as transient
  (`_RETRYABLE_CMS`) and retried up to `AT_RETRIES` times with `AT_RETRY_DELAY` and
  a `_drain()` of stale bytes; other CMS codes → `SendRejected` with `modem_code`
  and a human-readable `_CMS_REASONS` entry. A prompt timeout is **not** retried
  (`ModemTimeout`) and the port is reset, because the delivery state is unknown.
- Serial failures are converted to `ModemUnavailable` / `ModemTimeout`; every
  failure path closes the port so the next request reconnects.
- `modem_busy` (lock not acquired within `SEND_LOCK_TIMEOUT`) → `ModemBusy`
  with `Retry-After: 2`.
- `probe()` never raises; it reports `port`, `reachable`, `model` (normalised from
  the `ATI` identity, e.g. `Model: E173` → `E173`), `sim` (`AT+CPIN?`),
  `registered` (`+CREG` last field ∈ {1, 5}), `signal` (`+CSQ` RSSI 0–31), `smsc`
  (`AT+CSCA?`, quotes stripped) and `error` on failure.

**`hilink.py`** — 230 lines, `requests.Session`:

- `GET /api/webserver/SesTokInfo` (XML) supplies `SesInfo` cookie + `TokInfo`.
- Login: `GET /api/user/state-login`; if logged out, `POST /api/user/login` with a
  Base64 password (`password_type` 0) or SHA-256 hex (`password_type` 1).
- Send: `POST /api/sms/send-sms` with an XML body
  (`<Index>-1</Index><Phones><Phone>…</Phone></Phones><Sca></Sca><Content>…</Content>
  <Length>…</Length><Reserved>1</Reserved><Date>…</Date>`), `Content` base64-encoded
  optionally via `HILINK_CONTENT_BASE64`; `_request()` injects the session cookie
  and `__RequestVerificationToken`.
- Token errors `113001`/`113002` trigger a single token refresh + retry; `ERROR` /
  provider codes → `SendRejected(modem_code=…)`; `requests.Timeout` →
  `ModemTimeout`; `ConnectionError` → `ModemUnavailable`.
- Same `send_lock_timeout` serialisation as AT; `probe()` reads
  `device/information`, `monitoring/status`, `sms/sms-count` without raising.

### 5.8 `scripts/probe_modem.py`

`python -m scripts.probe_modem` with `--list-ports`, `--port COMx`, `--baud`,
`--timeout`, optional `--send +E164 --message "…"`. It builds a `Settings` with
`_env_file=None` (so a stray `.env` cannot redirect the probe), prints the probe
JSON, returns exit code 1 when the modem is unreachable or an `SmsError` occurs,
and always closes the port.

## 6. HTTP API contract

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/send-sms` | `X-API-Key` (only if `API_KEY` is set) | Send one SMS |
| `GET` | `/health` | none | Liveness; `?probe=true` adds live modem status |
| `GET` | `/docs`, `/openapi.json` | none | OpenAPI UI / schema |

```http
POST /send-sms
Content-Type: application/json
X-Request-ID: corr-123          (optional, echoed when valid)
X-API-Key: <secret>             (only when API_KEY is configured)

{"to": "+1 (555) 123-4567", "message": "Hello from the E173z-1"}
```

```json
{
  "request_id": "corr-123",
  "status": "sent",
  "to": "+15551234567",
  "transport": "at",
  "message_id": "42",
  "sent_at": "2026-10-17T12:34:56.789Z"
}
```

Error responses are problem details and always carry `code`, `status`,
`instance` and (when available) `request_id`; `Retry-After` is set for 503s:

```json
{
  "type": "https://sms-gateway.local/errors/invalid-request",
  "title": "Request validation failed",
  "status": 422,
  "code": "INVALID_REQUEST",
  "detail": "The request body is not valid.",
  "errors": [{"field": "to", "message": "Value error, must be an E.164 number such as +15551234567"}],
  "instance": "/send-sms",
  "request_id": "6f1c0d0d6f1c4d6f9f1d2b3c4d5e6f70"
}
```

`GET /health` (no probe) → `{"status": "ok", "transport": "at", "configured": true}`.
`GET /health?probe=true` on the current SIM returns `"status": "degraded"` with
`modem: {"reachable": true, "port": "COM9", "model": "E173", "sim": "READY",
"registered": false, "signal": 11, "smsc": ""}`.

## 7. Test suite

Hardware-free: `tests/conftest.py` (172 lines) provides

- `FakeSerial` — scripted `serial.Serial` replacement (queued `(expected_write,
  response_bytes)` pairs, records `writes`, tracks `closed`, supports
  `in_waiting`/`read`/`write`/`flush`/`close`), injected through
  `AtModemTransport(settings, serial_factory=...)`.
- `FakeTransport` — records `(phone, text)`, can raise a configured `SmsError` or
  return a canned `probe()` dict; used for HTTP tests.
- `FakeHiLinkSession` / `FakeResponse` — minimal `requests.Session` with queued GET
  and POST responses and a real `RequestsCookieJar`, so token/login flows are tested
  without a modem.
- Fixtures `settings_factory` (`Settings(_env_file=None, …)` with overrides) and
  `api` (context manager yielding `(TestClient, FakeTransport)`, entering the
  lifespan so `app.state` is populated and shutdown runs).

| File | Tests | Coverage |
| --- | --- | --- |
| `tests/test_at_modem.py` | 16 | GSM send + `+CMGS` id, `AT_SMSC` programming, Cyrillic → UCS-2 hex, `$` → UCS-2 fallback, non-BMP rejection before opening the port, 71-char UCS-2 rejection, CMS 515 retry, CMS 500 → `SendRejected` with a single attempt when `AT_RETRIES=0`, error instead of `>` prompt, prompt timeout not retried + port reset, port reopened after close, busy lock, open failure → `ModemUnavailable`, `probe` device details, `Model: E173` normalisation, unusable port reported instead of raised |
| `tests/test_hilink.py` | 11 | XML send body, expired token refreshed once, rejected message keeps modem code, HTTP timeout → `ModemTimeout`, connection error → `ModemUnavailable`, Base64 login, SHA-256 login (`password_type=1`), base64 content mode, probe device info, unreachable probe, session closed on `close()` |
| `tests/test_api.py` | 21 (16 functions, parametrised) | success response + number normalisation, request-id echo/replacement, invalid number & unknown fields → problem details, `MAX_SMS_LENGTH` enforcement, transport-error → status/code mapping, `Retry-After` on busy, API key only for `/send-sms`, `/health` with/without probe, degraded when SIM/registration/SMSC unusable, ok when `AT_SMSC` is configured, degraded when unreachable, unhandled exception → 500 problem, transport closed on shutdown |

Commands and expected output:

```powershell
.\.venv\Scripts\python.exe -m pytest          # 48 passed, exit 0
python -m scripts.probe_modem --list-ports
python -m scripts.probe_modem --port COM9
```

Known benign warning: `StarletteDeprecationWarning: Using httpx with
starlette.testclient is deprecated; install httpx2 instead` (FastAPI 0.143.3 +
httpx 0.28.1). Tracked in §11, no functional impact.

## 8. Environment setup

- **Python 3.12.10** (64-bit) installed for the project; virtual environment at
  `.venv` (Windows layout: `.venv\Scripts\python.exe`).
- Bootstrap:

  ```powershell
  python -m venv .venv
  .\.venv\Scripts\Activate.ps1
  python -m pip install --upgrade pip
  pip install -r requirements-dev.txt     # includes requirements.txt
  ```

- Installed and verified with `pip list`:

  | Package | Installed | Declared range | Role |
  | --- | --- | --- | --- |
  | `fastapi` | 0.143.3 | `>=0.115,<1.0` | HTTP framework |
  | `starlette` | 1.8.0 | (via fastapi) | ASGI toolkit |
  | `uvicorn` | 0.54.0 | `>=0.30,<1.0` | ASGI server (`[standard]`) |
  | `pydantic` | 2.14.1 | `>=2.7,<3.0` | request/response models |
  | `pydantic-settings` | 2.16.0 | `>=2.3,<3.0` | `.env` / env configuration |
  | `pyserial` | 3.5 | `>=3.5,<4.0` | AT transport |
  | `requests` | 2.34.2 | `>=2.32,<3.0` | HiLink transport |
  | `pytest` | 8.4.2 | `>=8.2,<9.0` | tests (dev) |
  | `httpx` | 0.28.1 | `>=0.27,<1.0` | `TestClient` (dev) |

- `pyproject.toml` holds only pytest config: `testpaths=["tests"]`,
  `pythonpath=["."]`, `addopts="-q"`.
- Checks that were run: interpreter version, import of every `app.*` module,
  OpenAPI generation (`/health`, `/send-sms` present), full pytest run, live
  probe on COM9, and a live `/health?probe=true` through `TestClient`.

## 9. Problems encountered, fixes and current blockers

1. **Which COM port is the AT port.** `COM8` (3G PC UI Interface) exists but is
   locked by Huawei Mobile Partner → `PermissionError(13, 'Access is denied')`;
   `COM7` (3G Application Interface) never answers AT commands
   (`timed out … after 0 bytes`). **Fix:** probe all ports, settle on **COM9**
   ("3G Modem #2") and document that the modem application must be closed.
2. **SIM cannot register.** `AT+CREG?` → `+CREG: 0,3`, `AT+COPS?` → `+COPS: 0`,
   `AT+CPIN?` → `READY`. **Diagnosis:** operator denies registration; the code is
   fine. **Blocker (external):** replace/reactivate the SIM or subscription.
3. **No message centre.** `AT+CSCA?` → `+CSCA: "",128`. **Mitigation:** `AT_SMSC`
   makes the transport write `AT+CSCA="…"` before every send; `probe()` now reports
   `smsc` so the cause is visible instead of surfacing as a cryptic `+CMS ERROR`.
4. **Misleading model string.** `ATI` returns `Model: E173`; the probe exposed the
   whole line. **Fix:** `_model_from_identity()` extracts the model token
   (`E173`) and has a dedicated test.
5. **Health said "ok" for a modem that could not send.** `/health?probe=true`
   only reflected reachability. **Fix:** readiness rule in `SmsService.health()`
   (SIM not `READY`, `registered is False`, or empty SMSC without `AT_SMSC`) →
   `degraded`; `ModemStatus.smsc` added; API tests cover each rule.
6. **GSM 03.38 vs ASCII ambiguity.** Characters such as `@ $ _ { } [ ] ~ | \ ^`
   have different GSM codes than ASCII, so a firmware may mangle them.
   **Fix:** `GSM7_SAFE_ASCII` whitelist; anything else goes out as UCS-2 hex.
7. **`+CMS ERROR: 515` ("device busy") on a fresh modem.** **Fix:** `500` and `515`
   are marked retryable and retried up to `AT_RETRIES` with `AT_RETRY_DELAY`,
   draining stale bytes between attempts; the 515 path is unit-tested.
8. **Ambiguous state after a prompt timeout.** The message may or may not have
   been submitted. **Fix:** do **not** retry; raise `ModemTimeout` ("delivery state
   is unknown") and reset the port.
9. **Ports stay owned after failures.** **Fix:** every error path calls
   `_close_serial()`; `_open()` reconnects lazily, so one failure does not
   permanently break the service (tested by `test_port_is_reopened_after_close`).
10. **Lifespan-dependent state in tests.** `app.state.service` only exists after
    startup. **Fix:** the `api` fixture is a context manager that enters
    `TestClient` (running the lifespan) and yields `(client, fake_transport)`.
11. **Tooling constraints in this environment** (recorded so they are not
    rediscovered): a new foreground shell command kills the previous one, so long
    installs/tests were run from detached scripts under `%TEMP%`; `cmd /c` mangles
    quoted Windows paths, so native PowerShell is used; the file editor accepts
    ~6000 characters per call, so large files are written in chunks.
12. **Deprecation warning** from Starlette's `TestClient` about `httpx`
    (`install httpx2`). Benign; left unchanged so the supported `httpx` stack stays
    consistent with FastAPI.

## 10. Design decisions and rationale

| Decision | Why |
| --- | --- |
| **AT text mode (`AT+CMGF=1`)** instead of PDU mode | The live modem accepted text mode plus both `GSM`/`UCS2` charsets; no PDU encoder/decoder is needed and the payload stays human-readable in logs. Cost: single-segment only. |
| **`GSM7_SAFE_ASCII` whitelist** | Avoids firmware-specific interpretation of GSM 03.38 code points that differ from ASCII; those messages silently use UCS-2 (70 chars) instead of risking mis-encoded text. |
| **UCS-2 encodes the phone number too** | In text mode with `AT+CSCS="UCS2"` the E173 expects the `AT+CMGS` address as UTF-16-BE hex; verified by tests and the firmware charset behaviour. |
| **Domain exceptions → problem details** | Transports raise `SmsError` subclasses; a single handler maps them to HTTP, so transports know nothing about FastAPI. Matches RFC 9457 and keeps `modem_code` for diagnosis. |
| **Transport protocol + factory** | `SmsTransport` lets the API/service be transport-agnostic; `build_transport()` validates configuration and makes `TRANSPORT=at` / `TRANSPORT=hilink` a one-line switch. |
| **One send at a time** | A USB modem cannot interleave `AT+CMGS` sessions; a `threading.Lock` with `SEND_LOCK_TIMEOUT` serialises sends and answers 503 + `Retry-After: 2` when busy. `probe()` uses the same lock. |
| **Blocking I/O in sync endpoints** | Endpoints are plain `def`, so FastAPI runs them in the threadpool; the serial read never blocks the event loop. |
| **Retry only CMS `500`/`515`; never on prompt timeout** | `500`/`515` are known transient Huawei states; timeouts leave delivery state unknown, so retrying could duplicate an SMS. |
| **Health is unauthenticated; only `/send-sms` needs the key** | Monitoring/probes must reach `/health`; sending is the privileged action. |
| **`degraded` instead of `error`** | The service itself is up even when the modem cannot deliver; `status` distinguishes liveness from readiness without a 5xx. |
| **Request IDs everywhere** | `X-Request-ID` is accepted (validated), generated when absent, echoed on success and error responses, and included in every problem body. |
| **No secrets in code** | All configuration through environment/`.env`; `.env` is git-ignored and `.env.example` documents every option. |

## 11. Known limitations and next steps

**Limitations**

- **No real SMS has been delivered yet** — external SIM blocker (§9.2/§9.3). The
  send path is only proven against fakes.
- Single segment only: no concatenation, no PDU mode; `MAX_SMS_LENGTH=160` counts
  Unicode characters, and UCS-2 text is hard-limited to 70. The real GSM-7 limit is
  160 *septets* (153 for a segment), so 160 chars using GSM-only symbols could in
  theory exceed one segment — the safe subset keeps 160 single-segment safe.
- No delivery reports (`AT+CNMI`/`+CDS`), no inbound message handling, no modem
  storage cleanup (`AT+CMGD`).
- HiLink path is untested against real firmware (this unit exposes AT); the
  `password_type` handling is a heuristic based on observed HiLink behaviour.
- `/health?probe=true` performs several AT commands and takes the send lock, so it
  can briefly delay a concurrent send (worst case ≈ `AT_COMMAND_TIMEOUT` each).
- The gateway must run as a **single process**; multiple uvicorn workers would fight
  over the same COM port. Mobile Partner / HiLink UI must be closed.
- No git repository, CI, linter or type checker configured yet.

**Next steps (in order)**

1. Replace/reactivate the SIM so `AT+CREG?` reports `0,1` or `0,5`.
2. Set a message centre, either stored on the SIM or via `AT_SMSC=<number>`.
3. Free COM9 (close Huawei Mobile Partner), then run
   `python -m scripts.probe_modem --port COM9` and confirm
   `reachable=true`, `sim=READY`, `registered=true`, non-empty `smsc`.
4. Send a real message through `POST /send-sms` and confirm receipt on a handset;
   record the `+CMGS` reference from the response.
5. Create `.env` from `.env.example` with `AT_PORT=COM9`, `AT_SMSC=…`, `API_KEY=…`.
6. Optional hardening: `git init` + first commit, CI (pytest on push), `ruff`/`mypy`,
   delivery reports, multipart SMS, send queue, metrics, `httpx2` migration.

## 12. Runbook (this machine)

```powershell
cd "c:\Users\kadao\Desktop\New folder (2)"

# one-time: create configuration and set AT_PORT=COM9 (+ AT_SMSC, API_KEY)
Copy-Item .env.example .env

# hardware check (close Huawei Mobile Partner first)
.\.venv\Scripts\python.exe -m scripts.probe_modem --list-ports
.\.venv\Scripts\python.exe -m scripts.probe_modem --port COM9

# API
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

In a second terminal:

```powershell
curl.exe -s http://127.0.0.1:8000/health
curl.exe -s "http://127.0.0.1:8000/health?probe=true"
curl.exe -X POST http://127.0.0.1:8000/send-sms `
  -H "Content-Type: application/json" `
  -H "X-API-Key: <value-if-configured>" `
  -d '{"to": "+15551234567", "message": "Hello from the E173z-1"}'
```

```powershell
# regression suite (no hardware required)
.\.venv\Scripts\python.exe -m pytest
```

Live-send acceptance checklist (all must hold before declaring hardware validated):

- [ ] `AT+CPIN?` → `+CPIN: READY`
- [ ] `AT+CREG?` → `0,1` or `0,5` (currently `0,3`)
- [ ] `AT+CSQ` → RSSI > 10 (currently 11)
- [ ] `AT+CSCA?` returns a non-empty centre, or `AT_SMSC` is set (currently empty)
- [ ] `probe` reports `reachable=true`, `model=E173`, `registered=true`
- [ ] `POST /send-sms` → `200` with a `message_id`
- [ ] SMS arrives on a handset

## 13. Changelog

### 2026-10-17 · Phase 7 — persistent progress record *(current)*

- Added `PROGRESS.md`: status snapshot, hardware transcript, file-by-file notes,
  test inventory, environment versions, issues/fixes, decisions, runbook and this
  changelog.
- `README.md`: `PROGRESS.md` added to "Project layout" plus a "Project history"
  section pointing to it.
- Convention established (§14): after every major step or fix, update §1/§4/§5/
  §9/§11 and append a dated entry here.
- Validation: `pytest` → **48 passed, 1 warning in 0.67 s**; live probe re-run on
  COM9 → `model=E173`, `sim=READY`, `registered=false`, `signal=11`, `smsc=""`.

### 2026-10-17 · Phase 6 — live-hardware validation and readiness-aware health

- Added `_model_from_identity()` so `ATI`'s `Model: E173` becomes `E173`
  (`app/transports/at_modem.py`), with `test_probe_reads_the_model_from_huawei_identity`.
- `probe()` now issues `AT+CSCA?` and reports `smsc` (quotes stripped).
- `ModemStatus.smsc` added (`app/schemas.py`); `None` fields still omitted.
- `/health?probe=true` now returns `degraded` when SIM is not `READY`, registration
  is false, or there is no SMSC and no `AT_SMSC` (`app/services/sms_service.py`),
  including the case where `AT_SMSC` makes an empty SIM centre acceptable.
- Tests: **43 → 48 passed** (new readiness/model/SMSC cases; exit 0).
- README: troubleshooting for `PermissionError`, `+CREG: 0,3`, empty `+CSCA`, and
  the meaning of `degraded`.
- Validation: `pytest` 48 passed; `probe_modem --port COM9` exit 0;
  live `/health?probe=true` through `TestClient` → `degraded`, `smsc: ""`,
  `registered: false`.
- Hardware finding: the SIM is denied registration and has no SMSC, so end-to-end
  delivery remains blocked by the subscription, not by the code.
- Housekeeping: temporary diagnostics scripts and `*.log` files removed; modem left
  in its default `AT+CMGF=0` / `AT+CSCS="GSM"` state.

### 2026-10-17 · Phase 5 — HTTP API and documentation

- `app/api/routes.py` (`POST /send-sms`, `GET /health`, `X-API-Key` dependency),
  `app/main.py` (`create_app`, lifespan, CORS, request-ID middleware, three
  exception handlers), `app/services/sms_service.py` (length check, response
  assembly, health).
- RFC 9457-style problem responses, `Retry-After` on 503, `X-Request-ID` on every
  response, OpenAPI metadata, `SEND_LOCK_TIMEOUT` busy handling.
- `tests/test_api.py` (API + problem-detail coverage), `scripts/probe_modem.py`,
  `README.md`, `.env.example`, `.gitignore`.
- Validation: `pytest` → 43 passed; OpenAPI lists `/health` and `/send-sms`.

### 2026-10-17 · Phase 4 — HiLink HTTP transport

- `app/transports/hilink.py`: XML session/token acquisition, optional login
  (Base64 or SHA-256 `password_type=1`), `send-sms` XML payload with optional
  Base64 content, token-expiry retry (`113001`/`113002`), probe of device info /
  status / message counts, session close.
- `tests/test_hilink.py` with `FakeHiLinkSession` (11 tests).
- Validation: `pytest` green (16 AT + 11 HiLink tests at that point).

### 2026-10-17 · Phase 3 — AT transport

- `app/transports/base.py` (`SendResult`, `SmsTransport`), `factory.py`,
  `at_modem.py`: lifecycle/reconnect, byte-level response reader, text mode,
  GSM/UCS-2 selection, `AT_SMSC`, `+CMGS` id, CMS 500/515 retry, error mapping,
  probe with `ATI`/`CPIN`/`CREG`/`CSQ`, thread lock.
- `tests/conftest.py` (`FakeSerial`, `settings_factory`, `api` fixture) and
  `tests/test_at_modem.py` (16 tests).
- Validation: hardware-free suite green.

### 2026-10-17 · Phase 2 — Project scaffold

- FastAPI app skeleton with typed settings (`app/config.py`, pydantic-settings,
  cached `get_settings()`), Pydantic request/response/health models
  (`app/schemas.py`), domain error hierarchy with problem-detail rendering
  (`app/errors.py`).
- Packaging and tooling: `requirements.txt`, `requirements-dev.txt`,
  `pyproject.toml` (pytest config), `.env.example`, `.gitignore`.

### 2026-10-17 · Phase 1 — Hardware identification and environment

- Installed Python 3.12.10 and created `.venv`; installed FastAPI/uvicorn,
  pydantic(-settings), pyserial, requests, pytest and httpx (versions in §8).
- Enumerated serial ports, identified `HUAWEI Mobile Connect - 3G Modem #2` on
  **COM9** as the working AT interface; `COM7` is the application interface and
  `COM8` is held by Mobile Partner.
- Ran a raw AT reconnaissance on COM9 (`ATI`, `CPIN`, `CREG`, `COPS`, `CSQ`,
  `CSCA`, `CMGF`, `CSCS`) and recorded the results in §3.
- Conclusion: E173z-1 supports text mode and UCS-2 → AT/pyserial is the primary
  transport; SIM registration and SMSC remain external blockers.

## 14. How to keep this file current

After every major step, fix or hardware finding:

1. Update **§1** (status, test counts, active port/transport, blockers) and the
   `Last updated` date at the top.
2. Adjust **§4/§5** if files, responsibilities or configuration changed.
3. Move resolved items out of **§9/§11** and add new limitations/next steps.
4. Append a dated block to **§13** stating: what changed, why, files touched,
   validation command + result, and anything still unverified.
