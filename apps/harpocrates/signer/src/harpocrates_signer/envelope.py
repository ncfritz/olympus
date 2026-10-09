"""Envelope encryption: every secret is AES-256-GCM under a key one level up.

    passphrase --Argon2id--> KEK --\\
                                    +--> master key --> data key --> private key
    unseal key (32 bytes) ---------/

Each wrap binds its context as associated data, so a ciphertext moved to
another row (another key's data key, say) fails to open rather than
opening as the wrong thing.
"""

import os
from dataclasses import dataclass

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.argon2 import Argon2id

KEY_BYTES = 32
NONCE_BYTES = 12
SALT_BYTES = 16


class UnwrapError(Exception):
    """The key was wrong, or the ciphertext or its context was altered."""


def random_key() -> bytes:
    return os.urandom(KEY_BYTES)


def wrap(key: bytes, plaintext: bytes, context: bytes) -> bytes:
    """Encrypt under `key`; the nonce leads the ciphertext."""
    nonce = os.urandom(NONCE_BYTES)
    return nonce + AESGCM(key).encrypt(nonce, plaintext, context)


def unwrap(key: bytes, wrapped: bytes, context: bytes) -> bytes:
    try:
        return AESGCM(key).decrypt(
            wrapped[:NONCE_BYTES], wrapped[NONCE_BYTES:], context
        )
    except (InvalidTag, ValueError) as error:
        raise UnwrapError from error


@dataclass(frozen=True)
class Argon2Parameters:
    """Stored with the store, so a later change of defaults still opens it."""

    salt: bytes
    iterations: int = 3
    lanes: int = 4
    memory_kib: int = 64 * 1024

    @staticmethod
    def new() -> "Argon2Parameters":
        return Argon2Parameters(salt=os.urandom(SALT_BYTES))


def passphrase_key(passphrase: str, parameters: Argon2Parameters) -> bytes:
    """The key-encryption key a passphrase stands for."""
    return Argon2id(
        salt=parameters.salt,
        length=KEY_BYTES,
        iterations=parameters.iterations,
        lanes=parameters.lanes,
        memory_cost=parameters.memory_kib,
    ).derive(passphrase.encode("utf-8"))
