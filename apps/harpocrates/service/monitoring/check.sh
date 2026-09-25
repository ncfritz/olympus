#!/usr/bin/env bash
# The alert rules parse and their tests pass (check:conventions). Needs
# promtool, from Prometheus (`brew install prometheus`); without it the
# check says so and is skipped rather than failing a machine that has
# never needed Prometheus.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
if ! command -v promtool >/dev/null; then
  echo "promtool not found: the alert rules are not checked (brew install prometheus)" >&2
  exit 0
fi
promtool check rules harpocrates.rules.yml
promtool test rules harpocrates.rules.test.yml
