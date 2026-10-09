"""A message's features: hashed word counts and header tokens.

Text is read here, in memory, and turned into counts of hashed tokens; the
text itself is not returned, kept or logged (ADR 0030). Hashing makes the
vector's width fixed (`N_FEATURES`) and needs no vocabulary, so a new word
needs no retraining to be counted, and a count cannot be read back into
the word.

Changing anything here that changes a vector is a new `FEATURE_VERSION`:
the store builds the new version beside the old, which serves until the
new one is complete.
"""

from __future__ import annotations

import re
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

import numpy as np
from scipy import sparse
from sklearn.feature_extraction.text import HashingVectorizer

FEATURE_VERSION = "v1"
N_FEATURES = 2**18
# The body read: its start says what a message is; the rest is mostly
# quoted replies, footers and legal text.
BODY_CHARS = 5000

_WORD = re.compile(r"[a-z0-9][a-z0-9'_-]{1,30}")
_DIGITS = re.compile(r"\d+")


@dataclass(frozen=True)
class MessageText:
    """What featurizing reads of one message. Lives only for the request."""

    subject: str | None
    text: str | None
    from_address: str | None
    list_id: str | None
    has_list_unsubscribe: bool
    attachment_extensions: Sequence[str]


def _words(text: str) -> list[str]:
    return [_DIGITS.sub("#", w) for w in _WORD.findall(text.lower())]


def tokens(message: MessageText) -> list[str]:
    """The message as tokens: subject and body words, and its headers."""
    out = [f"s:{w}" for w in _words(message.subject or "")]
    out += [f"b:{w}" for w in _words((message.text or "")[:BODY_CHARS])]
    if message.from_address:
        address = message.from_address.lower()
        out.append(f"from:{address}")
        if "@" in address:
            domain = address.rsplit("@", 1)[1]
            out.append(f"domain:{domain}")
            # The registrable part too (`mail.example.com` → `example.com`).
            parts = domain.split(".")
            if len(parts) > 2:
                out.append(f"domain:{'.'.join(parts[-2:])}")
    if message.list_id:
        out.append(f"list:{message.list_id.lower()}")
    if message.has_list_unsubscribe:
        out.append("hdr:unsubscribe")
    for extension in message.attachment_extensions:
        out.append(f"att:{extension.lower()}")
    if message.attachment_extensions:
        out.append("att:any")
    return out


_VECTORIZER = HashingVectorizer(
    analyzer=lambda doc: doc,
    n_features=N_FEATURES,
    alternate_sign=False,
    norm=None,
    dtype=np.float32,
)


def featurize(messages: Iterable[MessageText]) -> sparse.csr_matrix:
    """A row of token counts per message, in order."""
    return _VECTORIZER.transform([tokens(m) for m in messages]).tocsr()
