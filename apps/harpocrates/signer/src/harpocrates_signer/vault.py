"""The seal (ADR 0020, Key protection).

The master key is wrapped twice in the store: by the unseal key, a file
secret only the signer mounts, and by a key derived from the recovery
passphrase. At start the signer opens it with the unseal key, so an
unattended restart needs nobody. A deliberate `seal` is recorded in the
store and survives restarts; only the passphrase undoes it.
"""

import base64
import binascii
import logging
import threading
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path

from harpocrates_signer import envelope
from harpocrates_signer.errors import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    SealedError,
)
from harpocrates_signer.store import Store

logger = logging.getLogger(__name__)

MIN_PASSPHRASE_LENGTH = 12

MASTER_BY_UNSEAL_KEY = "master_by_unseal_key"
MASTER_BY_PASSPHRASE = "master_by_passphrase"
ARGON2_SALT = "argon2_salt"
ARGON2_ITERATIONS = "argon2_iterations"
ARGON2_LANES = "argon2_lanes"
ARGON2_MEMORY_KIB = "argon2_memory_kib"
DELIBERATELY_SEALED = "deliberately_sealed"

UNSEAL_KEY_CONTEXT = b"harpocrates-signer/master/unseal-key"
PASSPHRASE_CONTEXT = b"harpocrates-signer/master/passphrase"


class SealReason(StrEnum):
    """Why the signer is sealed; what the service shows and alerts on."""

    UNINITIALISED = "uninitialised"
    DELIBERATE = "deliberate"
    NO_UNSEAL_KEY = "no-unseal-key"
    WRONG_UNSEAL_KEY = "wrong-unseal-key"


@dataclass(frozen=True)
class VaultStatus:
    initialised: bool
    sealed: bool
    reason: SealReason | None


def encode_unseal_key(key: bytes) -> str:
    return base64.b64encode(key).decode("ascii")


def decode_unseal_key(text: str) -> bytes:
    try:
        key = base64.b64decode(text.strip(), validate=True)
    except (binascii.Error, ValueError) as error:
        raise BadRequestError("the unseal key is not base64") from error
    if len(key) != envelope.KEY_BYTES:
        raise BadRequestError("the unseal key is not 32 bytes")
    return key


def _int(value: int) -> bytes:
    return str(value).encode("ascii")


class Vault:
    def __init__(self, store: Store, unseal_key_file: Path | None) -> None:
        self._store = store
        self._unseal_key_file = unseal_key_file
        self._lock = threading.RLock()
        self._master: bytes | None = None
        self._reason: SealReason | None = SealReason.UNINITIALISED

    # ---- state

    def status(self) -> VaultStatus:
        with self._lock:
            return VaultStatus(
                initialised=not self._store.is_empty(),
                sealed=self._master is None,
                reason=self._reason,
            )

    def master_key(self) -> bytes:
        with self._lock:
            if self._master is None:
                raise SealedError(f"the signer is sealed ({self._reason})")
            return self._master

    def start(self) -> VaultStatus:
        """Unseal with the unseal key, unless there is a reason not to."""
        with self._lock:
            if self._store.is_empty():
                self._reason = SealReason.UNINITIALISED
            elif self._store.setting(DELIBERATELY_SEALED) is not None:
                self._reason = SealReason.DELIBERATE
            else:
                self._open_with_unseal_key()
            status = self.status()
        if status.sealed:
            logger.warning("Starting sealed: %s", status.reason)
        else:
            logger.info("Unsealed with the unseal key")
        return status

    def _open_with_unseal_key(self) -> None:
        path = self._unseal_key_file
        if path is None or not path.is_file():
            self._reason = SealReason.NO_UNSEAL_KEY
            return
        wrapped = self._store.setting(MASTER_BY_UNSEAL_KEY)
        try:
            key = decode_unseal_key(path.read_text(encoding="ascii"))
            if wrapped is None:
                raise envelope.UnwrapError
            self._master = envelope.unwrap(key, wrapped, UNSEAL_KEY_CONTEXT)
            self._reason = None
        except (BadRequestError, envelope.UnwrapError, UnicodeDecodeError):
            self._reason = SealReason.WRONG_UNSEAL_KEY

    # ---- operations

    def initialise(self, passphrase: str) -> bytes:
        """Set up an empty store; returns the new unseal key, once.

        The caller stores the key as the Compose secret; the signer never
        writes it.
        """
        _check_passphrase(passphrase)
        with self._lock:
            if not self._store.is_empty():
                raise ConflictError("the store is already initialised")
            master = envelope.random_key()
            unseal_key = envelope.random_key()
            self._store.set_settings(
                {
                    MASTER_BY_UNSEAL_KEY: envelope.wrap(
                        unseal_key, master, UNSEAL_KEY_CONTEXT
                    ),
                    **self._passphrase_settings(master, passphrase),
                }
            )
            self._master = master
            self._reason = None
        logger.info("Initialised the store")
        return unseal_key

    def unseal(self, passphrase: str) -> None:
        """Open with the recovery passphrase; this also lifts a deliberate seal."""
        with self._lock:
            if self._store.is_empty():
                raise ConflictError("the store is not initialised")
            self._master = self._open_with_passphrase(passphrase)
            self._reason = None
            self._store.set_settings({DELIBERATELY_SEALED: None})
        logger.info("Unsealed with the recovery passphrase")

    def seal(self) -> None:
        """Forget the master key, and stay sealed across restarts."""
        with self._lock:
            if self._store.is_empty():
                raise ConflictError("the store is not initialised")
            self._store.set_settings({DELIBERATELY_SEALED: b"1"})
            self._master = None
            self._reason = SealReason.DELIBERATE
        logger.warning("Sealed deliberately")

    def rotate_unseal_key(self) -> bytes:
        """Rewrap the master key under a new unseal key; returns it, once."""
        with self._lock:
            master = self.master_key()
            unseal_key = envelope.random_key()
            self._store.set_settings(
                {
                    MASTER_BY_UNSEAL_KEY: envelope.wrap(
                        unseal_key, master, UNSEAL_KEY_CONTEXT
                    )
                }
            )
        logger.info("Rotated the unseal key")
        return unseal_key

    def change_passphrase(self, current: str, new: str) -> None:
        _check_passphrase(new)
        with self._lock:
            master = self._open_with_passphrase(current)
            self._store.set_settings(self._passphrase_settings(master, new))
        logger.info("Changed the recovery passphrase")

    # ---- the passphrase wrap

    def _passphrase_settings(
        self, master: bytes, passphrase: str
    ) -> dict[str, bytes | None]:
        parameters = envelope.Argon2Parameters.new()
        kek = envelope.passphrase_key(passphrase, parameters)
        return {
            MASTER_BY_PASSPHRASE: envelope.wrap(kek, master, PASSPHRASE_CONTEXT),
            ARGON2_SALT: parameters.salt,
            ARGON2_ITERATIONS: _int(parameters.iterations),
            ARGON2_LANES: _int(parameters.lanes),
            ARGON2_MEMORY_KIB: _int(parameters.memory_kib),
        }

    def _open_with_passphrase(self, passphrase: str) -> bytes:
        store = self._store
        salt = store.setting(ARGON2_SALT)
        wrapped = store.setting(MASTER_BY_PASSPHRASE)
        if salt is None or wrapped is None:
            raise ConflictError("the store has no recovery passphrase")
        parameters = envelope.Argon2Parameters(
            salt=salt,
            iterations=int(store.setting(ARGON2_ITERATIONS) or b"3"),
            lanes=int(store.setting(ARGON2_LANES) or b"4"),
            memory_kib=int(store.setting(ARGON2_MEMORY_KIB) or b"65536"),
        )
        try:
            return envelope.unwrap(
                envelope.passphrase_key(passphrase, parameters),
                wrapped,
                PASSPHRASE_CONTEXT,
            )
        except envelope.UnwrapError as error:
            raise ForbiddenError("the passphrase is wrong") from error

    # ---- private keys

    def wrap_private_key(self, key_id: str, der: bytes) -> tuple[bytes, bytes]:
        """A private key under its own data key, the data key under the master."""
        data_key = envelope.random_key()
        return (
            envelope.wrap(self.master_key(), data_key, _data_key_context(key_id)),
            envelope.wrap(data_key, der, _private_key_context(key_id)),
        )

    def unwrap_private_key(
        self, key_id: str, wrapped_data_key: bytes, wrapped_private_key: bytes
    ) -> bytes:
        data_key = envelope.unwrap(
            self.master_key(), wrapped_data_key, _data_key_context(key_id)
        )
        return envelope.unwrap(
            data_key, wrapped_private_key, _private_key_context(key_id)
        )


def _check_passphrase(passphrase: str) -> None:
    if len(passphrase) < MIN_PASSPHRASE_LENGTH:
        raise BadRequestError(
            f"the passphrase must be at least {MIN_PASSPHRASE_LENGTH} characters"
        )


def _data_key_context(key_id: str) -> bytes:
    return b"harpocrates-signer/data-key/" + key_id.encode("utf-8")


def _private_key_context(key_id: str) -> bytes:
    return b"harpocrates-signer/private-key/" + key_id.encode("utf-8")
