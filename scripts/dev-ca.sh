#!/usr/bin/env bash
# A throwaway certificate authority for development and tests, with the
# shape ADR 0018 describes: one root, an "Olympus Services Dev"
# intermediate for agents and an "Olympus Devices Dev" intermediate for
# people's devices, plus the certificates the sign-off cases need
# (valid, revoked, expired, signed by the wrong intermediate).
#
#   ./scripts/dev-ca.sh            # create what is missing
#   ./scripts/dev-ca.sh --force    # start again from nothing
#
# Everything lands in infra/dev-ca/, which is git-ignored. Nothing here is
# a secret: these keys are for localhost.
set -euo pipefail

# The server extensions read SAN from the environment; give it a value so
# the configuration parses even when they are not the section in use.
export SAN="DNS:localhost"

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ca="$root_dir/infra/dev-ca"
out="$ca/certs"
days=3650

[[ "${1:-}" == "--force" ]] && rm -rf "$ca"
if [[ -f "$out/api.crt" && "${1:-}" != "--force" ]]; then
  echo "infra/dev-ca already exists; --force to recreate"
  exit 0
fi

mkdir -p "$out/agents" "$out/devices"

# openssl ca needs a directory per authority: its key and certificate, the
# index it records issued certificates in, and the serial counters.
authority() {
  local name=$1
  mkdir -p "$ca/$name/newcerts"
  : >"$ca/$name/index.txt"
  echo 1000 >"$ca/$name/serial"
  echo 1000 >"$ca/$name/crlnumber"
  cat >"$ca/$name/openssl.cnf" <<CONF
[ ca ]
default_ca = CA_default

[ CA_default ]
dir               = $ca/$name
database          = \$dir/index.txt
new_certs_dir     = \$dir/newcerts
serial            = \$dir/serial
crlnumber         = \$dir/crlnumber
certificate       = \$dir/ca.crt
private_key       = \$dir/ca.key
default_md        = sha256
default_days      = $days
default_crl_days  = 3650
policy            = policy_any
email_in_dn       = no
rand_serial       = no
unique_subject    = no
copy_extensions   = copy

[ policy_any ]
commonName             = supplied
organizationName       = optional
organizationalUnitName = optional
countryName            = optional
stateOrProvinceName    = optional
localityName           = optional

[ req ]
distinguished_name = req_dn
prompt             = no

[ req_dn ]
CN = placeholder

[ v3_root ]
basicConstraints       = critical, CA:true, pathlen:1
keyUsage               = critical, digitalSignature, cRLSign, keyCertSign
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always

[ v3_intermediate ]
basicConstraints       = critical, CA:true, pathlen:0
keyUsage               = critical, digitalSignature, cRLSign, keyCertSign
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always

[ v3_server ]
basicConstraints       = critical, CA:false
keyUsage               = critical, digitalSignature, keyEncipherment
extendedKeyUsage       = serverAuth
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid,issuer
subjectAltName         = \$ENV::SAN

[ v3_client ]
basicConstraints       = critical, CA:false
keyUsage               = critical, digitalSignature
extendedKeyUsage       = clientAuth
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid,issuer
CONF
}

key() { openssl ecparam -name prime256v1 -genkey -noout -out "$1" 2>/dev/null; }

# csr <key> <csr> <subject>
csr() { openssl req -new -key "$1" -out "$2" -subj "$3" -config "$ca/root/openssl.cnf"; }

# issue <authority> <extensions> <csr> <certificate> [extra openssl ca flags...]
issue() {
  local authority=$1 ext=$2 request=$3 cert=$4
  shift 4
  openssl ca -batch -notext -config "$ca/$authority/openssl.cnf" \
    -extensions "$ext" -in "$request" -out "$cert" "$@" >/dev/null 2>&1
}

echo "root"
authority root
key "$ca/root/ca.key"
openssl req -new -x509 -days $days -key "$ca/root/ca.key" -out "$ca/root/ca.crt" \
  -subj "/CN=Olympus Dev Root/O=Olympus Dev" -config "$ca/root/openssl.cnf" \
  -extensions v3_root

for intermediate in services devices; do
  echo "$intermediate intermediate"
  authority "$intermediate"
  key "$ca/$intermediate/ca.key"
  name=$([[ $intermediate == services ]] && echo "Olympus Services Dev" || echo "Olympus Devices Dev")
  csr "$ca/$intermediate/ca.key" "$ca/$intermediate/ca.csr" "/CN=$name/O=Olympus Dev"
  issue root v3_intermediate "$ca/$intermediate/ca.csr" "$ca/$intermediate/ca.crt"
  # What a verifier trusts: the intermediate and the root.
  cat "$ca/$intermediate/ca.crt" "$ca/root/ca.crt" >"$out/$intermediate-ca.crt"
done

echo "API server certificate"
key "$out/api.key"
csr "$out/api.key" "$ca/api.csr" "/CN=olympus-api/O=Olympus Dev"
SAN="DNS:olympus-api,DNS:localhost,DNS:host.docker.internal,DNS:api.olympus.internal.localhost,IP:127.0.0.1" \
  issue services v3_server "$ca/api.csr" "$out/api.crt"

# client <authority> <directory> <name> <subject> [openssl ca flags...]
client() {
  local authority=$1 dir=$2 name=$3 subject=$4
  shift 4
  key "$out/$dir/$name.key"
  csr "$out/$dir/$name.key" "$ca/$name.csr" "$subject"
  issue "$authority" v3_client "$ca/$name.csr" "$out/$dir/$name.crt" "$@"
}

echo "agent certificates"
for agent in dionysus-asset-agent dionysus-metadata-agent dionysus-search-agent olympus-notification-agent; do
  client services agents "$agent" "/CN=$agent/OU=mac-mini/O=Olympus Dev"
done
client services agents dionysus-asset-agent-nas "/CN=dionysus-asset-agent/OU=nas/O=Olympus Dev"
client services agents svc-revoked "/CN=dionysus-search-agent/OU=test/O=Olympus Dev"
client services agents svc-expired "/CN=dionysus-search-agent/OU=test/O=Olympus Dev" \
  -startdate 20200101000000Z -enddate 20200201000000Z
# An agent's name, signed by the devices intermediate: the API must refuse it.
client devices agents svc-wrong-ca "/CN=dionysus-search-agent/OU=test/O=Olympus Dev"

echo "device certificates"
client devices devices dev-valid "/CN=dev-user/O=Olympus Dev"
client devices devices dev-revoked "/CN=dev-user/O=Olympus Dev"
client devices devices dev-expired "/CN=dev-user/O=Olympus Dev" \
  -startdate 20200101000000Z -enddate 20200201000000Z
# A device certificate signed by the services intermediate: the border must refuse it.
client services devices dev-wrong-ca "/CN=dev-user/O=Olympus Dev"

# For iOS and macOS, which install identities as PKCS#12. The password is
# "olympus"; these are throwaway keys.
for device in dev-valid dev-revoked dev-expired dev-wrong-ca; do
  openssl pkcs12 -export -out "$out/devices/$device.p12" \
    -inkey "$out/devices/$device.key" -in "$out/devices/$device.crt" \
    -certfile "$ca/devices/ca.crt" -passout pass:olympus 2>/dev/null
done

echo "revocations and lists"
openssl ca -batch -config "$ca/services/openssl.cnf" -revoke "$out/agents/svc-revoked.crt" >/dev/null 2>&1
openssl ca -batch -config "$ca/devices/openssl.cnf" -revoke "$out/devices/dev-revoked.crt" >/dev/null 2>&1
# A verifier checks every authority in the chain, so it needs the root's
# list as well as the intermediate's. Node takes them as separate files
# (it reads only the first list in a file); nginx takes one file holding
# both, so the bundles are written too.
openssl ca -batch -config "$ca/root/openssl.cnf" -gencrl -out "$out/root.crl" >/dev/null 2>&1
for intermediate in services devices; do
  openssl ca -batch -config "$ca/$intermediate/openssl.cnf" -gencrl \
    -out "$out/$intermediate.crl" >/dev/null 2>&1
  cat "$out/$intermediate.crl" "$out/root.crl" >"$out/$intermediate-chain.crl"
done

cat >"$out/README.txt" <<TXT
Throwaway certificates for development (scripts/dev-ca.sh). Not secret.

  services-ca.crt      what the API's 3443 listener trusts (TLS_CA_SERVICES)
  devices-ca.crt       what the border nginx trusts
  root.crl             the root's revocation list
  services.crl         the services intermediate's list; the API loads it
                       together with root.crl (TLS_CRL_SERVICES)
  devices.crl          the devices intermediate's list
  *-chain.crl          the same two lists in one file, for nginx (ssl_crl)
  api.crt / api.key    the API's server certificate
  agents/<name>.*      one per agent, plus svc-revoked, svc-expired, svc-wrong-ca
  devices/dev-*.*      device certificates and .p12 files (password: olympus)
TXT

echo
echo "done: infra/dev-ca/certs"
ls "$out" "$out/agents" "$out/devices"
