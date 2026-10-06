from __future__ import annotations

from pathlib import Path

import pytest

from minerva_mail_ml.features.store import FeatureStore


@pytest.fixture
def store(tmp_path: Path):
    s = FeatureStore(tmp_path / "features.sqlite3")
    yield s
    s.close()
