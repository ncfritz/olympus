"""A synthetic mailbox: invented senders, words and labels, never real mail.

Four years of mail, a message every ~6 hours, from senders that each
write about one thing:

- power and water bills, labelled `Bills/*Paid` once old and
  `Bills/*Payable` when recent (the Bills family), and also
  `Finance/Utilities`;
- a newsletter list (`Reading`);
- travel bookings (`Travel`), from several domains;
- unlabelled noise.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import numpy as np

from minerva_mail_ml.features.featurize import (
    FEATURE_VERSION,
    N_FEATURES,
    MessageText,
    featurize,
)
from minerva_mail_ml.features.store import FeatureStore
from minerva_mail_ml.olympus_api import Example, Family, Labels

ACCOUNT = "7b2b0000-0000-4000-8000-000000000001"
START = datetime(2022, 10, 1, tzinfo=UTC)

LABELS = Labels(
    topics=("Finance/Utilities", "Reading", "Travel", "Unused"),
    families=(
        Family(
            name="Bills",
            initial_label="Bills/*Payable",
            states=("Bills/*Paid", "Bills/*Payable"),
        ),
    ),
)

KINDS = {
    "bill": (
        ["billing@power.example", "billing@water.example"],
        None,
        "your bill statement amount due kilowatt usage autopay account",
    ),
    "news": (
        ["digest@letters.example"],
        "weekly.letters.example",
        "this week essay reading longform links subscribe issue",
    ),
    "travel": (
        ["trips@air.example", "stay@hotel.example", "go@rail.example"],
        None,
        "booking confirmation itinerary flight departure reservation check-in",
    ),
    "noise": (
        ["friend@home.example", "shop@store.example", "hello@app.example"],
        None,
        "hello catch up weekend sale offer update notice photos",
    ),
}
FILLER = [
    "the",
    "and",
    "a",
    "of",
    "to",
    "in",
    "is",
    "for",
    "on",
    "with",
    "as",
    "at",
    "by",
    "from",
    "it",
    "that",
    "this",
]


def mailbox(n: int = 6000, seed: int = 7) -> tuple[list[Example], list]:
    """(examples, [(gmail_id, MessageText, received, from, list)])."""
    rng = np.random.default_rng(seed)
    kinds = list(KINDS)
    examples, texts = [], []
    end = START + timedelta(hours=6 * n)
    for i in range(n):
        kind = kinds[rng.choice(4, p=[0.2, 0.25, 0.15, 0.4])]
        senders, list_id, words = KINDS[kind]
        sender = senders[rng.integers(len(senders))]
        received = START + timedelta(hours=6 * i)
        vocab = words.split()
        body = " ".join([*rng.choice(vocab, 12), *rng.choice(FILLER, 20)])
        gmail_id = f"{0x19A000000000000 + i:x}"
        topics: tuple[str, ...] = ()
        families: tuple[str, ...] = ()
        if kind == "bill":
            topics = ("Finance/Utilities",)
            families = ("Bills",)
        elif kind == "news":
            topics = ("Reading",)
        elif kind == "travel":
            topics = ("Travel",)
        examples.append(
            Example(
                gmail_id=gmail_id,
                thread_id=gmail_id,
                received=received,
                from_address=sender,
                list_id=list_id,
                sent=False,
                topics=topics,
                families=families,
            )
        )
        texts.append(
            (
                gmail_id,
                MessageText(
                    subject=" ".join(rng.choice(vocab, 3)),
                    text=body,
                    from_address=sender,
                    list_id=list_id,
                    has_list_unsubscribe=list_id is not None,
                    attachment_extensions=["pdf"] if kind == "bill" else [],
                ),
                received,
                sender,
                list_id,
            )
        )
    assert examples[-1].received < end
    return examples, texts


def fill(store: FeatureStore, texts: list, account: str = ACCOUNT) -> None:
    store.begin_version(FEATURE_VERSION, N_FEATURES)
    for start in range(0, len(texts), 500):
        batch = texts[start : start + 500]
        store.put(
            FEATURE_VERSION,
            account,
            [(g, r.isoformat(), f, li) for g, _, r, f, li in batch],
            featurize([t for _, t, _, _, _ in batch]),
        )
    store.complete(FEATURE_VERSION)
