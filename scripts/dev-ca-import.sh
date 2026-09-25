#!/usr/bin/env bash
# Adopts the dev CA (scripts/dev-ca.sh) into the development Harpocrates,
# as the cutover adopts XCA's (docs/guides/harpocrates-cutover.md): the
# root and the intermediates as offline CAs (certificates only), the
# issuing CAs with their keys into the signer, every certificate they
# issued, and each CA's last list, so the numbering continues and the dev
# CA's revocations (svc-revoked, dev-revoked) stay revoked. A rehearsal of
# the production cutover, on throwaway keys. From then
# on the service signs the issuing CAs' lists and publishes them where the
# API's TLS_CRL_SERVICES can read them (apps/api/dev.env.example).
#
#   ./scripts/dev-ca-import.sh
#
# Needs the dev CA, and the signer, harpocrates-postgres and the migrations
# (apps/harpocrates/README.md, Development). Run it once, on an empty
# database: an issuer that exists already is refused.
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ca="$root_dir/infra/dev-ca"
certs="$ca/certs"
[[ -f "$certs/keys/root-1-g1.p8" ]] || {
  echo "no dev CA: run scripts/dev-ca.sh first" >&2
  exit 1
}

cli() { pnpm --silent --filter @ncfritz/harpocrates-service cli "$@"; }

# The dev CA's keys are for localhost; their passphrase is no secret.
passphrase="$(mktemp)"
trap 'rm -f "$passphrase"' EXIT
echo olympus >"$passphrase"

SERVER_AUTH=1.3.6.1.5.5.7.3.1
CLIENT_AUTH=1.3.6.1.5.5.7.3.2
CODE_SIGNING=1.3.6.1.5.5.7.3.3
EMAIL=1.3.6.1.5.5.7.3.4
DOCUMENT_SIGNING=1.3.6.1.5.5.7.3.36

echo "offline CAs"
cli import-issuer --id root-1-g1 --tier root --number 1 --generation 1 \
  --certificate "$ca/root/ca.crt"
for n in 1 2; do
  cli import-issuer --id "intermediate-$n-g1" --tier intermediate \
    --number "$n" --generation 1 \
    --certificate "$ca/intermediate-$n/ca.crt" --chain "$ca/root/ca.crt"
done

# issuing <dir> <slug> <purpose> <intermediate> <eku>...
issuing() {
  local dir=$1 slug=$2 purpose=$3 intermediate=$4
  shift 4
  local ekus=()
  for eku in "$@"; do ekus+=(--eku "$eku"); done
  cli import-issuer --id "$slug" --tier issuing --purpose "$purpose" \
    --number 1 --generation 1 --max-validity-days 825 \
    --certificate "$ca/$dir/ca.crt" \
    --chain "$ca/$intermediate/ca.crt" --chain "$ca/root/ca.crt" \
    "${ekus[@]}" \
    --key "$certs/keys/$slug.p8" --passphrase-file "$passphrase"
}

echo "issuing CAs"
issuing services service-issuing-1-g1 Service intermediate-2 "$CLIENT_AUTH" "$SERVER_AUTH"
issuing devices device-issuing-1-g1 Device intermediate-2 "$CLIENT_AUTH"
issuing signing signing-issuing-1-g1 Signing intermediate-2 \
  "$CODE_SIGNING" "$EMAIL" "$DOCUMENT_SIGNING"
issuing tls tls-issuing-1-g1 TLS intermediate-1 "$SERVER_AUTH"

# certificates <profile> <file>...
certificates() {
  local profile=$1
  shift
  local files=()
  for file in "$@"; do files+=(--file "$file"); done
  cli import-certificates --profile "$profile" "${files[@]}"
}

echo "certificates"
certificates service "$certs"/agents/*.crt
certificates api-server "$certs/api.crt"
certificates device "$certs"/devices/*.crt
certificates internal-tls "$certs"/tls/*.crt

echo "lists"
cli import-crl --issuer root-1-g1 --crl "$certs/root.crl"
cli import-crl --issuer intermediate-1-g1 --crl "$certs/intermediate-1.crl"
cli import-crl --issuer intermediate-2-g1 --crl "$certs/intermediate-2.crl"
cli import-crl --issuer service-issuing-1-g1 --crl "$certs/services.crl"
cli import-crl --issuer device-issuing-1-g1 --crl "$certs/devices.crl"
cli import-crl --issuer signing-issuing-1-g1 --crl "$certs/signing.crl"
cli import-crl --issuer tls-issuing-1-g1 --crl "$certs/tls.crl"

echo "signing and publishing"
cli crls
