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
