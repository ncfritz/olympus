"""SSH certificates (ADR 0035): two kinds of online CA, each an Ed25519
key in the store that signs only its own kind of certificate.

OpenSSH certificates have no chain and no extensions beyond OpenSSH's
own; the service decides what one says, and the signer refuses what
breaks its invariants (invariants.check_ssh_*).
"""

import re
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum

from cryptography.hazmat.primitives.asymmetric import ec, ed25519, rsa
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat, ssh

from harpocrates_signer import invariants
from harpocrates_signer.errors import (
    BadRequestError,
    ConflictError,
    NotFoundError,
    RefusedError,
)
from harpocrates_signer.keys import KeyPurpose, Keys, PublicKey
from harpocrates_signer.store import SshCaRow, Store

SSH_CA_ID = re.compile(r"^[a-z][a-z0-9-]{0,62}$")

#: The longest any SSH CA may sign: a host certificate's year, and more.
MAX_VALIDITY_SECONDS = 400 * 24 * 3600


class SshCertificateKind(StrEnum):
    USER = "user"
    HOST = "host"


class SshExtension(StrEnum):
    """OpenSSH's extensions; each, when present, permits what it names."""

    PERMIT_PTY = "permit-pty"
    PERMIT_PORT_FORWARDING = "permit-port-forwarding"
    PERMIT_AGENT_FORWARDING = "permit-agent-forwarding"
    PERMIT_X11_FORWARDING = "permit-X11-forwarding"
    PERMIT_USER_RC = "permit-user-rc"


_TYPES = {
    SshCertificateKind.USER: ssh.SSHCertificateType.USER,
    SshCertificateKind.HOST: ssh.SSHCertificateType.HOST,
}

#: The subject keys OpenSSH accepts in a certificate.
type SshSubjectKey = (
    ed25519.Ed25519PublicKey | ec.EllipticCurvePublicKey | rsa.RSAPublicKey
)


@dataclass(frozen=True)
class SshCertificateRequest:
    """Everything an SSH certificate says, decided by the service."""

    kind: SshCertificateKind
    subject_key: SshSubjectKey
    serial: int
    key_id: str
    principals: tuple[str, ...]
    valid_after: datetime
    valid_before: datetime
    force_command: str | None = None
    source_addresses: tuple[str, ...] = ()
    extensions: frozenset[SshExtension] = field(default_factory=frozenset[SshExtension])


@dataclass(frozen=True)
class SshCaInfo:
    id: str
    key_id: str
    kind: SshCertificateKind
    max_validity_seconds: int
    public_key: ed25519.Ed25519PublicKey


def openssh_public_key(key: PublicKey) -> str:
    return key.public_bytes(  # type: ignore[union-attr]  # the SSH key types
        Encoding.OpenSSH, PublicFormat.OpenSSH
    ).decode("ascii")


def build_ssh_certificate(
    request: SshCertificateRequest, signing_key: ed25519.Ed25519PrivateKey
) -> ssh.SSHCertificate:
    builder = (
        ssh.SSHCertificateBuilder()
        .public_key(request.subject_key)
        .serial(request.serial)
        .type(_TYPES[request.kind])
        .key_id(request.key_id.encode("utf-8"))
        .valid_principals([p.encode("utf-8") for p in request.principals])
        .valid_after(int(request.valid_after.timestamp()))
        .valid_before(int(request.valid_before.timestamp()))
    )
    if request.force_command is not None:
        builder = builder.add_critical_option(
            b"force-command", request.force_command.encode("utf-8")
        )
    if request.source_addresses:
        builder = builder.add_critical_option(
            b"source-address", ",".join(request.source_addresses).encode("ascii")
        )
    for extension in sorted(request.extensions):
        builder = builder.add_extension(extension.value.encode("ascii"), b"")
    return builder.sign(signing_key)


class SshCas:
    """The SSH CAs: their keys, their kind, and what each may sign."""

    def __init__(self, store: Store, keys: Keys) -> None:
        self._store = store
        self._keys = keys

    def register(
        self,
        ca_id: str,
        key_id: str,
        kind: SshCertificateKind,
        max_validity_seconds: int,
    ) -> SshCaInfo:
        if not SSH_CA_ID.match(ca_id):
            raise BadRequestError("an SSH CA's id is a lower-case slug")
        if not 0 < max_validity_seconds <= MAX_VALIDITY_SECONDS:
            raise BadRequestError("an SSH CA signs for at most 400 days")
        key = self._keys.info(key_id)
        if key.purpose is not KeyPurpose.ISSUER or key.destroyed:
            raise RefusedError("issuer-key", "the key is not an issuer's key")
        if not isinstance(key.public_key, ed25519.Ed25519PublicKey):
            raise RefusedError("issuer-key", "an SSH CA's key is Ed25519")
        if self._store.ssh_ca(ca_id) is not None:
            raise ConflictError(f"SSH CA {ca_id} is already registered")
        if self._store.is_issuer_key(key_id):
            raise RefusedError("issuer-key", "the key already signs for another CA")
        self._store.insert_ssh_ca(
            SshCaRow(
                id=ca_id,
                key_id=key_id,
                kind=kind.value,
                max_validity_seconds=max_validity_seconds,
            )
        )
        return self.get(ca_id)

    def get(self, ca_id: str) -> SshCaInfo:
        row = self._store.ssh_ca(ca_id)
        if row is None:
            raise NotFoundError(f"no SSH CA {ca_id}")
        public_key = self._keys.info(row.key_id).public_key
        if not isinstance(public_key, ed25519.Ed25519PublicKey):
            raise TypeError("an SSH CA's key is Ed25519")
        return SshCaInfo(
            id=row.id,
            key_id=row.key_id,
            kind=SshCertificateKind(row.kind),
            max_validity_seconds=row.max_validity_seconds,
            public_key=public_key,
        )

    def sign(self, ca_id: str, request: SshCertificateRequest) -> ssh.SSHCertificate:
        ca = self.get(ca_id)
        invariants.check_ssh_kind(request.kind.value, ca.kind.value)
        invariants.check_ssh_validity(
            request.valid_after, request.valid_before, ca.max_validity_seconds
        )
        invariants.check_ssh_principals(request.principals)
        invariants.check_ssh_options(
            request.kind.value,
            request.force_command is not None or bool(request.source_addresses),
            bool(request.extensions),
        )
        invariants.check_ssh_serial(request.serial)
        invariants.check_ssh_subject_key(request.subject_key)
        if self._keys.purpose_of_public_key(request.subject_key) is KeyPurpose.ISSUER:
            raise RefusedError("subject-key", "the subject key is an issuer's key")
        signing_key = self._keys.private_key(ca.key_id)
        if not isinstance(signing_key, ed25519.Ed25519PrivateKey):
            raise TypeError("an SSH CA's key is Ed25519")
        return build_ssh_certificate(request, signing_key)
