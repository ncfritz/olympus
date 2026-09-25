from pathlib import Path

import pytest

from harpocrates_signer import envelope
from harpocrates_signer.errors import (
    BadRequestError,
    ConflictError,
    ForbiddenError,
    SealedError,
)
from harpocrates_signer.store import Store
from harpocrates_signer.vault import SealReason, Vault, encode_unseal_key

PASSPHRASE = "correct horse battery staple"


@pytest.fixture
def paths(tmp_path: Path) -> tuple[Path, Path]:
    return tmp_path / "signer.db", tmp_path / "unseal-key"


def restart(paths: tuple[Path, Path]) -> Vault:
    """A new process: a new store connection and nothing in memory."""
    vault = Vault(Store(paths[0]), paths[1])
    vault.start()
    return vault


def initialised(paths: tuple[Path, Path]) -> Vault:
    vault = restart(paths)
    paths[1].write_text(encode_unseal_key(vault.initialise(PASSPHRASE)))
    return vault


def test_a_new_store_is_sealed_until_initialised(paths):
    vault = restart(paths)
    assert vault.status().reason is SealReason.UNINITIALISED
    with pytest.raises(SealedError):
        vault.master_key()
    vault.initialise(PASSPHRASE)
    assert not vault.status().sealed


def test_initialise_refuses_a_populated_store(paths):
    vault = initialised(paths)
    with pytest.raises(ConflictError):
        vault.initialise(PASSPHRASE)


def test_initialise_refuses_a_short_passphrase(paths):
    with pytest.raises(BadRequestError):
        restart(paths).initialise("short")


def test_unseals_itself_at_start_with_the_unseal_key(paths):
    master = initialised(paths).master_key()
    assert restart(paths).master_key() == master


def test_starts_sealed_without_the_unseal_key(paths):
    initialised(paths)
    paths[1].unlink()
    assert restart(paths).status().reason is SealReason.NO_UNSEAL_KEY


def test_an_empty_unseal_key_file_is_no_key(paths):
    initialised(paths)
    paths[1].write_text("")
    assert restart(paths).status().reason is SealReason.NO_UNSEAL_KEY


def test_starts_sealed_with_the_wrong_unseal_key(paths):
    initialised(paths)
    paths[1].write_text(encode_unseal_key(envelope.random_key()))
    assert restart(paths).status().reason is SealReason.WRONG_UNSEAL_KEY
    paths[1].write_text("not base64 at all!")
    assert restart(paths).status().reason is SealReason.WRONG_UNSEAL_KEY


def test_a_deliberate_seal_survives_a_restart(paths):
    initialised(paths).seal()
    vault = restart(paths)
    assert vault.status().reason is SealReason.DELIBERATE


def test_the_passphrase_lifts_a_deliberate_seal(paths):
    initialised(paths).seal()
    vault = restart(paths)
    vault.unseal(PASSPHRASE)
    assert not vault.status().sealed
    assert not restart(paths).status().sealed


def test_a_wrong_passphrase_is_refused(paths):
    vault = initialised(paths)
    vault.seal()
    with pytest.raises(ForbiddenError):
        vault.unseal("the wrong passphrase")
    assert vault.status().sealed


def test_rotating_the_unseal_key_retires_the_old_one(paths):
    vault = initialised(paths)
    old = paths[1].read_text()
    new = vault.rotate_unseal_key()
    assert restart(paths).status().reason is SealReason.WRONG_UNSEAL_KEY
    paths[1].write_text(encode_unseal_key(new))
    assert not restart(paths).status().sealed
    assert old != paths[1].read_text()


def test_changing_the_passphrase(paths):
    vault = initialised(paths)
    with pytest.raises(ForbiddenError):
        vault.change_passphrase("not the passphrase", "a brand new passphrase")
    vault.change_passphrase(PASSPHRASE, "a brand new passphrase")
    vault.seal()
    with pytest.raises(ForbiddenError):
        vault.unseal(PASSPHRASE)
    vault.unseal("a brand new passphrase")


def test_a_private_key_is_bound_to_its_id(paths):
    vault = initialised(paths)
    data_key, private_key = vault.wrap_private_key("key-1", b"der")
    assert vault.unwrap_private_key("key-1", data_key, private_key) == b"der"
    with pytest.raises(envelope.UnwrapError):
        vault.unwrap_private_key("key-2", data_key, private_key)


def test_nothing_secret_is_stored_in_the_clear(paths):
    vault = initialised(paths)
    master = vault.master_key()
    assert master not in paths[0].read_bytes()
