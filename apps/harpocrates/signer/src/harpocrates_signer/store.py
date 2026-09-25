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

SCHEMA_VERSION = 1

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
        if version == 0:
            # executescript manages its own transaction: the whole schema,
            # and its version, or nothing.
            with self._lock:
                self._connection.executescript(
                    f"BEGIN;\n{SCHEMA}\n"
                    f"PRAGMA user_version = {SCHEMA_VERSION};\nCOMMIT;"
                )
        elif version != SCHEMA_VERSION:
            raise RuntimeError(f"unknown store schema version {version}")

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
                "registered_at) VALUES (?, ?, ?, ?, ?)",
                (row.id, row.key_id, row.certificate, row.max_validity_days, now()),
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
                "SELECT id, key_id, certificate, max_validity_days FROM issuers "
                "WHERE id = ?",
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
