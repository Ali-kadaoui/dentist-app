"""Command line diagnostics for a Huawei AT modem.

Examples:
    python -m scripts.probe_modem --list-ports
    python -m scripts.probe_modem --port COM3
    python -m scripts.probe_modem --port COM3 --send +15551234567 --message "test"
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

if __package__ in (None, ""):  # allow "python scripts/probe_modem.py"
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from serial.tools import list_ports

from app.config import Settings
from app.errors import SmsError
from app.transports.at_modem import AtModemTransport


def list_serial_ports() -> list[dict[str, Any]]:
    return [
        {"device": port.device, "description": port.description, "hwid": port.hwid}
        for port in list_ports.comports()
    ]


def build_transport(port: str, baud: int, timeout: float) -> AtModemTransport:
    settings = Settings(
        _env_file=None,
        transport="at",
        at_port=port,
        at_baud=baud,
        at_command_timeout=timeout,
    )
    return AtModemTransport(settings)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Probe a Huawei AT modem or send a test SMS.")
    parser.add_argument("--list-ports", action="store_true", help="list serial ports and exit")
    parser.add_argument("--port", help="serial port, for example COM3")
    parser.add_argument("--baud", type=int, default=115200, help="baud rate (default: 115200)")
    parser.add_argument("--timeout", type=float, default=5.0, help="command timeout in seconds")
    parser.add_argument("--send", metavar="NUMBER", help="send a test SMS to this E.164 number")
    parser.add_argument("--message", default="SMS gateway test", help="text used with --send")
    args = parser.parse_args(argv)

    if args.list_ports:
        print(json.dumps(list_serial_ports(), indent=2))
        return 0
    if not args.port:
        parser.error("--port is required unless --list-ports is used")

    transport = build_transport(args.port, args.baud, args.timeout)
    try:
        info = transport.probe()
        print(json.dumps(info, indent=2))
        if not info.get("reachable"):
            return 1
        if args.send:
            result = transport.send(args.send, args.message)
            print(
                json.dumps(
                    {"message_id": result.message_id, "transport": result.transport},
                    indent=2,
                )
            )
    except SmsError as exc:
        print(f"error: {exc}", file=sys.stderr)
        modem_code = getattr(exc, "modem_code", None)
        if modem_code:
            print(f"modem code: {modem_code}", file=sys.stderr)
        return 1
    finally:
        transport.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
