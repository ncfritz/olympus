#!/usr/bin/env bash
# A throwaway certificate authority for development and tests, in the shape of
# the real one (ADR 0020): a root, two intermediates, and an issuing CA per
# purpose, with the certificates the sign-off cases need (valid, revoked,
# expired, signed by the wrong issuer, outside a name constraint).
#
#   ./scripts/dev-ca.sh            # create what is missing
#   ./scripts/dev-ca.sh --force    # start again from nothing
#
#   Dev Root CA 1                     pathlen:2
#   |- Dev Intermediate CA 1          pathlen:1
#   |  `- Dev TLS Issuing CA 1 - G1   name-constrained to localhost
#   `- Dev Intermediate CA 2          pathlen:1
#      |- Dev Service Issuing CA 1 - G1   the API and the agents
#      |- Dev Device Issuing CA 1 - G1    people's devices
#      `- Dev Signing Issuing CA 1 - G1   code and document signing
#
# The shape is the point, not decoration: it is three authorities deep, so a
# relying party needs a revocation list from each of them (see certs/README.txt
# and TLS_CRL_SERVICES), and a two-deep fixture would let that mistake pass.
#
# Everything lands in infra/dev-ca/, which is git-ignored. Nothing here is a
# secret: these keys are for localhost, and the passphrase is "olympus".
set -euo pipefail

# The server extensions read SAN from the environment; give it a value so the
# configuration parses even when they are not the section in use.
export SAN="DNS:localhost"

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ca="$root_dir/infra/dev-ca"
out="$ca/certs"
days=3650
pass=olympus

[[ "${1:-}" == "--force" ]] && rm -rf "$ca"
if [[ -f "$out/api.crt" && "${1:-}" != "--force" ]]; then
  echo "infra/dev-ca already exists; --force to recreate"
  exit 0
fi

mkdir -p "$out/agents" "$out/devices" "$out/tls" "$out/keys"

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
basicConstraints       = critical, CA:true, pathlen:2
keyUsage               = critical, digitalSignature, cRLSign, keyCertSign
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always

[ v3_intermediate ]
basicConstraints       = critical, CA:true, pathlen:1
keyUsage               = critical, digitalSignature, cRLSign, keyCertSign
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always

[ v3_issuing ]
basicConstraints       = critical, CA:true, pathlen:0
keyUsage               = critical, digitalSignature, cRLSign, keyCertSign
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always

# The signing issuer signs code, mail and documents and nothing else: an
# issuer's extended key usages bound what it can issue for (the last OID is
# id-kp-documentSigning, which OpenSSL has no name for).
[ v3_issuing_signing ]
basicConstraints       = critical, CA:true, pathlen:0
keyUsage               = critical, digitalSignature, cRLSign, keyCertSign
extendedKeyUsage       = codeSigning, emailProtection, 1.3.6.1.5.5.7.3.36
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always

# The TLS issuer is constrained to the names this environment serves, so a
# certificate for anything else is refused by the verifier rather than by
# whoever notices. certs/tls/out-of-bounds.crt is the case that proves it.
[ v3_issuing_tls ]
basicConstraints       = critical, CA:true, pathlen:0
keyUsage               = critical, digitalSignature, cRLSign, keyCertSign
extendedKeyUsage       = serverAuth
nameConstraints        = critical, permitted;DNS:localhost, permitted;DNS:internal.localhost, permitted;IP:127.0.0.0/255.0.0.0
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

# subordinate <parent> <id> <extensions> <common name>
subordinate() {
  local parent=$1 id=$2 ext=$3 cn=$4
  authority "$id"
  key "$ca/$id/ca.key"
  csr "$ca/$id/ca.key" "$ca/$id/ca.csr" "/CN=$cn/O=Olympus Dev"
  issue "$parent" "$ext" "$ca/$id/ca.csr" "$ca/$id/ca.crt"
}

# bundle <name> <issuing id> <intermediate id>: what a relying party trusts,
# and the lists that cover it. Both are the whole chain, because a verifier
# checks every authority in it.
bundle() {
  local name=$1 issuing=$2 intermediate=$3
  cat "$ca/$issuing/ca.crt" "$ca/$intermediate/ca.crt" "$ca/root/ca.crt" \
    >"$out/$name-ca.crt"
}

# escrow <id> <file>: the authority's key as encrypted PKCS#8, which is what
# the signer imports (internal-CA plan, phase 1).
escrow() {
  openssl pkcs8 -topk8 -v2 aes-256-cbc -in "$ca/$1/ca.key" \
    -out "$out/keys/$2.p8" -passout "pass:$pass" 2>/dev/null
}

echo "root"
authority root
key "$ca/root/ca.key"
openssl req -new -x509 -days $days -key "$ca/root/ca.key" -out "$ca/root/ca.crt" \
  -subj "/CN=ncfritz.net Dev Root CA 1/O=Olympus Dev" \
  -config "$ca/root/openssl.cnf" -extensions v3_root
cp "$ca/root/ca.crt" "$out/root-ca.crt"

echo "intermediates"
subordinate root int-1 v3_intermediate "ncfritz.net Dev Intermediate CA 1"
subordinate root int-2 v3_intermediate "ncfritz.net Dev Intermediate CA 2"

echo "issuing authorities"
subordinate int-2 services v3_issuing "ncfritz.net Dev Service Issuing CA 1 - G1"
subordinate int-2 devices v3_issuing "ncfritz.net Dev Device Issuing CA 1 - G1"
subordinate int-2 signing v3_issuing_signing "ncfritz.net Dev Signing Issuing CA 1 - G1"
subordinate int-1 tls v3_issuing_tls "ncfritz.net Dev TLS Issuing CA 1 - G1"

bundle services services int-2
bundle devices devices int-2
bundle signing signing int-2
bundle tls tls int-1

for pair in "root:root-1-g1" "int-1:intermediate-1-g1" "int-2:intermediate-2-g1" \
  "services:service-issuing-1-g1" "devices:device-issuing-1-g1" \
  "signing:signing-issuing-1-g1" "tls:tls-issuing-1-g1"; do
  escrow "${pair%%:*}" "${pair##*:}"
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

# server <authority> <directory> <name> <subject> <san>
server() {
  local authority=$1 dir=$2 name=$3 subject=$4 san=$5
  key "$out/$dir/$name.key"
  csr "$out/$dir/$name.key" "$ca/$name.csr" "$subject"
  SAN="$san" issue "$authority" v3_server "$ca/$name.csr" "$out/$dir/$name.crt"
}

echo "agent certificates"
# OU is the deployment, not the machine (ADR 0022).
for agent in dionysus-asset-agent dionysus-metadata-agent dionysus-search-agent olympus-notification-agent; do
  client services agents "$agent" "/CN=$agent/OU=prod/O=Olympus Dev"
done
client services agents dionysus-asset-agent-nas "/CN=dionysus-asset-agent/OU=nas/O=Olympus Dev"
client services agents svc-revoked "/CN=dionysus-search-agent/OU=test/O=Olympus Dev"
client services agents svc-expired "/CN=dionysus-search-agent/OU=test/O=Olympus Dev" \
  -startdate 20200101000000Z -enddate 20200201000000Z
# An agent's name from the device issuer: the API must refuse it (ADR 0023).
client devices agents svc-wrong-ca "/CN=dionysus-search-agent/OU=test/O=Olympus Dev"

echo "device certificates"
client devices devices dev-valid "/CN=dev-user/O=Olympus Dev"
client devices devices dev-revoked "/CN=dev-user/O=Olympus Dev"
client devices devices dev-expired "/CN=dev-user/O=Olympus Dev" \
  -startdate 20200101000000Z -enddate 20200201000000Z
# A device from the service issuer: the border must refuse it.
client services devices dev-wrong-ca "/CN=dev-user/O=Olympus Dev"

# For iOS and macOS, which install identities as PKCS#12. The password is
# "olympus"; these are throwaway keys.
for device in dev-valid dev-revoked dev-expired dev-wrong-ca; do
  openssl pkcs12 -export -macalg sha256 -out "$out/devices/$device.p12" \
    -inkey "$out/devices/$device.key" -in "$out/devices/$device.crt" \
    -certfile "$ca/devices/ca.crt" -passout "pass:$pass" 2>/dev/null
done

echo "TLS certificates"
server tls tls localhost "/CN=localhost/O=Olympus Dev" \
  "DNS:localhost,DNS:harpocrates.internal.localhost,IP:127.0.0.1"
# Outside the issuer's name constraints. openssl ca signs it anyway -- name
# constraints are the verifier's business -- which is exactly the case a
# relying party has to refuse.
server tls tls out-of-bounds "/CN=example.com/O=Olympus Dev" "DNS:example.com"

echo "revocations and lists"
openssl ca -batch -config "$ca/services/openssl.cnf" -revoke "$out/agents/svc-revoked.crt" >/dev/null 2>&1
openssl ca -batch -config "$ca/devices/openssl.cnf" -revoke "$out/devices/dev-revoked.crt" >/dev/null 2>&1

# One list per authority, as separate files: a chain is checked against a list
# from every authority in it, and Node reads only the first list in a file
# (TLS_CRL_SERVICES is therefore a list of paths). The *-chain.crl bundles are
# for nginx, which takes one file.
crl() { openssl ca -batch -config "$ca/$1/openssl.cnf" -gencrl -out "$out/$2" >/dev/null 2>&1; }
crl root root.crl
crl int-1 intermediate-1.crl
crl int-2 intermediate-2.crl
crl services services.crl
crl devices devices.crl
crl signing signing.crl
crl tls tls.crl
cat "$out/services.crl" "$out/intermediate-2.crl" "$out/root.crl" >"$out/services-chain.crl"
cat "$out/devices.crl" "$out/intermediate-2.crl" "$out/root.crl" >"$out/devices-chain.crl"
cat "$out/tls.crl" "$out/intermediate-1.crl" "$out/root.crl" >"$out/tls-chain.crl"

cat >"$out/README.txt" <<TXT
Throwaway certificates for development (scripts/dev-ca.sh). Not secret; the
passphrase for the .p12 and .p8 files is "olympus".

The chain is three authorities deep, like the real one:

  Dev Root CA 1
  |- Dev Intermediate CA 1 -> Dev TLS Issuing CA 1 - G1
  \`- Dev Intermediate CA 2 -> Dev Service / Device / Signing Issuing CA 1 - G1

  <purpose>-ca.crt     what a relying party trusts: the issuing CA, its
                       intermediate and the root (services-ca.crt is
                       TLS_CA_SERVICES)
  <authority>.crl      one list per authority. A chain is checked against a
                       list from every authority in it, so the API needs
                       services.crl, intermediate-2.crl and root.crl
                       (TLS_CRL_SERVICES); two of the three refuses every
                       client certificate, during the handshake, silently
  *-chain.crl          the same lists in one file, for nginx (ssl_crl). Not
                       for Node, which reads only the first list in a file
  keys/<authority>.p8  the authority's key as encrypted PKCS#8, the format
                       the signer imports
  api.crt / api.key    the API's server certificate
  agents/<name>.*      one per agent, plus dionysus-asset-agent-nas (the same
                       name, another deployment), svc-revoked, svc-expired
                       and svc-wrong-ca (from the device issuer)
  devices/dev-*.*      device certificates and .p12 files, including
                       dev-wrong-ca (from the service issuer)
  tls/localhost.*      a server certificate from the TLS issuer, and
                       out-of-bounds.* for a name its constraints forbid
TXT

echo
echo "done: infra/dev-ca/certs"
