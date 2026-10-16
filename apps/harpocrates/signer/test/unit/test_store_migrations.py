import sqlite3
from pathlib import Path

from harpocrates_signer.store import SCHEMA, SCHEMA_VERSION, Store


def test_a_version_1_store_gains_the_ssh_cas(tmp_path: Path):
    path = tmp_path / "signer.db"
    connection = sqlite3.connect(path)
    connection.executescript(f"BEGIN;\n{SCHEMA}\nPRAGMA user_version = 1;\nCOMMIT;")
    connection.close()
    store = Store(path)
    try:
        assert store.ssh_ca("ssh-user-1-g1") is None
    finally:
        store.close()
    connection = sqlite3.connect(path)
    assert connection.execute("PRAGMA user_version").fetchone()[0] == SCHEMA_VERSION
    connection.close()


def test_a_version_2_store_admits_ocsp_keys_and_keeps_its_rows(tmp_path: Path):
    path = tmp_path / "signer.db"
    store = Store(path)
    store.close()
    # Back to version 2 as it was: the old CHECK, rows that reference keys.
    connection = sqlite3.connect(path)
    connection.executescript(
        """
BEGIN;
DROP TABLE ocsp_responders;
ALTER TABLE issuers DROP COLUMN lists_only;
CREATE TABLE keys_v2 (
    id TEXT PRIMARY KEY,
    purpose TEXT NOT NULL CHECK (purpose IN ('issuer', 'subject')),
    algorithm TEXT NOT NULL, public_key BLOB NOT NULL UNIQUE,
    wrapped_data_key BLOB, wrapped_private_key BLOB,
    created_at TEXT NOT NULL, destroyed_at TEXT,
    CHECK ((destroyed_at IS NULL) = (wrapped_private_key IS NOT NULL))
);
DROP TABLE keys;
ALTER TABLE keys_v2 RENAME TO keys;
INSERT INTO keys VALUES ('k1', 'issuer', 'Ed25519', X'01', X'02', X'03', 't', NULL);
INSERT INTO ssh_cas VALUES ('ssh-user-1-g1', 'k1', 'user', 3600, 't');
PRAGMA user_version = 2;
COMMIT;
"""
    )
    connection.close()

    store = Store(path)
    try:
        assert store.key("k1") is not None
        assert store.is_issuer_key("k1")
        assert store.ocsp_responder("k1") is None
    finally:
        store.close()
    connection = sqlite3.connect(path)
    try:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == (
            SCHEMA_VERSION
        )
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute(
            "INSERT INTO keys VALUES "
            "('k2', 'ocsp', 'P-256', X'04', X'05', X'06', 't', NULL)"
        )
        # References still point at keys: an SSH CA for no key is refused.
        try:
            connection.execute(
                "INSERT INTO ssh_cas VALUES ('ssh-host-1-g1', 'nope', 'host', 1, 't')"
            )
            raise AssertionError("the foreign key was not kept")
        except sqlite3.IntegrityError:
            pass
        assert connection.execute("PRAGMA foreign_key_check").fetchall() == []
    finally:
        connection.close()


def test_a_version_3_store_gains_lists_only_issuers(tmp_path: Path):
    path = tmp_path / "signer.db"
    store = Store(path)
    store.close()
    connection = sqlite3.connect(path)
    connection.executescript(
        """
BEGIN;
ALTER TABLE issuers DROP COLUMN lists_only;
INSERT INTO keys VALUES ('k1', 'issuer', 'P-256', X'01', X'02', X'03', 't', NULL);
INSERT INTO issuers VALUES ('issuing-1-g1', 'k1', X'04', 30, 't');
PRAGMA user_version = 3;
COMMIT;
"""
    )
    connection.close()

    store = Store(path)
    try:
        issuer = store.issuer("issuing-1-g1")
        assert issuer is not None
        assert issuer.lists_only is False
    finally:
        store.close()
