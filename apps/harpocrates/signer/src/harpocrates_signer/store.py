"""The signer's own store: one SQLite file on the signer's volume (ADR 0020).

It holds wrapped secrets only: no private key and no master key is ever
written in the clear. Tables and columns, no JSON documents (ADR 0007).
"""

import os
import sqlite3
import threading
from collections.abc import Generator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

SCHEMA_VERSION = 4

SCHEMA = """
CREATE TABLE settings (
    name  TEXT PRIMARY KEY,
    value BLOB NOT NULL
);
CREATE TABLE keys (
    id                  TEXT PRIMARY KEY,
    purpose             TEXT NOT NULL CHECK (purpose IN ('issuer', 'subject')),
    algorithm           TEXT NOT NULL,
    public_key          BLOB NOT NULL UNIQUE,
    wrapped_data_key    BLOB,
    wrapped_private_key BLOB,
    created_at          TEXT NOT NULL,
    destroyed_at        TEXT,
    CHECK ((destroyed_at IS NULL) = (wrapped_private_key IS NOT NULL))
);
CREATE TABLE issuers (
    id                TEXT PRIMARY KEY,
    key_id            TEXT NOT NULL UNIQUE REFERENCES keys (id),
    certificate       BLOB NOT NULL,
    max_validity_days INTEGER NOT NULL CHECK (max_validity_days > 0),
    registered_at     TEXT NOT NULL
);
CREATE TABLE issuer_chain_certificates (
    issuer_id   TEXT NOT NULL REFERENCES issuers (id) ON DELETE CASCADE,
    position    INTEGER NOT NULL CHECK (position >= 0),
    certificate BLOB NOT NULL,
    PRIMARY KEY (issuer_id, position)
);
CREATE TABLE issuer_extended_key_usages (
    issuer_id TEXT NOT NULL REFERENCES issuers (id) ON DELETE CASCADE,
    oid       TEXT NOT NULL,
    PRIMARY KEY (issuer_id, oid)
);
"""


#: Each later version's change, applied in order to an older store.
MIGRATIONS: dict[int, str] = {
    # SSH CAs (ADR 0035): an Ed25519 issuer key that signs user or host
    # certificates, never shared with an X.509 issuer.
    2: """
CREATE TABLE ssh_cas (
    id                   TEXT PRIMARY KEY,
    key_id               TEXT NOT NULL UNIQUE REFERENCES keys (id),
    kind                 TEXT NOT NULL CHECK (kind IN ('user', 'host')),
    max_validity_seconds INTEGER NOT NULL CHECK (max_validity_seconds > 0),
    registered_at        TEXT NOT NULL
);
""",
    # OCSP (ADR 0036): a key purpose of its own, which the keys table's
    # CHECK must admit (SQLite rebuilds a table to change one: its rows,
    # under the same name, so what references it still does), and each
    # responder's certificate with the CA's it answers for.
    3: """
CREATE TABLE keys_rebuilt (
    id                  TEXT PRIMARY KEY,
    purpose             TEXT NOT NULL CHECK (purpose IN ('issuer', 'subject', 'ocsp')),
    algorithm           TEXT NOT NULL,
    public_key          BLOB NOT NULL UNIQUE,
    wrapped_data_key    BLOB,
    wrapped_private_key BLOB,
    created_at          TEXT NOT NULL,
    destroyed_at        TEXT,
    CHECK ((destroyed_at IS NULL) = (wrapped_private_key IS NOT NULL))
);
INSERT INTO keys_rebuilt SELECT id, purpose, algorithm, public_key,
    wrapped_data_key, wrapped_private_key, created_at, destroyed_at FROM keys;
DROP TABLE keys;
ALTER TABLE keys_rebuilt RENAME TO keys;
CREATE TABLE ocsp_responders (
    key_id         TEXT PRIMARY KEY REFERENCES keys (id),
    ca_certificate BLOB NOT NULL,
    certificate    BLOB NOT NULL,
    registered_at  TEXT NOT NULL
);
""",
    # An imported issuing CA without path length 0 (ADR 0041): its key signs
    # its lists and its OCSP responder's certificate, nothing else.
    4: """
ALTER TABLE issuers ADD COLUMN lists_only INTEGER NOT NULL DEFAULT 0
    CHECK (lists_only IN (0, 1));
""",
}


def now() -> str:
    return datetime.now(UTC).isoformat()


@dataclass(frozen=True)
class KeyRow:
    id: str
    purpose: str
    algorithm: str
    public_key: bytes
    wrapped_data_key: bytes | None
    wrapped_private_key: bytes | None
    created_at: str
    destroyed_at: str | None


@dataclass(frozen=True)
class IssuerRow:
    id: str
    key_id: str
    certificate: bytes
    max_validity_days: int
    chain: tuple[bytes, ...]
    extended_key_usages: frozenset[str]
    #: Signs its lists (and its OCSP responder's certificate) only (ADR 0041).
    lists_only: bool = False


@dataclass(frozen=True)
class OcspResponderRow:
    key_id: str
    ca_certificate: bytes
    certificate: bytes


@dataclass(frozen=True)
class SshCaRow:
    id: str
    key_id: str
    kind: str
    max_validity_seconds: int


class Store:
    """A single connection, serialised by a lock: the signer is small."""

    def __init__(self, path: Path) -> None:
        path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        new = not path.exists()
        self._connection = sqlite3.connect(
            path, check_same_thread=False, isolation_level=None
        )
        self._lock = threading.RLock()
        if new:
            os.chmod(path, 0o600)
        self._connection.execute("PRAGMA foreign_keys = ON")
        version = self._connection.execute("PRAGMA user_version").fetchone()[0]
        if version > SCHEMA_VERSION:
            raise RuntimeError(f"unknown store schema version {version}")
        steps = [(1, SCHEMA)] if version == 0 else []
        later = range(max(version, 1) + 1, SCHEMA_VERSION + 1)
        steps += [(v, MIGRATIONS[v]) for v in later]
        with self._lock:
            for target, script in steps:
                self._migrate(target, script)

    def _migrate(self, target: int, script: str) -> None:
        """One step and its version, or nothing. Foreign keys are off while
        it runs, as SQLite's way of rebuilding a table needs, and checked
        before it commits."""
        db = self._connection
        db.execute("PRAGMA foreign_keys = OFF")
        try:
            db.executescript(f"BEGIN;\n{script}\nPRAGMA user_version = {target};")
            broken = db.execute("PRAGMA foreign_key_check").fetchall()
            if broken:
                db.execute("ROLLBACK")
                raise RuntimeError(
                    f"store schema version {target} would break references: {broken}"
                )
            db.execute("COMMIT")
        except sqlite3.Error:
            if db.in_transaction:
                db.execute("ROLLBACK")
            raise
        finally:
            db.execute("PRAGMA foreign_keys = ON")

    def close(self) -> None:
        with self._lock:
            self._connection.close()

    @contextmanager
    def transaction(self) -> Generator[sqlite3.Connection]:
        with self._lock:
            self._connection.execute("BEGIN IMMEDIATE")
            try:
                yield self._connection
            except BaseException:
                self._connection.execute("ROLLBACK")
                raise
            self._connection.execute("COMMIT")

    # ---- settings

    def setting(self, name: str) -> bytes | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT value FROM settings WHERE name = ?", (name,)
            ).fetchone()
        return None if row is None else bytes(row[0])

    def set_settings(self, values: dict[str, bytes | None]) -> None:
        """Set (or, with None, remove) several settings in one transaction."""
        with self.transaction() as db:
            for name, value in values.items():
                if value is None:
                    db.execute("DELETE FROM settings WHERE name = ?", (name,))
                else:
                    db.execute(
                        "INSERT INTO settings (name, value) VALUES (?, ?) "
                        "ON CONFLICT (name) DO UPDATE SET value = excluded.value",
                        (name, value),
                    )

    def is_empty(self) -> bool:
        with self._lock:
            return (
                self._connection.execute("SELECT COUNT(*) FROM settings").fetchone()[0]
                == 0
            )

    # ---- keys

    def insert_key(self, row: KeyRow) -> None:
        with self.transaction() as db:
            db.execute(
                "INSERT INTO keys (id, purpose, algorithm, public_key, "
                "wrapped_data_key, wrapped_private_key, created_at, destroyed_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    row.id,
                    row.purpose,
                    row.algorithm,
                    row.public_key,
                    row.wrapped_data_key,
                    row.wrapped_private_key,
                    row.created_at,
                    row.destroyed_at,
                ),
            )

    def key(self, key_id: str) -> KeyRow | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT id, purpose, algorithm, public_key, wrapped_data_key, "
                "wrapped_private_key, created_at, destroyed_at FROM keys WHERE id = ?",
                (key_id,),
            ).fetchone()
        return None if row is None else _key_row(row)

    def key_by_public_key(self, public_key: bytes) -> KeyRow | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT id, purpose, algorithm, public_key, wrapped_data_key, "
                "wrapped_private_key, created_at, destroyed_at FROM keys "
                "WHERE public_key = ?",
                (public_key,),
            ).fetchone()
        return None if row is None else _key_row(row)

    def destroy_key(self, key_id: str) -> None:
        with self.transaction() as db:
            db.execute(
                "UPDATE keys SET wrapped_data_key = NULL, wrapped_private_key = NULL, "
                "destroyed_at = ? WHERE id = ? AND destroyed_at IS NULL",
                (now(), key_id),
            )

    def count_keys(self) -> int:
        with self._lock:
            return self._connection.execute(
                "SELECT COUNT(*) FROM keys WHERE destroyed_at IS NULL"
            ).fetchone()[0]

    # ---- issuers

    def insert_issuer(self, row: IssuerRow) -> None:
        with self.transaction() as db:
            db.execute(
                "INSERT INTO issuers (id, key_id, certificate, max_validity_days, "
                "registered_at, lists_only) VALUES (?, ?, ?, ?, ?, ?)",
                (
                    row.id,
                    row.key_id,
                    row.certificate,
                    row.max_validity_days,
                    now(),
                    int(row.lists_only),
                ),
            )
            db.executemany(
                "INSERT INTO issuer_chain_certificates (issuer_id, position, "
                "certificate) VALUES (?, ?, ?)",
                [(row.id, i, cert) for i, cert in enumerate(row.chain)],
            )
            db.executemany(
                "INSERT INTO issuer_extended_key_usages (issuer_id, oid) VALUES (?, ?)",
                [(row.id, oid) for oid in sorted(row.extended_key_usages)],
            )

    def issuer(self, issuer_id: str) -> IssuerRow | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT id, key_id, certificate, max_validity_days, lists_only "
                "FROM issuers WHERE id = ?",
                (issuer_id,),
            ).fetchone()
            if row is None:
                return None
            chain = self._connection.execute(
                "SELECT certificate FROM issuer_chain_certificates "
                "WHERE issuer_id = ? ORDER BY position",
                (issuer_id,),
            ).fetchall()
            usages = self._connection.execute(
                "SELECT oid FROM issuer_extended_key_usages WHERE issuer_id = ?",
                (issuer_id,),
            ).fetchall()
        return IssuerRow(
            id=row[0],
            key_id=row[1],
            certificate=bytes(row[2]),
            max_validity_days=row[3],
            chain=tuple(bytes(c[0]) for c in chain),
            extended_key_usages=frozenset(u[0] for u in usages),
            lists_only=bool(row[4]),
        )

    # ---- SSH CAs

    def insert_ssh_ca(self, row: SshCaRow) -> None:
        with self.transaction() as db:
            db.execute(
                "INSERT INTO ssh_cas (id, key_id, kind, max_validity_seconds, "
                "registered_at) VALUES (?, ?, ?, ?, ?)",
                (row.id, row.key_id, row.kind, row.max_validity_seconds, now()),
            )

    def ssh_ca(self, ca_id: str) -> SshCaRow | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT id, key_id, kind, max_validity_seconds FROM ssh_cas "
                "WHERE id = ?",
                (ca_id,),
            ).fetchone()
        return None if row is None else SshCaRow(*row)

    # ---- OCSP responders

    def insert_ocsp_responder(self, row: OcspResponderRow) -> None:
        with self.transaction() as db:
            db.execute(
                "INSERT INTO ocsp_responders (key_id, ca_certificate, certificate, "
                "registered_at) VALUES (?, ?, ?, ?)",
                (row.key_id, row.ca_certificate, row.certificate, now()),
            )

    def ocsp_responder(self, key_id: str) -> OcspResponderRow | None:
        with self._lock:
            row = self._connection.execute(
                "SELECT key_id, ca_certificate, certificate FROM ocsp_responders "
                "WHERE key_id = ?",
                (key_id,),
            ).fetchone()
        return (
            None
            if row is None
            else OcspResponderRow(str(row[0]), bytes(row[1]), bytes(row[2]))
        )

    def is_issuer_key(self, key_id: str) -> bool:
        """Whether a key already signs: an X.509 issuer's or an SSH CA's."""
        with self._lock:
            return (
                self._connection.execute(
                    "SELECT 1 FROM issuers WHERE key_id = ? "
                    "UNION SELECT 1 FROM ssh_cas WHERE key_id = ?",
                    (key_id, key_id),
                ).fetchone()
                is not None
            )


def _key_row(row: tuple[object, ...]) -> KeyRow:
    def blob(value: object) -> bytes | None:
        return None if value is None else bytes(value)  # type: ignore[arg-type]  # sqlite returns bytes

    return KeyRow(
        id=str(row[0]),
        purpose=str(row[1]),
        algorithm=str(row[2]),
        public_key=blob(row[3]) or b"",
        wrapped_data_key=blob(row[4]),
        wrapped_private_key=blob(row[5]),
        created_at=str(row[6]),
        destroyed_at=None if row[7] is None else str(row[7]),
    )
