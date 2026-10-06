"""The API, as the classifier calls it: its services listener, with the
classifier's client certificate. Metadata and labels come from here; the
service never reads Hasura (ADR 0030).
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
            base_url=config.base_url + "/minerva/mail/training",
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

    def accounts(self) -> list[Account]:
        body = self._get("/accounts")
        return [Account(id=a["id"], email=a["email"]) for a in body["accounts"]]

    def examples(self, account_id: str, page: int = PAGE) -> Iterator[Example]:
        """Every message of the account, by Gmail ID, a page at a time."""
        after: str | None = None
        while True:
            params: dict = {"accountId": account_id, "limit": page}
            if after is not None:
                params["after"] = after
            body = self._get("/examples", params)
            for raw in body["examples"]:
                yield _example(raw)
            after = body.get("nextCursor")
            if after is None:
                return

    def labels(self, account_id: str) -> Labels:
        body = self._get("/labels", {"accountId": account_id})
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
