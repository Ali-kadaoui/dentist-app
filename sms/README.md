# Huawei SMS Gateway

Small, typed HTTP service that sends SMS through a **Huawei E173z-1** USB modem.
The primary transport drives the modem with AT commands over **pyserial**; a
HiLink (`requests`) transport is included for firmware that only exposes the web
API.

## Features

- `POST /send-sms` with a validated E.164 number and Pydantic request/response models.
- AT transport: text mode (`AT+CMGF=1`), GSM-7-safe text or UCS-2 fallback,
  `+CMS ERROR: 515` ("message queue full") retried, byte-level RX reassembly,
  automatic reconnect after a closed or failed port.
- HiLink transport: session token handling, firmware password login
  (plain or SHA-256 `password_type=1`), token-expiry retry.
- `GET /health` (optional `?probe=true`) reporting SIM, registration and signal.
- Consistent RFC 9457-style problem responses with `X-Request-ID` correlation.
- Optional `X-API-Key` protection, serialized sends (one modem, one message at a time).
- Diagnostics CLI and a hardware-free test suite.

## Requirements

- Python 3.10+ (3.12 recommended), Windows, Linux or macOS.
- Huawei E173z-1 (or a similar AT-command Huawei modem) with a SIM that can send SMS.
- On Windows: the Huawei drivers installed, so the modem appears as a COM port.

## Install

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt          # runtime
pip install -r requirements-dev.txt      # runtime + pytest/httpx
```

## Find the right serial port

The E173z-1 exposes several ports. Use the **modem / PC UI** port, usually
described as `HUAWEI Mobile Connect - 3G Modem` or `HUAWEI Mobile Connect - PC UI
Interface`; do not use the microSD reader port.

```powershell
python -m scripts.probe_modem --list-ports
```

Typical Huawei layout: `COM3` = PC UI (AT), `COM4` = 3G Modem, `COM5` = application,
one extra port = microSD. If AT commands do not answer on one port, try the other
modem interface. Close Huawei Mobile Partner / the HiLink web UI while the gateway
is running - only one process can own the port.

> The E173z-1 must be in **serial/AT mode**. Some units expose a HiLink-only
> interface (web UI on `http://192.168.8.1`) and no AT port at all; in that case set
> `TRANSPORT=hilink`. Huawei's AT^SETPORT command can re-expose the PC UI port, but
> it is firmware-specific and not automated here.

## Configure

```powershell
Copy-Item .env.example .env
notepad .env
```

Minimum configuration:

```dotenv
TRANSPORT=at
AT_PORT=COM3
```

Everything else has defaults. See `.env.example` for all options (timeouts,
retries, SMSC override, HiLink credentials, API key, CORS origins, SMS length).

## Run

```powershell
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Interactive docs: <http://127.0.0.1:8000/docs>

### Send an SMS

```powershell
curl.exe -X POST http://127.0.0.1:8000/send-sms `
  -H "Content-Type: application/json" `
  -d '{"to": "+15551234567", "message": "Hello from the E173z-1"}'
```

```json
{
  "status": "sent",
  "request_id": "6f1c0d0d6f1c4d6f9f1d2b3c4d5e6f70",
  "to": "+15551234567",
  "transport": "at",
  "message_id": "42",
  "sent_at": "2026-10-17T12:34:56.789Z"
}
```

`message_id` is the modem's `+CMGS` reference (useful for delivery reports) and is
`null` for HiLink. `sent_at` is UTC. If `API_KEY` is configured, add
`-H "X-API-Key: <value>"`.

### Health

```powershell
curl.exe "http://127.0.0.1:8000/health?probe=true"
```

```json
{
  "status": "ok",
  "transport": "at",
  "configured": true,
  "modem": {
    "reachable": true,
    "port": "COM3",
    "model": "E173z-1",
    "sim": "READY",
    "smsc": "+447785016005",
    "registered": true,
    "signal": 18
  }
}
```

`status` is `degraded` when the modem cannot be opened, does not answer, or
answers but cannot send right now (SIM not `READY`, not registered, or no message
centre and no `AT_SMSC`). The endpoint still returns HTTP 200 so it can be used
for monitoring.

### Errors

All failures use one shape:

```json
{
  "type": "https://sms-gateway.local/errors/modem-timeout",
  "title": "Modem did not respond in time",
  "status": 504,
  "code": "MODEM_TIMEOUT",
  "detail": "the modem did not respond to AT+CMGS within 30s",
  "instance": "/send-sms",
  "request_id": "..."
}
```

| Code | HTTP | Meaning |
| --- | --- | --- |
| `INVALID_REQUEST` | 422 | Body failed validation (number, message, unknown field). |
| `MESSAGE_TOO_LONG` | 422 | Over `MAX_SMS_LENGTH`, or over 70 chars when UCS-2 is required. |
| `UNSUPPORTED_CHARACTER` | 422 | Emoji / non-BMP character. |
| `UNAUTHORIZED` | 401 | Missing or wrong `X-API-Key`. |
| `SEND_REJECTED` | 502 | Modem rejected the message (`+CMS ERROR` in `modem_code`). |
| `MODEM_BUSY` | 503 | Another send is in progress; see `Retry-After`. |
| `MODEM_UNAVAILABLE` | 503 | Port cannot be opened, SIM missing, HiLink unreachable. |
| `MODEM_TIMEOUT` | 504 | Silent modem; the port is reset and the message is **not** retried. |
| `INTERNAL_ERROR` | 500 | Unexpected failure. |

## Troubleshooting

- `PermissionError(13, 'Access is denied')` on the COM port: another program owns
  it. Close Huawei Mobile Partner, the HiLink web UI, putty or a previous gateway
  instance.
- `"registered": false` in the probe: the SIM is not attached to a network.
  `AT+CREG?` returns `0,3` when the operator denies registration (inactive or
  unprovisioned SIM, blocked IMEI) and `0,2` while the modem is still searching.
  Check the SIM in a phone and the antenna; `AT+CSQ` below ~10 is a weak signal.
- `"smsc": ""` means the SIM has no message centre stored (`AT+CSCA?` is empty),
  so sends are rejected. Set `AT_SMSC` to your operator's SMSC
  (e.g. `AT_SMSC=+447785016005`) and it is written with `AT+CSCA` before sending.
- `+CMS ERROR: 515` during a send is retried automatically (`AT_RETRIES`); other
  `+CMS ERROR` codes are returned as `SEND_REJECTED` with the code in
  `modem_code`.
- Character set problems: text that is not plain printable ASCII is sent as
  UCS-2, which limits a single message to 70 characters.

## Diagnostics

```powershell
python -m scripts.probe_modem --port COM3
python -m scripts.probe_modem --port COM3 --send +15551234567 --message "test"
```

The script prints model, SIM state, message centre, registration and signal as
JSON and exits non-zero when the modem is unreachable.

## Tests

```powershell
pytest
```

The suite mocks the serial port and the HTTP session, so it needs no modem and no
network. It covers command sequencing, GSM/UCS-2 switching, retries, timeouts,
busy handling, error mapping, auth, health probes and HiLink login flows.

## Project layout

```
app/
  api/routes.py          HTTP endpoints
  services/sms_service.py validation + orchestration
  transports/at_modem.py pyserial AT transport (primary)
  transports/hilink.py   HiLink HTTP transport
  transports/base.py     transport protocol / result type
  config.py, schemas.py, errors.py, main.py
scripts/probe_modem.py   CLI diagnostics
tests/                   hardware-free test suite
PROGRESS.md              project history, findings and current state
```

## Limitations

- Single-segment messages only: 160 chars for GSM-safe ASCII text, 70 for UCS-2.
  Long-message concatenation and delivery reports are not implemented yet.
- Sends are serialized per process; run a single worker (`uvicorn` default).
- `AT+CMGF=1` and `AT+CSCS` support is assumed (true for the E173z-1).
- The HiLink transport returns no `message_id`, so delivery tracking is AT-only.

## Project history

`PROGRESS.md` keeps the persistent record: hardware identification and AT
transcripts, file-by-file implementation notes, test inventory, environment
versions, problems and fixes, current blockers and a dated changelog. It is
updated after every major step.

