"""A message's embedding: a small dense vector of what it is about, from a
local model (ADR 0030, The classifier: embeddings and nearest neighbours;
docs/plans/email-management phase 6).

The model runs in Ollama (`nomic-embed-text`), on the LAN; text goes to it
in the body of a request, as it comes here, and nothing of it is kept.
`nomic-embed-text` is trained so that its vector's leading dimensions stand
on their own (Matryoshka), so the vector is cut to EMBED_DIMS, normalised
to unit length and stored as int8: 250,000 messages in under 100 MB.

A vector depends on the model, its dimensions and what of the message is
read; changing any of them is a new embedding version, built beside the
old as feature versions are.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Sequence
from typing import Protocol

import httpx
import numpy as np

from minerva_mail_ml.features.featurize import MessageText

logger = logging.getLogger(__name__)

EMBED_DIMS = 384
# What of the body is read: its start says what a message is.
EMBED_CHARS = 2000
# nomic-embed-text reads a task prefix; this one is for labelling.
PREFIX = "classification: "
# Texts per request to Ollama.
OLLAMA_BATCH = 64


def embedding_version(model: str, dims: int = EMBED_DIMS) -> str:
    """The version a model's vectors are stored under (`nomic-embed-text-384`)."""
    name = re.sub(r"[^a-z0-9.-]+", "-", model.lower()).strip("-")
    return f"{name}-{dims}"


def embed_text(message: MessageText) -> str:
    """What the model reads of a message: its subject and the body's start."""
    subject = (message.subject or "").strip()
    body = " ".join((message.text or "")[:EMBED_CHARS].split())
    return f"{PREFIX}{subject}\n{body}".strip()


def normalise(vectors: np.ndarray, dims: int = EMBED_DIMS) -> np.ndarray:
    """Cut to `dims` and scaled to unit length; a zero vector stays zero."""
    v = np.asarray(vectors, dtype=np.float32)[:, :dims]
    norms = np.linalg.norm(v, axis=1, keepdims=True)
    return np.divide(v, norms, out=np.zeros_like(v), where=norms > 0)


def quantize(vectors: np.ndarray) -> np.ndarray:
    """Unit vectors as int8, each value times 127."""
    return np.clip(np.rint(vectors * 127.0), -127, 127).astype(np.int8)


def dequantize(vectors: np.ndarray) -> np.ndarray:
    return np.asarray(vectors, dtype=np.float32) / 127.0


class Embedder(Protocol):
    """What embeds text; Ollama in service, a stand-in in tests."""

    @property
    def version(self) -> str: ...

    def embed(self, texts: Sequence[str]) -> np.ndarray:
        """A unit vector of EMBED_DIMS per text, in order."""
        ...


class EmbedError(Exception):
    """The model could not embed; why, never the text."""


class OllamaEmbedder:
    """Ollama's /api/embed, on the LAN."""

    def __init__(
        self,
        base_url: str,
        model: str,
        dims: int = EMBED_DIMS,
        timeout: float = 120.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.model = model
        self.dims = dims
        self._client = httpx.Client(
            base_url=base_url.rstrip("/"), timeout=timeout, transport=transport
        )

    @property
    def version(self) -> str:
        return embedding_version(self.model, self.dims)

    def close(self) -> None:
        self._client.close()

    def embed(self, texts: Sequence[str]) -> np.ndarray:
        out: list[np.ndarray] = []
        for start in range(0, len(texts), OLLAMA_BATCH):
            chunk = list(texts[start : start + OLLAMA_BATCH])
            try:
                response = self._client.post(
                    "/api/embed",
                    json={"model": self.model, "input": chunk, "truncate": True},
                )
            except httpx.HTTPError as error:
                raise EmbedError(
                    f"Ollama is unreachable: {type(error).__name__}"
                ) from error
            if not response.is_success:
                # Ollama's error names the model or the problem, not the text.
                try:
                    detail = str(response.json().get("error", ""))[:200]
                except ValueError:
                    detail = response.reason_phrase
                raise EmbedError(f"Ollama answered {response.status_code}: {detail}")
            vectors = np.asarray(response.json()["embeddings"], dtype=np.float32)
            if (
                vectors.ndim != 2
                or vectors.shape[0] != len(chunk)
                or vectors.shape[1] < self.dims
            ):
                raise EmbedError(
                    f"Ollama gave vectors of shape {vectors.shape},"
                    f" not {len(chunk)} of at least {self.dims}"
                )
            out.append(normalise(vectors, self.dims))
        if not out:
            return np.zeros((0, self.dims), dtype=np.float32)
        return np.vstack(out)
