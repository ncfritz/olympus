import numpy as np

from minerva_mail_ml.features.featurize import (
    BODY_CHARS,
    N_FEATURES,
    MessageText,
    featurize,
    tokens,
)


def message(**overrides) -> MessageText:
    fields = {
        "subject": "Your bill for 10/2026",
        "text": "Your bill of $41.20 is due. Pay by Oct 20.",
        "from_address": "Billing@Mail.Power.example",
        "list_id": "News.Power.example",
        "has_list_unsubscribe": True,
        "attachment_extensions": ["PDF"],
    }
    return MessageText(**{**fields, **overrides})


def test_tokens_mark_where_each_word_came_from_and_set_numbers_aside() -> None:
    t = tokens(message())
    assert "s:your" in t and "s:bill" in t and "s:#" in t
    assert "b:due" in t and "b:#" in t
    assert "from:billing@mail.power.example" in t
    assert "domain:mail.power.example" in t
    assert "domain:power.example" in t
    assert "list:news.power.example" in t
    assert "hdr:unsubscribe" in t
    assert "att:pdf" in t and "att:any" in t
    # No token carries a number as written.
    assert not any(
        ch.isdigit() for tok in t for ch in tok.split(":", 1)[1] if tok[0] in "sb"
    )


def test_a_bare_message_has_no_header_tokens() -> None:
    t = tokens(
        message(
            subject=None,
            text=None,
            from_address=None,
            list_id=None,
            has_list_unsubscribe=False,
            attachment_extensions=[],
        )
    )
    assert t == []


def test_only_the_start_of_the_body_is_read() -> None:
    late = "x" * BODY_CHARS + " latecomer"
    assert "b:latecomer" not in tokens(message(text=late))


def test_a_row_of_counts_per_message() -> None:
    matrix = featurize([message(), message(subject="bill bill bill", text="")])
    assert matrix.shape == (2, N_FEATURES)
    assert np.all(matrix.data >= 1)
    # Three "bill"s in the second subject count three.
    assert 3.0 in matrix.getrow(1).data


def test_the_same_message_gives_the_same_row() -> None:
    a = featurize([message()])
    b = featurize([message()])
    assert (a != b).nnz == 0
