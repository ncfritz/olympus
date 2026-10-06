from fastapi.testclient import TestClient

from minerva_mail_ml.features.featurize import FEATURE_VERSION
from minerva_mail_ml.services_app import MAX_BATCH, create_services_app

ACCOUNT = "7b2b0000-0000-4000-8000-000000000001"
SECRET = "the-body-text-that-must-not-come-back"


def message(gmail_id: str = "1a0f", **overrides):
    return {
        "gmailId": gmail_id,
        "receivedAt": "2026-10-01T12:00:00Z",
        "subject": "Your bill",
        "text": f"Your bill is due. {SECRET}",
        "fromAddress": "Bill@Power.example",
        "listId": None,
        "hasListUnsubscribe": False,
        "attachmentExtensions": ["pdf"],
        **overrides,
    }


def test_stores_a_batch_and_says_which_version(store, models) -> None:
    client = TestClient(create_services_app(store, models))
    response = client.post(
        "/v1/features",
        json={"accountId": ACCOUNT, "messages": [message("a1"), message("a2")]},
    )
    assert response.status_code == 200
    assert response.json() == {"version": FEATURE_VERSION, "stored": 2}
    rows = list(store.rows(FEATURE_VERSION))
    assert [r.gmail_id for r in rows] == ["a1", "a2"]
    assert rows[0].from_address == "bill@power.example"


def test_the_store_holds_no_text(store, models, tmp_path) -> None:
    client = TestClient(create_services_app(store, models))
    client.post("/v1/features", json={"accountId": ACCOUNT, "messages": [message()]})
    store.close()
    raw = b"".join(p.read_bytes() for p in tmp_path.glob("features.sqlite3*"))
    assert SECRET.encode() not in raw
    assert b"Your bill" not in raw


def test_refuses_another_version(store, models) -> None:
    client = TestClient(create_services_app(store, models))
    response = client.post(
        "/v1/features",
        json={"accountId": ACCOUNT, "version": "v0", "messages": [message()]},
    )
    assert response.status_code == 409


def test_a_refused_message_is_not_echoed(store, models) -> None:
    client = TestClient(create_services_app(store, models))
    response = client.post(
        "/v1/features",
        json={"accountId": ACCOUNT, "messages": [message(gmailId="NOT-HEX")]},
    )
    assert response.status_code == 422
    assert SECRET not in response.text
    assert response.json()["detail"][0]["loc"] == ["body", "messages", 0, "gmailId"]


def test_refuses_an_empty_or_oversized_batch(store, models) -> None:
    client = TestClient(create_services_app(store, models))
    for messages in ([], [message(f"{i:x}") for i in range(MAX_BATCH + 1)]):
        response = client.post(
            "/v1/features", json={"accountId": ACCOUNT, "messages": messages}
        )
        assert response.status_code == 422


def test_completing_a_version_makes_it_serve(store, models) -> None:
    client = TestClient(create_services_app(store, models))
    client.post("/v1/features", json={"accountId": ACCOUNT, "messages": [message()]})
    assert client.get("/v1/features/versions").json()[0]["serving"] is False

    response = client.post("/v1/features/complete", json={"version": FEATURE_VERSION})
    assert response.status_code == 200
    assert response.json()["status"] == "ready"
    assert response.json()["serving"] is True
    assert response.json()["messages"] == 1

    unknown = client.post("/v1/features/complete", json={"version": "v9"})
    assert unknown.status_code == 404
