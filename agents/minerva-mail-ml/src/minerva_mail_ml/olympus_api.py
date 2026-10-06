"""The API, as the classifier calls it: its services listener, with the
classifier's client certificate. Metadata and labels come from here, and
suggestions go back; the service never reads Hasura (ADR 0030).
"""

from __future__ import annotations

import ssl
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime

import httpx

from minerva_mail_ml.config import ApiClient

PAGE = 5000


@dataclass(frozen=True)
class Account:
    id: str
    email: str


@dataclass(frozen=True)
class Example:
    """A message's metadata and its training targets."""

    gmail_id: str
    thread_id: str
    received: datetime
    from_address: str | None
    list_id: str | None
    sent: bool
    topics: tuple[str, ...]
    families: tuple[str, ...]


@dataclass(frozen=True)
class Family:
    name: str
    initial_label: str
    states: tuple[str, ...]


@dataclass(frozen=True)
class Suggestion:
    """A label to add to or remove from a message, as posted."""

    gmail_id: str
    label: str
    action: str  # "add" or "remove"
    confidence: float
    ticked: bool


@dataclass(frozen=True)
class Labels:
    topics: tuple[str, ...]
    families: tuple[Family, ...]


def _example(raw: dict) -> Example:
    return Example(
        gmail_id=raw["gmailId"],
        thread_id=raw["threadId"],
        received=datetime.fromisoformat(raw["receivedTime"]),
        from_address=raw.get("fromAddress"),
        list_id=raw.get("listId"),
        sent=bool(raw["sent"]),
        topics=tuple(raw["topics"]),
        families=tuple(raw["families"]),
    )


class OlympusApi:
    def __init__(
        self,
        config: ApiClient,
        timeout: float = 120.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        verify: ssl.SSLContext | bool = True
        if transport is None:
            verify = ssl.create_default_context(cafile=str(config.ca))
            verify.load_cert_chain(str(config.cert), str(config.key))
        self._client = httpx.Client(
            base_url=config.base_url + "/minerva/mail",
            verify=verify,
            timeout=timeout,
            transport=transport,
        )

    def close(self) -> None:
        self._client.close()

    def _get(self, path: str, params: dict | None = None) -> dict:
        response = self._client.get(path, params=params)
        response.raise_for_status()
        return response.json()

    def _post(self, path: str, body: dict) -> dict:
        response = self._client.post(path, json=body)
        response.raise_for_status()
        return response.json()

    def accounts(self) -> list[Account]:
        body = self._get("/training/accounts")
        return [Account(id=a["id"], email=a["email"]) for a in body["accounts"]]

    def examples(self, account_id: str, page: int = PAGE) -> Iterator[Example]:
        """Every message of the account, by Gmail ID, a page at a time."""
        after: str | None = None
        while True:
            params: dict = {"accountId": account_id, "limit": page}
            if after is not None:
                params["after"] = after
            body = self._get("/training/examples", params)
            for raw in body["examples"]:
                yield _example(raw)
            after = body.get("nextCursor")
            if after is None:
                return

    def labels(self, account_id: str) -> Labels:
        body = self._get("/training/labels", {"accountId": account_id})
        return Labels(
            topics=tuple(body["topics"]),
            families=tuple(
                Family(
                    name=f["name"],
                    initial_label=f["initialLabel"],
                    states=tuple(f["states"]),
                )
                for f in body["families"]
            ),
        )

    def create_suggestion_run(
        self, account_id: str, model_run: str, feature_version: str
    ) -> str:
        """Begins a building run of suggestions; its ID."""
        body = self._post(
            "/suggestion-runs",
            {
                "accountId": account_id,
                "modelRun": model_run,
                "featureVersion": feature_version,
            },
        )
        return body["run"]["id"]

    def create_suggestions(
        self, run_id: str, suggestions: list[Suggestion]
    ) -> tuple[int, int]:
        """Posts a batch (up to 5,000); (stored, skipped)."""
        body = self._post(
            f"/suggestion-run/{run_id}/suggestions",
            {
                "suggestions": [
                    {
                        "gmailId": s.gmail_id,
                        "label": s.label,
                        "action": s.action,
                        "confidence": round(s.confidence, 4),
                        "ticked": s.ticked,
                    }
                    for s in suggestions
                ]
            },
        )
        return body["created"], body["skipped"]

    def publish_suggestion_run(self, run_id: str, messages_scored: int) -> None:
        self._post(
            f"/suggestion-run/{run_id}/publish", {"messagesScored": messages_scored}
        )
