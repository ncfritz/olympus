"""The little DER the signer reads and writes itself: a custom extension's
value checked as one element, a key's subjectPublicKey bits for RFC 7093's
key identifier, and a UTF8String for a UPN."""


def element(data: bytes, offset: int = 0) -> tuple[int, int, int]:
    """The element at `offset`: its tag, where its content starts, and
    where it ends. Raises ValueError for anything malformed or past the
    end (definite lengths only, as DER requires)."""
    if offset + 2 > len(data):
        raise ValueError("truncated")
    tag = data[offset]
    if tag & 0x1F == 0x1F:
        raise ValueError("multi-byte tags are not supported")
    first = data[offset + 1]
    start = offset + 2
    if first < 0x80:
        length = first
    else:
        count = first & 0x7F
        if count == 0 or count > 4 or start + count > len(data):
            raise ValueError("bad length")
        length = int.from_bytes(data[start : start + count], "big")
        if length < 0x80 or data[start] == 0:
            raise ValueError("length not minimally encoded")
        start += count
    end = start + length
    if end > len(data):
        raise ValueError("truncated")
    return tag, start, end


def is_one_element(data: bytes) -> bool:
    """Whether `data` is exactly one well-formed DER element."""
    try:
        _, _, end = element(data)
    except ValueError:
        return False
    return end == len(data)


def subject_public_key_bits(spki: bytes) -> bytes:
    """The subjectPublicKey BIT STRING's bits from a SubjectPublicKeyInfo:
    what RFC 5280 and RFC 7093 hash for a key identifier."""
    _, content, _ = element(spki)
    _, _, algorithm_end = element(spki, content)
    tag, bits_start, bits_end = element(spki, algorithm_end)
    if tag != 0x03:
        raise ValueError("no subjectPublicKey")
    return spki[bits_start + 1 : bits_end]


def utf8_string(value: str) -> bytes:
    encoded = value.encode("utf-8")
    return bytes([0x0C]) + _length(len(encoded)) + encoded


def _length(length: int) -> bytes:
    if length < 0x80:
        return bytes([length])
    raw = length.to_bytes((length.bit_length() + 7) // 8, "big")
    return bytes([0x80 | len(raw)]) + raw
