"""The signer's command line: `python -m harpocrates_signer <command>`.

serve                 the API on the configured Unix socket
health                exit 0 if the API answers on its socket (Docker's check)
openapi [dir]         write the API document to dir/signer.json

status                the seal, and any open ceremony
initialise            set the recovery passphrase; print the new unseal key
unseal                unseal with the recovery passphrase
seal                  seal, and stay sealed across restarts
rotate-unseal-key     print a new unseal key; the old one stops working
change-passphrase     change the recovery passphrase

The last six call the running signer over its socket with its token (the
break-glass path inside the container); passphrases are prompted for,
never taken as arguments.
"""

import argparse
import getpass
import json
import logging
import os
import sys
from pathlib import Path

from harpocrates_signer.config import Config, ConfigError, read_config, read_token
from harpocrates_signer.transport import call_over_socket, get_over_socket, serve

OPENAPI_FILE = "signer.json"

logger = logging.getLogger("harpocrates_signer")


def write_openapi(out_dir: Path) -> Path:
    """Write the API document, formatted as the Node services write theirs."""
    from harpocrates_signer.app import create_app

    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / OPENAPI_FILE
    document = json.dumps(create_app().openapi(), indent=2, ensure_ascii=False)
    target.write_text(document + "\n", encoding="utf-8")
    return target


def _prompt(label: str, confirm: bool = False) -> str:
    value = getpass.getpass(f"{label}: ")
    if confirm and getpass.getpass(f"{label} again: ") != value:
        raise SystemExit("the two entries differ")
    return value


def _call(
    config: Config,
    method: str,
    route: str,
    body: dict[str, object] | None = None,
) -> dict[str, object] | None:
    status, response = call_over_socket(
        config.socket_path, method, route, read_token(config.token_file), body
    )
    if status >= 400:
        message = (response or {}).get("message", f"HTTP {status}")
        raise SystemExit(f"refused: {message}")
    return response


def _print_unseal_key(response: dict[str, object] | None) -> None:
    key = (response or {}).get("unsealKey")
    print(
        "The unseal key, shown once. Store it as the "
        "harpocrates_signer_unseal_key secret and in the password manager:\n"
    )
    print(key)


def _admin(config: Config, command: str) -> int:
    if command == "status":
        print(json.dumps(_call(config, "GET", "/v1/status"), indent=2))
    elif command == "initialise":
        passphrase = _prompt("New recovery passphrase", confirm=True)
        _print_unseal_key(
            _call(config, "POST", "/v1/initialise", {"passphrase": passphrase})
        )
    elif command == "unseal":
        passphrase = _prompt("Recovery passphrase")
        _call(config, "POST", "/v1/unseal", {"passphrase": passphrase})
    elif command == "seal":
        _call(config, "POST", "/v1/seal")
    elif command == "rotate-unseal-key":
        _print_unseal_key(_call(config, "POST", "/v1/unseal-key/rotate"))
    elif command == "change-passphrase":
        current = _prompt("Current recovery passphrase")
        new = _prompt("New recovery passphrase", confirm=True)
        _call(config, "PUT", "/v1/passphrase", {"current": current, "new": new})
    return 0


ADMIN_COMMANDS = (
    "status",
    "initialise",
    "unseal",
    "seal",
    "rotate-unseal-key",
    "change-passphrase",
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m harpocrates_signer")
    commands = parser.add_subparsers(dest="command", required=True)
    serve_command = commands.add_parser("serve", help="serve the API")
    serve_command.add_argument(
        "--reload", action="store_true", help="restart on source changes (dev)"
    )
    commands.add_parser("health", help="check the API answers on its socket")
    openapi_command = commands.add_parser("openapi", help="write the API document")
    openapi_command.add_argument("dir", nargs="?", default="openapi", type=Path)
    for name in ADMIN_COMMANDS:
        commands.add_parser(name)
    args = parser.parse_args(argv)

    if args.command == "openapi":
        # A command-line script may print (docs/conventions/python.md).
        print(f"Wrote {write_openapi(args.dir)}")
        return 0

    try:
        config = read_config(os.environ)
    except ConfigError as error:
        print(error, file=sys.stderr)
        return 1
    logging.basicConfig(
        level=config.log_level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )

    if args.command == "health":
        try:
            return 0 if get_over_socket(config.socket_path, "/health") == 200 else 1
        except OSError as error:
            logger.error("No answer on %s: %s", config.socket_path, error)
            return 1

    if args.command in ADMIN_COMMANDS:
        try:
            return _admin(config, args.command)
        except (OSError, ConfigError) as error:
            print(error, file=sys.stderr)
            return 1

    serve(config, reload=args.reload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
