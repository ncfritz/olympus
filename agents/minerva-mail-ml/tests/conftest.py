from __future__ import annotations

from pathlib import Path

import pytest

from minerva_mail_ml.features.store import FeatureStore
from minerva_mail_ml.training.registry import ModelRegistry
from minerva_mail_ml.training.serving import ServingModels


@pytest.fixture
def store(tmp_path: Path):
    s = FeatureStore(tmp_path / "features.sqlite3")
    yield s
    s.close()


@pytest.fixture
def registry(tmp_path: Path):
    r = ModelRegistry(tmp_path / "models")
    yield r
    r.close()


@pytest.fixture
def models(registry):
    return ServingModels(registry)
