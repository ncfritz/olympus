from fastapi.testclient import TestClient

from minerva_mail_ml.services_app import create_services_app

from .synthetic import ACCOUNT

SECRET = "a-sentence-that-must-not-come-back"


def bill(gmail_id: str = "1a0f"):
    return {
        "gmailId": gmail_id,
        "receivedAt": "2026-10-01T12:00:00Z",
        "subject": "your bill statement",
        "text": f"amount due kilowatt usage autopay account {SECRET}",
        "fromAddress": "Billing@Power.example",
        "listId": None,
        "hasListUnsubscribe": False,
        "attachmentExtensions": ["pdf"],
    }


def test_no_model_yet(store, models) -> None:
    client = TestClient(create_services_app(store, models))
    response = client.post(
        "/v1/suggestions", json={"accountId": ACCOUNT, "messages": [bill()]}
    )
    assert response.status_code == 404


def test_suggests_from_the_serving_model(store, registry, models, trained) -> None:
    model, summary, results = trained
    run_id = registry.begin(ACCOUNT, "v1")
    registry.finish(run_id, model, summary, results)
    client = TestClient(create_services_app(store, models))
    response = client.post(
        "/v1/suggestions", json={"accountId": ACCOUNT, "messages": [bill()]}
    )
    assert response.status_code == 200
    assert SECRET not in response.text
    body = response.json()
    assert body["modelRun"] == run_id
    labels = {s["label"]: s for s in body["messages"][0]["labels"]}
    assert labels["Bills/*Payable"]["ticked"] is True
    assert labels["Bills/*Payable"]["kind"] == "family"
    assert "Bills/*Paid" not in labels
    # Nothing was stored: suggesting is not featurizing.
    assert store.versions() == []
