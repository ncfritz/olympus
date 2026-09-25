#!/usr/bin/env bash
# A throwaway certificate authority for development and tests, in the
# shape production has (ADR 0020, Hierarchy): a root, two intermediates
# that sign only CAs, and issuing CAs beneath them, plus the certificates
# the sign-off cases need (valid, revoked, expired, signed by the wrong
# issuing CA).
#
#   ncfritz.net Dev Root CA 1
#   ├── ncfritz.net Dev Intermediate CA 1
#   │   └── ncfritz.net Dev TLS Issuing CA 1 - G1      localhost only
#   └── ncfritz.net Dev Intermediate CA 2
#       ├── ncfritz.net Dev Service Issuing CA 1 - G1  services, the API's 3443
#       ├── ncfritz.net Dev Device Issuing CA 1 - G1   people's devices
#       └── ncfritz.net Dev Signing Issuing CA 1 - G1  code, mail, documents
#
#   ./scripts/dev-ca.sh            # create what is missing
#   ./scripts/dev-ca.sh --force    # start again from nothing
#
# Everything lands in infra/dev-ca/, which is git-ignored. Nothing here is
# a secret: these keys are for localhost. Every CA's key is also written
# as encrypted PKCS#8 (passphrase "olympus"), the format Harpocrates's
# signer imports.
set -euo pipefail

# The server extensions read SAN from the environment; give it a value so
# the configuration parses even when they are not the section in use.
export SAN="DNS:localhost"

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ca="$root_dir/infra/dev-ca"
out="$ca/certs"
days=3650
passphrase=olympus

# The file that marks the current shape: a dev CA from before the three
# tiers (no keys/) is replaced rather than kept.
current="$out/keys/root-1-g1.p8"
if [[ -f "$current" && "${1:-}" != "--force" ]]; then
  echo "infra/dev-ca already exists; --force to recreate"
  exit 0
fi
rm -rf "$ca"

mkdir -p "$out/agents" "$out/devices" "$out/keys" "$out/tls"

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

# Signs only CAs: offline in production.
[ v3_intermediate ]
basicConstraints       = critical, CA:true, pathlen:1
keyUsage               = critical, cRLSign, keyCertSign
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always

# The Service and Device CAs, as XCA made them: no usage restriction.
[ v3_issuing ]
basicConstraints       = critical, CA:true, pathlen:0
keyUsage               = critical, digitalSignature, cRLSign, keyCertSign
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always

# The TLS CA: servers only, and only names under localhost.
[ v3_issuing_tls ]
basicConstraints       = critical, CA:true, pathlen:0
keyUsage               = critical, digitalSignature, cRLSign, keyCertSign
extendedKeyUsage       = serverAuth
nameConstraints        = critical, permitted;DNS:localhost, permitted;DNS:internal.localhost, permitted;IP:127.0.0.0/255.0.0.0
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always

# The Signing CA: code, mail (RFC 9336's document signing by OID).
[ v3_issuing_signing ]
basicConstraints       = critical, CA:true, pathlen:0
keyUsage               = critical, digitalSignature, cRLSign, keyCertSign
extendedKeyUsage       = codeSigning, emailProtection, 1.3.6.1.5.5.7.3.36
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

# The CA's key as Harpocrates imports it: encrypted PKCS#8 (PBES2,
# AES-256), named by the CA's slug (ADR 0020, Naming). The PRF is left to
# the openssl in use: HMAC-SHA256 in OpenSSL 3, SHA-1 in macOS's LibreSSL;
# the signer reads both.
export_key() {
  local name=$1 slug=$2
  openssl pkcs8 -topk8 -v2 aes-256-cbc \
    -in "$ca/$name/ca.key" -out "$out/keys/$slug.p8" \
    -passout "pass:$passphrase"
}

echo "root"
authority root
key "$ca/root/ca.key"
openssl req -new -x509 -days $days -key "$ca/root/ca.key" -out "$ca/root/ca.crt" \
  -subj "/CN=ncfritz.net Dev Root CA 1/O=Olympus Dev" -config "$ca/root/openssl.cnf" \
  -extensions v3_root
export_key root root-1-g1

# sub <parent> <name> <extensions> <common name> <slug>
sub() {
  local parent=$1 name=$2 ext=$3 cn=$4 slug=$5
  authority "$name"
  key "$ca/$name/ca.key"
  csr "$ca/$name/ca.key" "$ca/$name/ca.csr" "/CN=$cn/O=Olympus Dev"
  issue "$parent" "$ext" "$ca/$name/ca.csr" "$ca/$name/ca.crt"
  export_key "$name" "$slug"
}

echo "intermediates"
sub root intermediate-1 v3_intermediate "ncfritz.net Dev Intermediate CA 1" intermediate-1-g1
sub root intermediate-2 v3_intermediate "ncfritz.net Dev Intermediate CA 2" intermediate-2-g1

echo "issuing CAs"
sub intermediate-2 services v3_issuing "ncfritz.net Dev Service Issuing CA 1 - G1" service-issuing-1-g1
sub intermediate-2 devices v3_issuing "ncfritz.net Dev Device Issuing CA 1 - G1" device-issuing-1-g1
sub intermediate-2 signing v3_issuing_signing "ncfritz.net Dev Signing Issuing CA 1 - G1" signing-issuing-1-g1
sub intermediate-1 tls v3_issuing_tls "ncfritz.net Dev TLS Issuing CA 1 - G1" tls-issuing-1-g1

# What a verifier trusts: the issuing CA, its intermediate and the root.
chain() { cat "$ca/$1/ca.crt" "$ca/$2/ca.crt" "$ca/root/ca.crt" >"$out/$3"; }
chain services intermediate-2 services-ca.crt
chain devices intermediate-2 devices-ca.crt
chain signing intermediate-2 signing-ca.crt
chain tls intermediate-1 tls-ca.crt
cp "$ca/root/ca.crt" "$out/root-ca.crt"

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
  client services agents "$agent" "/CN=$agent/OU=prod/O=Olympus Dev"
done
client services agents dionysus-asset-agent-nas "/CN=dionysus-asset-agent/OU=nas/O=Olympus Dev"
client services agents svc-revoked "/CN=dionysus-search-agent/OU=test/O=Olympus Dev"
client services agents svc-expired "/CN=dionysus-search-agent/OU=test/O=Olympus Dev" \
  -startdate 20200101000000Z -enddate 20200201000000Z
# An agent's name, signed by the Device CA: the API must refuse it.
client devices agents svc-wrong-ca "/CN=dionysus-search-agent/OU=test/O=Olympus Dev"

echo "device certificates"
client devices devices dev-valid "/CN=dev-user/O=Olympus Dev"
client devices devices dev-revoked "/CN=dev-user/O=Olympus Dev"
client devices devices dev-expired "/CN=dev-user/O=Olympus Dev" \
  -startdate 20200101000000Z -enddate 20200201000000Z
# A device certificate signed by the Service CA: the border must refuse it.
client services devices dev-wrong-ca "/CN=dev-user/O=Olympus Dev"

# For iOS and macOS, which install identities as PKCS#12. The password is
# "olympus"; these are throwaway keys.
for device in dev-valid dev-revoked dev-expired dev-wrong-ca; do
  openssl pkcs12 -export -out "$out/devices/$device.p12" \
    -inkey "$out/devices/$device.key" -in "$out/devices/$device.crt" \
    -certfile "$out/devices-ca.crt" -passout "pass:$passphrase" 2>/dev/null
done

echo "TLS CA: a name inside its constraints, and one outside"
key "$out/tls/localhost.key"
csr "$out/tls/localhost.key" "$ca/tls-localhost.csr" "/CN=localhost/O=Olympus Dev"
SAN="DNS:localhost,DNS:harpocrates.internal.localhost,IP:127.0.0.1" \
  issue tls v3_server "$ca/tls-localhost.csr" "$out/tls/localhost.crt"
# openssl ca signs it; a verifier refuses it (the name constraints).
key "$out/tls/out-of-bounds.key"
csr "$out/tls/out-of-bounds.key" "$ca/tls-out-of-bounds.csr" "/CN=example.com/O=Olympus Dev"
SAN="DNS:example.com" \
  issue tls v3_server "$ca/tls-out-of-bounds.csr" "$out/tls/out-of-bounds.crt"

echo "revocations and lists"
openssl ca -batch -config "$ca/services/openssl.cnf" -revoke "$out/agents/svc-revoked.crt" >/dev/null 2>&1
openssl ca -batch -config "$ca/devices/openssl.cnf" -revoke "$out/devices/dev-revoked.crt" >/dev/null 2>&1
# A verifier checks every authority in the chain, so it needs a list from
# each: the issuing CA's, its intermediate's and the root's. Node takes
# them as separate files (it reads only the first list in a file); nginx
# takes one file holding all three, so the bundles are written too.
for authority in root intermediate-1 intermediate-2 services devices signing tls; do
  openssl ca -batch -config "$ca/$authority/openssl.cnf" -gencrl \
    -out "$out/$authority.crl" >/dev/null 2>&1
done
cat "$out/services.crl" "$out/intermediate-2.crl" "$out/root.crl" >"$out/services-chain.crl"
cat "$out/devices.crl" "$out/intermediate-2.crl" "$out/root.crl" >"$out/devices-chain.crl"
cat "$out/tls.crl" "$out/intermediate-1.crl" "$out/root.crl" >"$out/tls-chain.crl"

cat >"$out/README.txt" <<TXT
Throwaway certificates for development (scripts/dev-ca.sh). Not secret.

  root-ca.crt          the root alone
  services-ca.crt      what the API's 3443 listener trusts (TLS_CA_SERVICES):
                       the Service CA, Intermediate CA 2 and the root
  devices-ca.crt       what the border nginx trusts
  tls-ca.crt           the TLS CA's chain (name-constrained to localhost)
  signing-ca.crt       the Signing CA's chain
  <ca>.crl             one list per CA: root, intermediate-1, intermediate-2,
                       services, devices, signing, tls. The API loads
                       services.crl, intermediate-2.crl and root.crl
                       (TLS_CRL_SERVICES)
  *-chain.crl          a chain's lists in one file, for nginx (ssl_crl)
  api.crt / api.key    the API's server certificate
  agents/<name>.*      one per agent, plus svc-revoked, svc-expired, svc-wrong-ca
  devices/dev-*.*      device certificates and .p12 files (password: olympus)
  tls/localhost.*      from the TLS CA, inside its constraints
  tls/out-of-bounds.*  from the TLS CA for example.com: a verifier refuses it
  keys/<slug>.p8       every CA's key as encrypted PKCS#8 (passphrase: olympus),
                       for Harpocrates's signer to import
TXT

echo "checking"
openssl verify -CAfile "$out/root-ca.crt" -untrusted "$out/services-ca.crt" "$out/api.crt" >/dev/null
openssl verify -CAfile "$out/root-ca.crt" -untrusted "$out/tls-ca.crt" "$out/tls/localhost.crt" >/dev/null
if openssl verify -CAfile "$out/root-ca.crt" -untrusted "$out/tls-ca.crt" \
  "$out/tls/out-of-bounds.crt" >/dev/null 2>&1; then
  echo "dev-ca.sh: the TLS CA's name constraints did not hold" >&2
  exit 1
fi

echo
echo "done: infra/dev-ca/certs"
ls "$out" "$out/agents" "$out/devices" "$out/keys" "$out/tls"
