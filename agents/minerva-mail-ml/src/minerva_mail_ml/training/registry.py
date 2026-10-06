"""Model runs: each training run, its evaluation per target, and the model
it made, on the service's volume beside the feature store.

A run is `building` while it trains, then `ready` or `failed`. The newest
ready run of an account serves; a run that fails, or is still training,
leaves the one before it serving. The model files of all but the newest
KEEP_MODELS ready runs are removed; their rows stay, as the record.
"""

from __future__ import annotations

import sqlite3
import uuid
from dataclasses import asdict, dataclass, fields
from datetime import UTC, datetime
from pathlib import Path

import joblib

KEEP_MODELS = 3

SCHEMA = """
CREATE TABLE IF NOT EXISTS model_runs (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    feature_version TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('building', 'ready', 'failed')),
    started_at TEXT NOT NULL,
    finished_at TEXT,
    error TEXT,
    examples INTEGER,
    train_examples INTEGER,
    validation_examples INTEGER,
    test_examples INTEGER,
    validation_from TEXT,
    test_from TEXT,
    targets INTEGER,
    targets_trained INTEGER,
    precision REAL,
    recall REAL,
    precision_default REAL,
    recall_default REAL,
    coverage REAL,
    top_one REAL
);
CREATE INDEX IF NOT EXISTS model_runs_account
    ON model_runs (account_id, status, finished_at);
CREATE TABLE IF NOT EXISTS model_run_targets (
    run_id TEXT NOT NULL REFERENCES model_runs (id),
    target TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('topic', 'family')),
    name TEXT NOT NULL,
    label TEXT NOT NULL,
    train_positives INTEGER NOT NULL,
    validation_positives INTEGER NOT NULL,
    test_positives INTEGER NOT NULL,
    linear INTEGER NOT NULL,
    own_combiner INTEGER NOT NULL,
    threshold REAL,
    predicted INTEGER NOT NULL,
    true_positives INTEGER NOT NULL,
    precision REAL,
    recall REAL,
    predicted_default INTEGER NOT NULL,
    true_positives_default INTEGER NOT NULL,
    precision_default REAL,
    recall_default REAL,
    PRIMARY KEY (run_id, target)
);
"""


def _now() -> str:
    return datetime.now(UTC).isoformat()


@dataclass
class RunSummary:
    examples: int
    train_examples: int
    validation_examples: int
    test_examples: int
    validation_from: str
    test_from: str
    targets: int
    targets_trained: int
    precision: float | None
    recall: float | None
    precision_default: float | None
    recall_default: float | None
    coverage: float | None
    top_one: float | None


@dataclass
class TargetResult:
    target: str
    kind: str
    name: str
    # What a suggestion applies: the topic, or the family's initial label.
    label: str
    train_positives: int
    validation_positives: int
    test_positives: int
    linear: bool
    own_combiner: bool
    threshold: float | None
    predicted: int
    true_positives: int
    precision: float | None
    recall: float | None
    predicted_default: int
    true_positives_default: int
    precision_default: float | None
    recall_default: float | None


@dataclass
class Run:
    id: str
    account_id: str
    feature_version: str
    status: str
    started_at: str
    finished_at: str | None
    error: str | None
    summary: RunSummary | None


_SUMMARY = [f.name for f in fields(RunSummary)]
_TARGET = [f.name for f in fields(TargetResult)]


class ModelRegistry:
    def __init__(self, directory: Path) -> None:
        directory.mkdir(parents=True, exist_ok=True)
        self.directory = directory
        self._db = sqlite3.connect(directory / "runs.sqlite3", check_same_thread=False)
        self._db.execute("PRAGMA journal_mode = WAL")
        self._db.execute("PRAGMA foreign_keys = ON")
        self._db.executescript(SCHEMA)

    def close(self) -> None:
        self._db.close()

    def model_path(self, run_id: str) -> Path:
        return self.directory / f"{run_id}.joblib"

    def begin(self, account_id: str, feature_version: str) -> str:
        run_id = str(uuid.uuid4())
        with self._db:
            self._db.execute(
                "INSERT INTO model_runs (id, account_id, feature_version, status,"
                " started_at) VALUES (?, ?, ?, 'building', ?)",
                (run_id, account_id, feature_version, _now()),
            )
        return run_id

    def finish(
        self,
        run_id: str,
        model: object,
        summary: RunSummary,
        targets: list[TargetResult],
    ) -> None:
        """Saves the model, then marks the run ready: from now on it serves."""
        path = self.model_path(run_id)
        partial = path.with_suffix(".partial")
        joblib.dump(model, partial, compress=3)
        partial.replace(path)
        values = asdict(summary)
        with self._db:
            self._db.executemany(
                f"INSERT INTO model_run_targets (run_id, {', '.join(_TARGET)})"
                f" VALUES (?, {', '.join('?' for _ in _TARGET)})",
                [(run_id, *(asdict(t)[c] for c in _TARGET)) for t in targets],
            )
            self._db.execute(
                "UPDATE model_runs SET status = 'ready', finished_at = ?, "
                + ", ".join(f"{c} = ?" for c in _SUMMARY)
                + " WHERE id = ?",
                (_now(), *(values[c] for c in _SUMMARY), run_id),
            )
        self._prune()

    def fail(self, run_id: str, error: str) -> None:
        with self._db:
            self._db.execute(
                "UPDATE model_runs SET status = 'failed', finished_at = ?, error = ?"
                " WHERE id = ?",
                (_now(), error[:1000], run_id),
            )

    def _prune(self) -> None:
        keep = {
            r[0]
            for r in self._db.execute(
                "SELECT id FROM (SELECT id, row_number() OVER (PARTITION BY"
                " account_id ORDER BY finished_at DESC) AS n FROM model_runs"
                " WHERE status = 'ready') WHERE n <= ?",
                (KEEP_MODELS,),
            )
        }
        for path in self.directory.glob("*.joblib"):
            if path.stem not in keep:
                path.unlink(missing_ok=True)

    def _run(self, row: tuple) -> Run:
        base, rest = row[:7], row[7:]
        summary = (
            RunSummary(**dict(zip(_SUMMARY, rest, strict=True)))
            if base[3] == "ready"
            else None
        )
        return Run(*base, summary=summary)

    def runs(self, account_id: str | None = None, limit: int = 20) -> list[Run]:
        query = (
            "SELECT id, account_id, feature_version, status, started_at,"
            f" finished_at, error, {', '.join(_SUMMARY)} FROM model_runs"
        )
        params: tuple = ()
        if account_id is not None:
            query += " WHERE account_id = ?"
            params = (account_id,)
        query += " ORDER BY started_at DESC LIMIT ?"
        return [self._run(r) for r in self._db.execute(query, (*params, limit))]

    def run(self, run_id: str) -> Run | None:
        row = self._db.execute(
            "SELECT id, account_id, feature_version, status, started_at,"
            f" finished_at, error, {', '.join(_SUMMARY)} FROM model_runs WHERE id = ?",
            (run_id,),
        ).fetchone()
        return self._run(row) if row else None

    def targets(self, run_id: str) -> list[TargetResult]:
        rows = self._db.execute(
            f"SELECT {', '.join(_TARGET)} FROM model_run_targets WHERE run_id = ?"
            " ORDER BY test_positives DESC, target",
            (run_id,),
        )
        out = []
        for r in rows:
            result = TargetResult(**dict(zip(_TARGET, r, strict=True)))
            result.linear = bool(result.linear)
            result.own_combiner = bool(result.own_combiner)
            out.append(result)
        return out

    def serving(self, account_id: str) -> str | None:
        """The newest ready run of the account."""
        row = self._db.execute(
            "SELECT id FROM model_runs WHERE account_id = ? AND status = 'ready'"
            " ORDER BY finished_at DESC LIMIT 1",
            (account_id,),
        ).fetchone()
        return row[0] if row else None

    def load(self, run_id: str) -> object:
        return joblib.load(self.model_path(run_id))
