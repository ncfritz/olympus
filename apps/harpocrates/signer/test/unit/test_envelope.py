import pytest

from harpocrates_signer import envelope


def test_wraps_and_unwraps():
    key = envelope.random_key()
    wrapped = envelope.wrap(key, b"secret", b"context")
    assert b"secret" not in wrapped
    assert envelope.unwrap(key, wrapped, b"context") == b"secret"


def test_a_ciphertext_does_not_open_in_another_context():
    key = envelope.random_key()
    wrapped = envelope.wrap(key, b"secret", b"key-1")
    with pytest.raises(envelope.UnwrapError):
        envelope.unwrap(key, wrapped, b"key-2")


def test_the_wrong_key_does_not_open_it():
    wrapped = envelope.wrap(envelope.random_key(), b"secret", b"context")
    with pytest.raises(envelope.UnwrapError):
        envelope.unwrap(envelope.random_key(), wrapped, b"context")


def test_a_passphrase_derives_the_same_key_from_the_same_parameters():
    parameters = envelope.Argon2Parameters.new()
    first = envelope.passphrase_key("a long passphrase", parameters)
    assert first == envelope.passphrase_key("a long passphrase", parameters)
    assert first != envelope.passphrase_key("another passphrase", parameters)
    assert first != envelope.passphrase_key(
        "a long passphrase", envelope.Argon2Parameters.new()
    )
