import json

import httpx
import numpy as np
import pytest

from minerva_mail_ml.features.embed import (
    EMBED_DIMS,
    EmbedError,
    OllamaEmbedder,
    dequantize,
    embed_text,
    embedding_version,
    quantize,
)
from minerva_mail_ml.features.featurize import MessageText

SECRET = "the-body-text-that-must-not-come-back"


def text(subject: str = "Your trip", body: str = f"Booked. {SECRET}") -> MessageText:
    return MessageText(
        subject=subject,
        text=body,
        from_address="trips@air.example",
        list_id=None,
        has_list_unsubscribe=False,
        attachment_extensions=[],
    )


def test_names_a_version_by_model_and_dimensions() -> None:
    assert embedding_version("nomic-embed-text") == "nomic-embed-text-384"
    assert embedding_version("Nomic Embed:v1.5", 256) == "nomic-embed-v1.5-256"


def test_reads_the_subject_and_the_start_of_the_body() -> None:
    long = text(body="word " * 2000)
    t = embed_text(long)
    assert t.startswith("classification: Your trip\nword word")
    assert len(t) < 2100


def test_quantizes_unit_vectors_to_int8_and_back() -> None:
    v = np.array([[0.6, -0.8, 0.0]], dtype=np.float32)
    q = quantize(v)
    assert q.dtype == np.int8 and q.tolist() == [[76, -102, 0]]
    assert np.allclose(dequantize(q), v, atol=0.01)


def test_asks_ollama_in_batches_and_cuts_to_384_unit_vectors() -> None:
    seen: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        seen.append(body)
        assert request.url.path == "/api/embed"
        return httpx.Response(
            200, json={"embeddings": [[3.0] * 768 for _ in body["input"]]}
        )

    embedder = OllamaEmbedder(
        "http://ollama:11434/",
        "nomic-embed-text",
        transport=httpx.MockTransport(handler),
    )
    vectors = embedder.embed([f"t{i}" for i in range(70)])
    assert vectors.shape == (70, EMBED_DIMS)
    assert np.allclose(np.linalg.norm(vectors, axis=1), 1.0)
    assert [len(b["input"]) for b in seen] == [64, 6]
    assert seen[0]["model"] == "nomic-embed-text" and seen[0]["truncate"] is True
    assert embedder.version == "nomic-embed-text-384"


def test_says_why_ollama_failed_without_the_text() -> None:
    def missing(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"error": 'model "nomic-embed-text" not found'})

    embedder = OllamaEmbedder(
        "http://ollama:11434",
        "nomic-embed-text",
        transport=httpx.MockTransport(missing),
    )
    with pytest.raises(EmbedError, match="not found") as error:
        embedder.embed([embed_text(text())])
    assert SECRET not in str(error.value)

    def short(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"embeddings": [[1.0] * 128]})

    embedder = OllamaEmbedder(
        "http://ollama:11434", "small", transport=httpx.MockTransport(short)
    )
    with pytest.raises(EmbedError, match="at least 384"):
        embedder.embed(["x"])
