#!/usr/bin/env bash
#
# Generates an ES256 access-token signing key (ADR 0018).
#
#   scripts/signing-keys.sh <directory> [name]
#
# AUTH_SIGNING_KEYS names the directory. Every key in it verifies; the last
# by filename signs, so names have to sort chronologically -- which is why
# the default name is today's date. Rotation is running this again and
# restarting the API: yesterday's key keeps verifying the tokens it signed,
# because a token names its key by `kid` rather than by filename.
#
# Nothing here is reversible: a key that is lost invalidates every token it
# signed, which means everyone signs in again. That is survivable, and a
# reason to keep the directory with the environment's other secrets.
set -euo pipefail

directory=${1:-}
if [ -z "$directory" ]; then
  echo "usage: $0 <directory> [name]" >&2
  echo "  e.g. $0 ~/olympus-secrets/auth-signing-keys" >&2
  exit 2
fi

# Today, in UTC, so a key generated either side of midnight local time still
# sorts the way its name reads.
name=${2:-$(date -u +%Y-%m-%d)}
file="$directory/$name.pem"

mkdir -p "$directory"
if [ -e "$file" ]; then
  # Overwriting would keep the filename and change the kid, which is the one
  # way to make tokens unverifiable without anything looking wrong.
  echo "$file already exists; not overwriting." >&2
  echo "Pass a different name to add a second key today." >&2
  exit 1
fi

# Before the key exists, not after: a private key should never be readable
# by anyone else, not even briefly.
umask 077
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out "$file"

echo "Wrote $file"
echo
echo "It signs once it is the last .pem by filename in $directory."
echo "The API logs which key it signs with, and its kid, at startup."
