"""Private keys: generated or imported, kept wrapped, never returned.

Only public keys leave the signer, apart from an escrowed subject key
exported on purpose (escrow.py). An issuer's key never leaves at all.
"""

import sqlite3
import uuid
from dataclasses import dataclass
from enum import StrEnum

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec, ed25519, rsa

from harpocrates_signer.errors import BadRequestError, ConflictError, NotFoundError
from harpocrates_signer.store import KeyRow, Store, now
from harpocrates_signer.vault import Vault

type PrivateKey = (
    ec.EllipticCurvePrivateKey | rsa.RSAPrivateKey | ed25519.Ed25519PrivateKey
)
type PublicKey = ec.EllipticCurvePublicKey | rsa.RSAPublicKey | ed25519.Ed25519PublicKey


class KeyPurpose(StrEnum):
    """An issuer's key signs; a subject's key is certified (and may be escrowed)."""

    ISSUER = "issuer"
    SUBJECT = "subject"


class KeyAlgorithm(StrEnum):
    """What the signer generates. P-256 everywhere (ADR 0018); RSA 2048 for
    devices that need it (the printer)."""

    P256 = "P-256"
    RSA2048 = "RSA-2048"


@dataclass(frozen=True)
class KeyInfo:
    id: str
    purpose: KeyPurpose
    algorithm: str
    public_key: PublicKey
    created_at: str
    destroyed: bool


def algorithm_of(key: PrivateKey | PublicKey) -> str:
    if isinstance(key, ec.EllipticCurvePrivateKey | ec.EllipticCurvePublicKey):
        names = {"secp256r1": "P-256", "secp384r1": "P-384"}
        name = names.get(key.curve.name)
        if name is None:
            raise BadRequestError(f"the curve {key.curve.name} is not supported")
        return name
    if isinstance(key, rsa.RSAPrivateKey | rsa.RSAPublicKey):
        if key.key_size < 2048:
            raise BadRequestError("RSA keys must be at least 2048 bits")
        return f"RSA-{key.key_size}"
    return "Ed25519"


def public_key_der(key: PublicKey) -> bytes:
    return key.public_bytes(
        serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo
    )


def generate_private_key(algorithm: KeyAlgorithm) -> PrivateKey:
    if algorithm is KeyAlgorithm.P256:
        return ec.generate_private_key(ec.SECP256R1())
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def load_encrypted_pkcs8(pem: str, passphrase: str) -> PrivateKey:
    """An encrypted PKCS#8 key, as XCA exports and the dev CA writes."""
    try:
        key = serialization.load_pem_private_key(
            pem.encode("ascii"), passphrase.encode("utf-8")
        )
    except (ValueError, TypeError) as error:
        raise BadRequestError(
            "the key is not encrypted PKCS#8, or the passphrase is wrong"
        ) from error
    if not isinstance(
        key, ec.EllipticCurvePrivateKey | rsa.RSAPrivateKey | ed25519.Ed25519PrivateKey
    ):
        raise BadRequestError("the key type is not supported")
    algorithm_of(key)
    return key


class Keys:
    def __init__(self, store: Store, vault: Vault) -> None:
        self._store = store
        self._vault = vault

    def generate(self, purpose: KeyPurpose, algorithm: KeyAlgorithm) -> KeyInfo:
        return self._keep(purpose, generate_private_key(algorithm))

    def import_key(self, purpose: KeyPurpose, pem: str, passphrase: str) -> KeyInfo:
        return self._keep(purpose, load_encrypted_pkcs8(pem, passphrase))

    def _keep(self, purpose: KeyPurpose, key: PrivateKey) -> KeyInfo:
        key_id = str(uuid.uuid4())
        der = key.private_bytes(
            serialization.Encoding.DER,
            serialization.PrivateFormat.PKCS8,
            serialization.NoEncryption(),
        )
        wrapped_data_key, wrapped_private_key = self._vault.wrap_private_key(
            key_id, der
        )
        row = KeyRow(
            id=key_id,
            purpose=purpose.value,
            algorithm=algorithm_of(key),
            public_key=public_key_der(key.public_key()),
            wrapped_data_key=wrapped_data_key,
            wrapped_private_key=wrapped_private_key,
            created_at=now(),
            destroyed_at=None,
        )
        try:
            self._store.insert_key(row)
        except sqlite3.IntegrityError as error:
            raise ConflictError("this key is already in the store") from error
        return _info(row)

    def info(self, key_id: str) -> KeyInfo:
        return _info(self._row(key_id))

    def private_key(self, key_id: str) -> PrivateKey:
        row = self._row(key_id)
        if row.wrapped_data_key is None or row.wrapped_private_key is None:
            raise NotFoundError(f"key {key_id} has been destroyed")
        der = self._vault.unwrap_private_key(
            key_id, row.wrapped_data_key, row.wrapped_private_key
        )
        key = serialization.load_der_private_key(der, password=None)
        if not isinstance(
            key,
            ec.EllipticCurvePrivateKey | rsa.RSAPrivateKey | ed25519.Ed25519PrivateKey,
        ):
            raise TypeError("the store holds a key of an unsupported type")
        return key

    def purpose_of_public_key(self, public_key: PublicKey) -> KeyPurpose | None:
        row = self._store.key_by_public_key(public_key_der(public_key))
        return None if row is None else KeyPurpose(row.purpose)

    def destroy(self, key_id: str) -> None:
        row = self._row(key_id)
        if row.purpose == KeyPurpose.ISSUER:
            raise ConflictError("an issuer's key is not destroyed through the API")
        self._store.destroy_key(key_id)

    def _row(self, key_id: str) -> KeyRow:
        row = self._store.key(key_id)
        if row is None:
            raise NotFoundError(f"no key {key_id}")
        return row


def _info(row: KeyRow) -> KeyInfo:
    public_key = serialization.load_der_public_key(row.public_key)
    if not isinstance(
        public_key,
        ec.EllipticCurvePublicKey | rsa.RSAPublicKey | ed25519.Ed25519PublicKey,
    ):
        raise TypeError("the store holds a key of an unsupported type")
    return KeyInfo(
        id=row.id,
        purpose=KeyPurpose(row.purpose),
        algorithm=row.algorithm,
        public_key=public_key,
        created_at=row.created_at,
        destroyed=row.destroyed_at is not None,
    )
