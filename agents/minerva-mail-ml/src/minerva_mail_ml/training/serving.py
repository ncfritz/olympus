"""The serving models: each account's newest ready run, loaded once and
swapped when a newer run is ready (the registry is asked on every call,
which is one indexed query).

A run learns from approvals in the inbox while it serves (online.py); what
it learned is in the registry, replayed onto the model as it loads, so a
restart loses none of it. Scoring and learning take the account's lock,
since learning changes the model in place.
"""

from __future__ import annotations

import logging
import threading

from minerva_mail_ml.features.store import FeatureStore
from minerva_mail_ml.training.model import TrainedModel
from minerva_mail_ml.training.registry import ModelRegistry

logger = logging.getLogger(__name__)


class ServingModels:
    def __init__(
        self, registry: ModelRegistry, store: FeatureStore | None = None
    ) -> None:
        self._registry = registry
        self._store = store
        self._loaded: dict[str, tuple[str, TrainedModel]] = {}
        self._lock = threading.Lock()
        self._accounts: dict[str, threading.RLock] = {}

    def lock(self, account_id: str) -> threading.RLock:
        """Held while the account's model is scored with or learns."""
        with self._lock:
            return self._accounts.setdefault(account_id, threading.RLock())

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
                self._replay(run_id, model)
                loaded = (run_id, model)
                self._loaded[account_id] = loaded
            return loaded

    def _replay(self, run_id: str, model: TrainedModel) -> None:
        learned = self._registry.learned(run_id)
        if not learned or self._store is None:
            return
        from minerva_mail_ml.training.online import replay

        applied = replay(self._store, model, learned)
        logger.info(
            "Run %s: replayed %d of %d messages learned online",
            run_id,
            applied,
            len(learned),
        )
