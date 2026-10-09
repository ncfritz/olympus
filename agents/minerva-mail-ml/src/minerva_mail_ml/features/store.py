"""The feature store: a SQLite database on the service's volume.

It holds, per feature version, each message's hashed token counts and the
metadata the models need beside them (sender, list, received time). It
holds no text. It is derived data, rebuilt from the archive or Gmail, so it
is not backed up (ADR 0030).

A version is `building` until the pass that fills it is complete, then
`ready`. The newest ready version serves; a newer one being built does not
replace it until it is complete.
"""

from __future__ import annotations

import sqlite3
import zlib
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
from scipy import sparse

SCHEMA = """
CREATE TABLE IF NOT EXISTS feature_versions (
    version TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('building', 'ready')),
    n_features INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    completed_at TEXT
);
CREATE TABLE IF NOT EXISTS message_features (
    version TEXT NOT NULL REFERENCES feature_versions (version),
    account_id TEXT NOT NULL,
    gmail_id TEXT NOT NULL,
    received_at TEXT NOT NULL,
    from_address TEXT,
    list_id TEXT,
    indices BLOB NOT NULL,
    counts BLOB NOT NULL,
    stored_at TEXT NOT NULL,
    PRIMARY KEY (version, account_id, gmail_id)
);
CREATE INDEX IF NOT EXISTS message_features_received
    ON message_features (version, account_id, received_at);
-- Embeddings (phase 6): a vector per message from a local model, int8,
-- under a version naming the model and its dimensions. Building until the
-- archive's pass completes it, as a feature version is.
CREATE TABLE IF NOT EXISTS embedding_versions (
    version TEXT PRIMARY KEY,
    model TEXT NOT NULL,
    dims INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('building', 'ready')),
    created_at TEXT NOT NULL,
    completed_at TEXT
);
CREATE TABLE IF NOT EXISTS message_embeddings (
    version TEXT NOT NULL REFERENCES embedding_versions (version),
    account_id TEXT NOT NULL,
    gmail_id TEXT NOT NULL,
    vector BLOB NOT NULL,
    stored_at TEXT NOT NULL,
    PRIMARY KEY (version, account_id, gmail_id)
);
"""


@dataclass(frozen=True)
class FeatureRow:
    """One message's features as stored."""

    account_id: str
    gmail_id: str
    received_at: str
    from_address: str | None
    list_id: str | None
    indices: np.ndarray
    counts: np.ndarray


@dataclass(frozen=True)
class EmbeddingVersionStatus:
    version: str
    model: str
    dims: int
    status: str
    messages: int
    created_at: str
    completed_at: str | None


@dataclass(frozen=True)
class VersionStatus:
    version: str
    status: str
    n_features: int
    messages: int
    created_at: str
    completed_at: str | None


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _pack(values: np.ndarray, dtype: type) -> bytes:
    return zlib.compress(np.ascontiguousarray(values, dtype=dtype).tobytes(), 6)


def _unpack(blob: bytes, dtype: type) -> np.ndarray:
    return np.frombuffer(zlib.decompress(blob), dtype=dtype)


class FeatureStore:
    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.execute("PRAGMA journal_mode = WAL")
        self._db.execute("PRAGMA foreign_keys = ON")
        self._db.executescript(SCHEMA)

    def close(self) -> None:
        self._db.close()

    def begin_version(self, version: str, n_features: int) -> None:
        """Records `version` as building, unless it is known already."""
        with self._db:
            self._db.execute(
                "INSERT INTO feature_versions (version, status, n_features, created_at)"
                " VALUES (?, 'building', ?, ?) ON CONFLICT (version) DO NOTHING",
                (version, n_features, _now()),
            )

    def put(
        self,
        version: str,
        account_id: str,
        rows: Sequence[tuple[str, str, str | None, str | None]],
        matrix: sparse.csr_matrix,
    ) -> int:
        """Stores a row per message: (gmail ID, received, from, list ID),
        with its row of `matrix`. A message stored again is replaced."""
        if matrix.shape[0] != len(rows):
            raise ValueError("one matrix row per message")
        now = _now()
        values = []
        for i, (gmail_id, received_at, from_address, list_id) in enumerate(rows):
            row = matrix.getrow(i)
            counts = np.minimum(row.data, np.iinfo(np.uint16).max)
            values.append(
                (
                    version,
                    account_id,
                    gmail_id,
                    received_at,
                    from_address,
                    list_id,
                    _pack(row.indices, np.uint32),
                    _pack(counts, np.uint16),
                    now,
                )
            )
        with self._db:
            self._db.executemany(
                "INSERT INTO message_features (version, account_id, gmail_id,"
                " received_at, from_address, list_id, indices, counts, stored_at)"
                " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
                " ON CONFLICT (version, account_id, gmail_id) DO UPDATE SET"
                " received_at = excluded.received_at,"
                " from_address = excluded.from_address, list_id = excluded.list_id,"
                " indices = excluded.indices, counts = excluded.counts,"
                " stored_at = excluded.stored_at",
                values,
            )
        return len(values)

    def complete(self, version: str) -> bool:
        """Marks a building version ready; False if there is no such version."""
        with self._db:
            cursor = self._db.execute(
                "UPDATE feature_versions SET status = 'ready', completed_at = ?"
                " WHERE version = ?",
                (_now(), version),
            )
        return cursor.rowcount == 1

    def n_features(self, version: str) -> int:
        row = self._db.execute(
            "SELECT n_features FROM feature_versions WHERE version = ?", (version,)
        ).fetchone()
        if row is None:
            raise KeyError(f"No feature version {version}")
        return int(row[0])

    def serving_version(self) -> str | None:
        """The newest ready version, which the models use."""
        row = self._db.execute(
            "SELECT version FROM feature_versions WHERE status = 'ready'"
            " ORDER BY completed_at DESC, version DESC LIMIT 1"
        ).fetchone()
        return row[0] if row else None

    def versions(self) -> list[VersionStatus]:
        rows = self._db.execute(
            "SELECT v.version, v.status, v.n_features, count(m.gmail_id),"
            " v.created_at, v.completed_at"
            " FROM feature_versions v"
            " LEFT JOIN message_features m ON m.version = v.version"
            " GROUP BY v.version ORDER BY v.created_at"
        ).fetchall()
        return [VersionStatus(*r) for r in rows]

    def rows(self, version: str, account_id: str | None = None) -> Iterator[FeatureRow]:
        """Every stored row of `version`, oldest first."""
        query = (
            "SELECT account_id, gmail_id, received_at, from_address, list_id,"
            " indices, counts FROM message_features WHERE version = ?"
        )
        params: tuple[str, ...] = (version,)
        if account_id is not None:
            query += " AND account_id = ?"
            params += (account_id,)
        query += " ORDER BY received_at, gmail_id"
        for r in self._db.execute(query, params):
            yield FeatureRow(
                account_id=r[0],
                gmail_id=r[1],
                received_at=r[2],
                from_address=r[3],
                list_id=r[4],
                indices=_unpack(r[5], np.uint32),
                counts=_unpack(r[6], np.uint16),
            )

    def rows_by_ids(
        self, version: str, account_id: str, gmail_ids: Sequence[str]
    ) -> dict[str, FeatureRow]:
        """The stored rows of these messages, by Gmail ID; one never stored
        is missing."""
        found: dict[str, FeatureRow] = {}
        ids = list(dict.fromkeys(gmail_ids))
        for start in range(0, len(ids), 500):
            chunk = ids[start : start + 500]
            query = (
                "SELECT account_id, gmail_id, received_at, from_address, list_id,"
                " indices, counts FROM message_features WHERE version = ?"
                " AND account_id = ? AND gmail_id IN"
                f" ({', '.join('?' for _ in chunk)})"
            )
            for r in self._db.execute(query, (version, account_id, *chunk)):
                found[r[1]] = FeatureRow(
                    account_id=r[0],
                    gmail_id=r[1],
                    received_at=r[2],
                    from_address=r[3],
                    list_id=r[4],
                    indices=_unpack(r[5], np.uint32),
                    counts=_unpack(r[6], np.uint16),
                )
        return found

    def begin_embeddings(self, version: str, model: str, dims: int) -> None:
        """Records an embedding version as building, unless it is known."""
        with self._db:
            self._db.execute(
                "INSERT INTO embedding_versions (version, model, dims, status,"
                " created_at) VALUES (?, ?, ?, 'building', ?)"
                " ON CONFLICT (version) DO NOTHING",
                (version, model, dims, _now()),
            )

    def put_embeddings(
        self,
        version: str,
        account_id: str,
        gmail_ids: Sequence[str],
        vectors: np.ndarray,
    ) -> int:
        """Stores a vector per message (int8); one stored again is replaced."""
        if vectors.shape[0] != len(gmail_ids):
            raise ValueError("one vector per message")
        if vectors.dtype != np.int8:
            raise ValueError("vectors are stored quantized, as int8")
        now = _now()
        with self._db:
            self._db.executemany(
                "INSERT INTO message_embeddings (version, account_id, gmail_id,"
                " vector, stored_at) VALUES (?, ?, ?, ?, ?)"
                " ON CONFLICT (version, account_id, gmail_id) DO UPDATE SET"
                " vector = excluded.vector, stored_at = excluded.stored_at",
                [
                    (version, account_id, g, vectors[i].tobytes(), now)
                    for i, g in enumerate(gmail_ids)
                ],
            )
        return len(gmail_ids)

    def complete_embeddings(self, version: str) -> bool:
        """Marks an embedding version ready; False if there is none."""
        with self._db:
            cursor = self._db.execute(
                "UPDATE embedding_versions SET status = 'ready', completed_at = ?"
                " WHERE version = ?",
                (_now(), version),
            )
        return cursor.rowcount == 1

    def serving_embeddings(self) -> str | None:
        """The newest ready embedding version, which training uses."""
        row = self._db.execute(
            "SELECT version FROM embedding_versions WHERE status = 'ready'"
            " ORDER BY completed_at DESC, version DESC LIMIT 1"
        ).fetchone()
        return row[0] if row else None

    def embedding_versions(self) -> list[EmbeddingVersionStatus]:
        rows = self._db.execute(
            "SELECT v.version, v.model, v.dims, v.status, count(e.gmail_id),"
            " v.created_at, v.completed_at FROM embedding_versions v"
            " LEFT JOIN message_embeddings e ON e.version = v.version"
            " GROUP BY v.version ORDER BY v.created_at"
        ).fetchall()
        return [EmbeddingVersionStatus(*r) for r in rows]

    def missing_embeddings(
        self,
        feature_version: str,
        embedding_version: str,
        account_id: str,
        limit: int,
    ) -> tuple[list[str], int]:
        """The account's messages featurized in `feature_version` but not
        embedded in `embedding_version`, newest first, at most `limit` of
        them; and how many there are in all. Mail featurized while the
        embedding model was down, for the nightly backstop to embed."""
        where = (
            " FROM message_features f WHERE f.version = ? AND f.account_id = ?"
            " AND NOT EXISTS (SELECT 1 FROM message_embeddings e"
            " WHERE e.version = ? AND e.account_id = f.account_id"
            " AND e.gmail_id = f.gmail_id)"
        )
        args = (feature_version, account_id, embedding_version)
        total = self._db.execute("SELECT count(*)" + where, args).fetchone()[0]
        ids = [
            r[0]
            for r in self._db.execute(
                "SELECT f.gmail_id" + where + " ORDER BY f.received_at DESC LIMIT ?",
                (*args, limit),
            )
        ]
        return ids, int(total)

    def embedding_dims(self, version: str) -> int:
        row = self._db.execute(
            "SELECT dims FROM embedding_versions WHERE version = ?", (version,)
        ).fetchone()
        if row is None:
            raise KeyError(f"No embedding version {version}")
        return int(row[0])

    def embeddings(self, version: str, account_id: str) -> dict[str, np.ndarray]:
        """Every vector of the account in `version`, by Gmail ID (int8)."""
        return {
            g: np.frombuffer(v, dtype=np.int8)
            for g, v in self._db.execute(
                "SELECT gmail_id, vector FROM message_embeddings"
                " WHERE version = ? AND account_id = ?",
                (version, account_id),
            )
        }

    def embeddings_by_ids(
        self, version: str, account_id: str, gmail_ids: Sequence[str]
    ) -> dict[str, np.ndarray]:
        """These messages' vectors (int8); one never embedded is missing."""
        found: dict[str, np.ndarray] = {}
        ids = list(dict.fromkeys(gmail_ids))
        for start in range(0, len(ids), 500):
            chunk = ids[start : start + 500]
            marks = ", ".join("?" for _ in chunk)
            for g, v in self._db.execute(
                "SELECT gmail_id, vector FROM message_embeddings WHERE version = ?"
                f" AND account_id = ? AND gmail_id IN ({marks})",
                (version, account_id, *chunk),
            ):
                found[g] = np.frombuffer(v, dtype=np.int8)
        return found

    def matrix(self, rows: Sequence[FeatureRow], n_features: int) -> sparse.csr_matrix:
        """The rows as a sparse count matrix, in order."""
        indptr = np.zeros(len(rows) + 1, dtype=np.int64)
        for i, row in enumerate(rows):
            indptr[i + 1] = indptr[i] + len(row.indices)
        indices = np.concatenate([r.indices for r in rows]) if rows else np.array([])
        data = np.concatenate([r.counts for r in rows]) if rows else np.array([])
        return sparse.csr_matrix(
            (data.astype(np.float32), indices.astype(np.int32), indptr),
            shape=(len(rows), n_features),
        )
