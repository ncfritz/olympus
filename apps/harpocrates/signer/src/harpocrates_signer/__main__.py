"""The signer's command line: `python -m harpocrates_signer <command>`.

serve             the API on the configured Unix socket
health            exit 0 if the API answers on its socket (Docker's check)
openapi [dir]     write the API document to dir/signer.json (default: openapi)

initialise, unseal, seal, status, rotate-unseal-key and change-passphrase
arrive with phase 1 (docs/plans/internal-ca).
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path

from harpocrates_signer.config import ConfigError, read_config
from harpocrates_signer.transport import get_over_socket, serve

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

    serve(config, reload=args.reload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
