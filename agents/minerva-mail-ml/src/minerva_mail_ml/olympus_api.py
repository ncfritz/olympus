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
    # Approved in the inbox ("approved"), or approved with other labels
    # ("amended", a correction); None when not decided there.
    decision: str | None = None


@dataclass(frozen=True)
class Decision:
    """An approval in the inbox, to learn from at once."""

    example: Example
    decided: datetime
    # Its labels are settled: the batch writing them has finished.
    ready: bool
    # Where it stands in the order; pass as `after` for those after it.
    cursor: str


@dataclass(frozen=True)
class ScoredLabel:
    """A label suggested for new mail, as recorded."""

    label: str
    score: float
    ticked: bool


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
        decision=raw.get("decision"),
    )


class ApiError(Exception):
    """The API refused a request; its own message says why (never a
    message's text, which is not sent there)."""

    def __init__(self, method: str, path: str, status: int, detail: str) -> None:
        super().__init__(f"{method} {path}: {status} {detail}")
        self.status = status


def _checked(response: httpx.Response) -> dict:
    if response.is_success:
        return response.json()
    try:
        body = response.json()
        detail = body.get("message") or body.get("error") or response.reason_phrase
        if isinstance(detail, list):
            detail = "; ".join(str(d) for d in detail)
    except ValueError:
        detail = response.reason_phrase
    raise ApiError(
        response.request.method,
        response.request.url.path,
        response.status_code,
        str(detail)[:300],
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
        return _checked(self._client.get(path, params=params))

    def _post(self, path: str, body: dict) -> dict:
        return _checked(self._client.post(path, json=body))

    def _put(self, path: str, body: dict) -> dict:
        return _checked(self._client.put(path, json=body))

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

    def decisions(
        self, account_id: str, after: str | None = None, page: int = 500
    ) -> Iterator[Decision]:
        """The account's approvals in the inbox after the cursor, in order."""
        while True:
            params: dict = {"accountId": account_id, "limit": page}
            if after is not None:
                params["after"] = after
            body = self._get("/training/decisions", params)
            for raw in body["decisions"]:
                yield Decision(
                    example=_example(raw["example"]),
                    decided=datetime.fromisoformat(raw["decidedTime"]),
                    ready=bool(raw["ready"]),
                    cursor=raw["cursor"],
                )
            after = body.get("nextCursor")
            if after is None:
                return

    def inbox_to_score(self, account_id: str) -> list[str]:
        """Gmail IDs of what is to review in the inbox, newest first."""
        body = self._get("/training/inbox", {"accountId": account_id})
        return list(body["gmailIds"])

    def record_message_suggestions(
        self,
        account_id: str,
        model_run: str,
        feature_version: str,
        messages: list[tuple[str, list[ScoredLabel]]],
    ) -> int:
        """Replaces messages' suggestions (up to 500); how many recorded."""
        body = self._put(
            f"/account/{account_id}/message-suggestions",
            {
                "modelRun": model_run,
                "featureVersion": feature_version,
                "messages": [
                    {
                        "gmailId": gmail_id,
                        "suggestions": [
                            {
                                "label": s.label,
                                "score": round(s.score, 4),
                                "ticked": s.ticked,
                            }
                            for s in labels
                        ],
                    }
                    for gmail_id, labels in messages
                ],
            },
        )
        return body["messages"]

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
