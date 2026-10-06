"""The serving models: each account's newest ready run, loaded once and
swapped when a newer run is ready (the registry is asked on every call,
which is one indexed query)."""

from __future__ import annotations

import threading

from minerva_mail_ml.training.model import TrainedModel
from minerva_mail_ml.training.registry import ModelRegistry


class ServingModels:
    def __init__(self, registry: ModelRegistry) -> None:
        self._registry = registry
        self._loaded: dict[str, tuple[str, TrainedModel]] = {}
        self._lock = threading.Lock()

    def get(self, account_id: str) -> tuple[str, TrainedModel] | None:
        """(run ID, model) serving the account, or None before any run."""
        run_id = self._registry.serving(account_id)
        if run_id is None:
            return None
        with self._lock:
            loaded = self._loaded.get(account_id)
            if loaded is None or loaded[0] != run_id:
                model = self._registry.load(run_id)
                assert isinstance(model, TrainedModel)
                loaded = (run_id, model)
                self._loaded[account_id] = loaded
            return loaded
