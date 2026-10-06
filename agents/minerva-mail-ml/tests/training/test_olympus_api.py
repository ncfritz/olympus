from pathlib import Path

import httpx

from minerva_mail_ml.config import ApiClient
from minerva_mail_ml.olympus_api import OlympusApi

ACCOUNT = "7b2b0000-0000-4000-8000-000000000001"


def _example(gmail_id: str) -> dict:
    return {
        "gmailId": gmail_id,
        "threadId": gmail_id,
        "receivedTime": "2026-01-02T03:04:05.000Z",
        "fromAddress": "billing@power.example",
        "sent": False,
        "topics": ["Finance/Utilities"],
        "families": ["Bills"],
    }


def _api(handler) -> OlympusApi:
    config = ApiClient(
        base_url="https://olympus-api:3443/v1",
        cert=Path("c"),
        key=Path("k"),
        ca=Path("ca"),
    )
    return OlympusApi(config, transport=httpx.MockTransport(handler))


def test_pages_through_examples() -> None:
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request.url)
        assert request.url.path == "/v1/minerva/mail/training/examples"
        if "after" not in request.url.params:
            return httpx.Response(
                200, json={"examples": [_example("a1")], "nextCursor": "a1"}
            )
        return httpx.Response(200, json={"examples": [_example("a2")]})

    examples = list(_api(handler).examples(ACCOUNT, page=1))
    assert [e.gmail_id for e in examples] == ["a1", "a2"]
    assert examples[0].families == ("Bills",)
    assert examples[0].received.year == 2026
    assert seen[1].params["after"] == "a1"
    assert seen[0].params["accountId"] == ACCOUNT


def test_reads_labels_and_accounts() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/accounts"):
            return httpx.Response(
                200, json={"accounts": [{"id": ACCOUNT, "email": "o@example.test"}]}
            )
        return httpx.Response(
            200,
            json={
                "topics": ["Reading"],
                "families": [
                    {
                        "name": "Bills",
                        "initialLabel": "Bills/*Payable",
                        "states": ["Bills/*Paid", "Bills/*Payable"],
                    }
                ],
            },
        )

    api = _api(handler)
    assert api.accounts()[0].id == ACCOUNT
    labels = api.labels(ACCOUNT)
    assert labels.topics == ("Reading",)
    assert labels.families[0].initial_label == "Bills/*Payable"


def test_posts_a_run_of_suggestions() -> None:
    from minerva_mail_ml.olympus_api import Suggestion

    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        seen.append((request.url.path, json.loads(request.content)))
        if request.url.path.endswith("/suggestion-runs"):
            return httpx.Response(201, json={"run": {"id": "run-1"}})
        if request.url.path.endswith("/suggestions"):
            return httpx.Response(201, json={"created": 1, "skipped": 0})
        return httpx.Response(200, json={"run": {"id": "run-1"}})

    api = _api(handler)
    run_id = api.create_suggestion_run(ACCOUNT, "model-1", "v1")
    stored = api.create_suggestions(
        run_id, [Suggestion("a1", "Bills/*Payable", "add", 0.97123, True)]
    )
    api.publish_suggestion_run(run_id, 255056)
    assert stored == (1, 0)
    assert seen[0] == (
        "/v1/minerva/mail/suggestion-runs",
        {"accountId": ACCOUNT, "modelRun": "model-1", "featureVersion": "v1"},
    )
    assert seen[1][0] == "/v1/minerva/mail/suggestion-run/run-1/suggestions"
    assert seen[1][1]["suggestions"][0] == {
        "gmailId": "a1",
        "label": "Bills/*Payable",
        "action": "add",
        "confidence": 0.9712,
        "ticked": True,
    }
    assert seen[2] == (
        "/v1/minerva/mail/suggestion-run/run-1/publish",
        {"messagesScored": 255056},
    )
