#!/usr/bin/env bash
# Pulls Harpocrates's revocation lists for the NAS's nginx (ADR 0020,
# Distribution): fetches each CA's list from the distribution host,
# verifies it against that CA's certificate (pinned here, never fetched),
# checks it has not lapsed, concatenates them for `ssl_crl`, swaps the
# file and reloads nginx. Anything wrong: the previous file stays, nginx
# is not reloaded, and the script exits non-zero (DSM's Task Scheduler
# mails the output of a failed run).
#
# Settings, from the environment:
#   CRL_BASE_URL   the distribution host      (http://pki.internal.ncfritz.net)
#   CRL_ISSUERS    the CAs' slugs, the chain the NAS's clients come from
#                  (device-issuing-1-g1 intermediate-2-g1 root-1-g1)
#   CRL_TRUST_DIR  <slug>.crt (PEM) for each of them          (required)
#   CRL_OUT        the file nginx's ssl_crl names             (required)
#   CRL_RELOAD     how to reload nginx                        (nginx -s reload)
#
# Every run starts from scratch, so it can run as often as it likes; the
# lists are re-signed daily and valid for a week (see infra/nas/README.md).
set -euo pipefail

base_url="${CRL_BASE_URL:-http://pki.internal.ncfritz.net}"
issuers="${CRL_ISSUERS:-device-issuing-1-g1 intermediate-2-g1 root-1-g1}"
trust_dir="${CRL_TRUST_DIR:?CRL_TRUST_DIR names the directory of pinned CA certificates}"
out="${CRL_OUT:?CRL_OUT names the file nginx reads}"
reload="${CRL_RELOAD:-nginx -s reload}"

log() { echo "$(date -u '+%Y-%m-%dT%H:%M:%SZ') crl-pull: $*" >&2; }
fail() {
  log "FAILED: $*; keeping $out as it is"
  exit 1
}

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
now="$(date -u +%s)"

for slug in $issuers; do
  ca="$trust_dir/$slug.crt"
  [[ -f "$ca" ]] || fail "no pinned certificate for $slug ($ca)"
  der="$work/$slug.crl"
  curl --fail --silent --show-error --max-time 30 --max-redirs 0 \
    --output "$der" "$base_url/crl/$slug.crl" 2>"$work/curl" ||
    fail "fetching $slug's list: $(cat "$work/curl")"

  # The signature, against this CA only: a list signed by another CA of
  # the chain must not pass for this one's.
  if ! openssl crl -inform DER -in "$der" -CAfile "$ca" -noout -verify \
    >"$work/verify" 2>&1 || ! grep -q "verify OK" "$work/verify"; then
    fail "$slug's list does not verify against $ca: $(tr '\n' ' ' <"$work/verify")"
  fi

  next="$(openssl crl -inform DER -in "$der" -noout -nextupdate | sed 's/^nextUpdate=//')"
  if next_epoch="$(date -u -d "$next" +%s 2>/dev/null)"; then
    ((next_epoch > now)) || fail "$slug's list lapsed at $next"
  else
    log "cannot read the date '$next' here; not checking whether $slug's list has lapsed"
  fi

  openssl crl -inform DER -in "$der" -outform PEM >>"$work/crl.pem" ||
    fail "converting $slug's list"
  log "$slug: verified, next update $next"
done

if [[ -f "$out" ]] && cmp -s "$work/crl.pem" "$out"; then
  log "unchanged"
  exit 0
fi

mkdir -p "$(dirname "$out")"
[[ -f "$out" ]] && cp -p "$out" "$out.previous"
cp "$work/crl.pem" "$out.new"
chmod 644 "$out.new"
mv -f "$out.new" "$out"

if ! eval "$reload" >"$work/reload" 2>&1; then
  if [[ -f "$out.previous" ]]; then
    mv -f "$out.previous" "$out"
    eval "$reload" >/dev/null 2>&1 || true
  fi
  fail "reloading nginx ($reload): $(tr '\n' ' ' <"$work/reload")"
fi
log "installed $out and reloaded nginx"
