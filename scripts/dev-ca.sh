#!/usr/bin/env bash
# A throwaway certificate authority for development and tests, in the shape of
# the real one (ADR 0020): a root, two intermediates, and an issuing CA per
# purpose, with the certificates the sign-off cases need (valid, revoked,
# expired, signed by the wrong issuer, outside a name constraint).
#
#   ./scripts/dev-ca.sh            # create what is missing
#   ./scripts/dev-ca.sh --force    # start again from nothing
#   ./scripts/dev-ca.sh --san IP:192.168.1.10
#                                  # more names for the API's certificate: a
#                                  # phone reaches this machine by address, and
#                                  # a name the certificate does not carry fails
#                                  # validation however well the CA is trusted.
#                                  # Applies when api.crt is issued: delete it
#                                  # first to reissue it with the new names
#
# Without --force an existing CA is kept and only what is missing is made:
# a certificate added to this script (a new agent, say), or one deleted to
# have it reissued. The authorities, and so everything already trusted, stay
# as they are. --force makes a new root, which every device and keychain
# that trusts the old one has to be given again.
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
# Server certificates only, and not decoration: Apple refuses a TLS server
# certificate issued after 1 July 2019 whose validity exceeds 825 days, and it
# refuses it whatever anchor it chains to -- a private CA the device has been
# given is no exemption. The trust evaluation simply fails, which URLSession
# reports as the *client* cancelling, so nothing anywhere says "too long".
# Authorities are not subject to it and keep the ten years.
server_days=825
pass=olympus

force=
extra_san=
while [[ $# -gt 0 ]]; do
  case "$1" in
  --force) force=yes ;;
  --san)
    [[ -n "${2:-}" ]] || {
      echo "--san needs a value, e.g. --san IP:192.168.1.10" >&2
      exit 2
    }
    extra_san="$extra_san,$2"
    shift
    ;;
  *)
    echo "unknown argument: $1" >&2
    exit 2
    ;;
  esac
  shift
done

[[ -n "$force" ]] && rm -rf "$ca"

# What this run made, for the summary; empty when everything was there.
made=

mkdir -p "$out/agents" "$out/devices" "$out/tls" "$out/keys"

# openssl ca needs a directory per authority: its key and certificate, the
# index it records issued certificates in, and the serial counters.
authority() {
  local name=$1
  if [[ -f "$ca/$name/ca.crt" ]]; then
    # Kept as it is; only its configuration's path follows the checkout,
    # which openssl ca reads its index and serials from.
    sed "s#^dir .*#dir               = $ca/$name#" "$ca/$name/openssl.cnf" \
      >"$ca/$name/openssl.cnf.tmp" && mv "$ca/$name/openssl.cnf.tmp" "$ca/$name/openssl.cnf"
    return
  fi
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
  if [[ -f "$ca/$id/ca.crt" ]]; then
    authority "$id"
    return
  fi
  authority "$id"
  made="$made $id"
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
  [[ -f "$out/keys/$2.p8" ]] && return
  openssl pkcs8 -topk8 -v2 aes-256-cbc -in "$ca/$1/ca.key" \
    -out "$out/keys/$2.p8" -passout "pass:$pass" 2>/dev/null
}

echo "root"
if [[ -f "$ca/root/ca.crt" ]]; then
  authority root
else
  authority root
  key "$ca/root/ca.key"
  openssl req -new -x509 -days $days -key "$ca/root/ca.key" -out "$ca/root/ca.crt" \
    -subj "/CN=ncfritz.net Dev Root CA 1/O=Olympus Dev" \
    -config "$ca/root/openssl.cnf" -extensions v3_root
  made="$made root"
fi
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

# client <authority> <directory> <name> <subject> [openssl ca flags...]
# Kept when its certificate exists; delete the .crt to have it reissued.
client() {
  local authority=$1 dir=$2 name=$3 subject=$4
  shift 4
  [[ -f "$out/$dir/$name.crt" ]] && return
  key "$out/$dir/$name.key"
  csr "$out/$dir/$name.key" "$ca/$name.csr" "$subject"
  issue "$authority" v3_client "$ca/$name.csr" "$out/$dir/$name.crt" "$@"
  made="$made $dir/$name"
}

# server <authority> <directory> <name> <subject> <san>
# Kept when its certificate exists, as client is. <directory> may be "."
server() {
  local authority=$1 dir=$2 name=$3 subject=$4 san=$5
  [[ -f "$out/$dir/$name.crt" ]] && return
  key "$out/$dir/$name.key"
  csr "$out/$dir/$name.key" "$ca/$name.csr" "$subject"
  SAN="$san" issue "$authority" v3_server "$ca/$name.csr" \
    "$out/$dir/$name.crt" -days "$server_days"
  if [[ "$dir" == . ]]; then made="$made $name"; else made="$made $dir/$name"; fi
}

# p12 <issuing id> <directory> <name>: the identity as PKCS#12, once.
p12() {
  [[ -f "$out/$2/$3.p12" ]] && return
  openssl pkcs12 -export -macalg sha256 -out "$out/$2/$3.p12" \
    -inkey "$out/$2/$3.key" -in "$out/$2/$3.crt" \
    -certfile "$ca/$1/ca.crt" -passout "pass:$pass" 2>/dev/null
}

# revoke <authority> <certificate>, unless the authority's index already
# records it revoked.
revoke() {
  local serial
  serial=$(openssl x509 -noout -serial -in "$2")
  serial=${serial#serial=}
  grep -q "^R.*[[:space:]]$serial[[:space:]]" "$ca/$1/index.txt" && return
  openssl ca -batch -config "$ca/$1/openssl.cnf" -revoke "$2" >/dev/null 2>&1
}

echo "API server certificate"
server services . api "/CN=olympus-api/O=Olympus Dev" \
  "DNS:olympus-api,DNS:localhost,DNS:host.docker.internal,DNS:api.olympus.internal.localhost,IP:127.0.0.1$extra_san"

echo "calendar sync agent server certificate"
# Its services listener, which only the API calls (ADR 0028), presents a
# certificate from the service issuer, as the API's does.
server services . minerva-calendar-sync "/CN=minerva-calendar-sync-agent/O=Olympus Dev" \
  "DNS:minerva-calendar-agent,DNS:localhost,IP:127.0.0.1$extra_san"

echo "mail classifier server certificate"
# Its services listener, which only the mail agent calls (ADR 0030), as
# the calendar agent's is the API's alone.
server services . minerva-mail-ml "/CN=minerva-mail-ml/O=Olympus Dev" \
  "DNS:minerva-mail-ml,DNS:localhost,IP:127.0.0.1$extra_san"

echo "mail agent server certificate"
# Its services listener, which only the API calls to link mailboxes to
# Gmail (ADR 0030, as ADR 0028 for the calendar agent).
server services . minerva-mail-agent "/CN=minerva-mail-agent/O=Olympus Dev" \
  "DNS:minerva-mail-agent,DNS:localhost,IP:127.0.0.1$extra_san"

echo "agent certificates"
# OU is the deployment, not the machine (ADR 0022).
for agent in dionysus-asset-agent dionysus-metadata-agent dionysus-search-agent \
  minerva-mail-agent minerva-mail-ml olympus-notification-agent olympus-weather-relay-agent; do
  client services agents "$agent" "/CN=$agent/OU=prod/O=Olympus Dev"
done
# The API calls the calendar sync agent's services listener (ADR 0028).
client services agents olympus-api "/CN=olympus-api/OU=prod/O=Olympus Dev"
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
  p12 devices devices "$device"
done

# The service identities as PKCS#12 as well: an app importing one is how the
# mobile tester proves it can present a client certificate at all, and pairing
# it with a device identity against the same listener is how it proves the
# listener tells them apart (ADR 0023).
for agent in dionysus-asset-agent dionysus-metadata-agent dionysus-search-agent \
  minerva-mail-agent minerva-mail-ml olympus-notification-agent olympus-weather-relay-agent \
  dionysus-asset-agent-nas \
  svc-revoked svc-expired \
  svc-wrong-ca; do
  p12 services agents "$agent"
done

echo "TLS certificates"
server tls tls localhost "/CN=localhost/O=Olympus Dev" \
  "DNS:localhost,DNS:harpocrates.internal.localhost,IP:127.0.0.1"
# Outside the issuer's name constraints. openssl ca signs it anyway -- name
# constraints are the verifier's business -- which is exactly the case a
# relying party has to refuse.
server tls tls out-of-bounds "/CN=example.com/O=Olympus Dev" "DNS:example.com"

echo "revocations and lists"
revoke services "$out/agents/svc-revoked.crt"
revoke devices "$out/devices/dev-revoked.crt"

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

Running the script again makes only what is missing: delete a certificate
to have it reissued from the same authorities. --force starts again from a
new root, which everything that trusts this one has to be given again.

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
  minerva-calendar-sync.crt / .key
                       the calendar sync agent's server certificate, for
                       its services listener; agents/olympus-api.* is the
                       API's client certificate for calling it
  minerva-mail-agent.crt / .key
                       the mail agent's server certificate, for its
                       services listener; agents/olympus-api.* is the
                       API's client certificate for calling it
  minerva-mail-ml.crt / .key
                       the mail classifier's server certificate, for its
                       services listener; agents/minerva-mail-agent.* is
                       the mail agent's client certificate for calling it
  api.crt / api.key    the API's server certificate, valid 825 days because
                       Apple refuses a longer one whatever anchor it chains to.
                       From the service issuer --
                       so services-ca.crt is what a client validating the
                       listener trusts, as well as what the listener trusts.
                       --san adds names to it; a phone reaching this machine by
                       address needs its address in there
  agents/<name>.*      one per agent, plus dionysus-asset-agent-nas (the same
                       name, another deployment), svc-revoked, svc-expired
                       and svc-wrong-ca (from the device issuer). The .p12 of
                       each is for an app or a phone importing an identity;
                       the password is "olympus"
  devices/dev-*.*      device certificates and .p12 files, including
                       dev-wrong-ca (from the service issuer)
  tls/localhost.*      a server certificate from the TLS issuer, and
                       out-of-bounds.* for a name its constraints forbid
TXT

echo
if [[ -n "$made" ]]; then
  echo "made:$made"
else
  echo "nothing missing"
fi
echo "done: infra/dev-ca/certs"
