import time
from datetime import timedelta

from cryptography.x509.oid import ExtensionOID
from fastapi.testclient import TestClient

from harpocrates_signer.config import Config
from test.conftest import (
    EXPORT_PASSPHRASE,
    Hierarchy,
    build_hierarchy,
    ca_spec,
    csr_for,
    load,
    ok,
    open_client,
    spec,
)


def open_ceremony(client: TestClient, key: str, certificate: str):
    return client.post(
        "/v1/ceremonies",
        json={
            "privateKey": key,
            "passphrase": EXPORT_PASSPHRASE,
            "certificate": certificate,
        },
    )


def test_one_ceremony_at_a_time(unsealed: TestClient, hierarchy: Hierarchy):
    first = ok(open_ceremony(unsealed, hierarchy.root_key, hierarchy.root))
    assert (
        open_ceremony(unsealed, hierarchy.root_key, hierarchy.root).status_code == 409
    )
    assert ok(unsealed.get("/v1/ceremonies/current"), 200)["id"] == first["id"]
    ok(unsealed.delete(f"/v1/ceremonies/{first['id']}"), 204)
    assert unsealed.get("/v1/ceremonies/current").status_code == 404


def test_a_ceremony_signs_cas_not_leaves(unsealed: TestClient, hierarchy: Hierarchy):
    ceremony = ok(
        open_ceremony(unsealed, hierarchy.intermediate_key, hierarchy.intermediate)
    )
    _, csr = csr_for(["localhost"])
    response = unsealed.post(
        f"/v1/ceremonies/{ceremony['id']}/certificates",
        json=spec("CN=localhost", days=30, csr=csr),
    )
    assert response.status_code == 422
    assert response.json()["invariant"] == "ceremony"


def test_a_ceremony_keeps_path_lengths_below_its_own(
    unsealed: TestClient, hierarchy: Hierarchy
):
    ceremony = ok(
        open_ceremony(unsealed, hierarchy.intermediate_key, hierarchy.intermediate)
    )
    key = ok(unsealed.post("/v1/keys", json={"purpose": "issuer"}))
    response = unsealed.post(
        f"/v1/ceremonies/{ceremony['id']}/certificates",
        json=ca_spec("CN=Too Deep", 1, days=365, keyId=key["id"]),
    )
    assert response.status_code == 422
    assert response.json()["invariant"] == "path-length"


def test_an_issuing_ca_cannot_open_a_ceremony(
    unsealed: TestClient, hierarchy: Hierarchy
):
    # The issuing CA's key never leaves the store, so use a fresh issuing
    # certificate created in a ceremony instead.
    ceremony = ok(
        open_ceremony(unsealed, hierarchy.intermediate_key, hierarchy.intermediate)
    )
    issuing = ok(
        unsealed.post(
            f"/v1/ceremonies/{ceremony['id']}/cas",
            json={
                "certificate": ca_spec("CN=Leafy Issuing CA", 0, days=365),
                "exportPassphrase": EXPORT_PASSPHRASE,
            },
        )
    )
    ok(unsealed.delete(f"/v1/ceremonies/{ceremony['id']}"), 204)
    response = open_ceremony(unsealed, issuing["encryptedKey"], issuing["certificate"])
    assert response.status_code == 422
    assert response.json()["invariant"] == "ceremony"


def test_the_key_must_match_the_certificate(unsealed: TestClient, hierarchy: Hierarchy):
    response = open_ceremony(unsealed, hierarchy.root_key, hierarchy.intermediate)
    assert response.status_code == 422


def test_sealing_ends_the_ceremony(unsealed: TestClient, hierarchy: Hierarchy):
    ok(open_ceremony(unsealed, hierarchy.root_key, hierarchy.root))
    ok(unsealed.post("/v1/seal"), 204)
    assert ok(unsealed.get("/v1/status"), 200)["ceremony"] is None


def test_a_restart_ends_the_ceremony(
    config: Config, unsealed: TestClient, hierarchy: Hierarchy
):
    ok(open_ceremony(unsealed, hierarchy.root_key, hierarchy.root))
    unsealed.__exit__(None, None, None)
    with open_client(config) as restarted:
        assert ok(restarted.get("/v1/status"), 200)["ceremony"] is None


def test_a_ceremony_times_out(config: Config, unsealed: TestClient):
    hierarchy = build_hierarchy(unsealed)
    unsealed.__exit__(None, None, None)
    short = Config(**{**config.__dict__, "ceremony_timeout": timedelta(seconds=1)})
    with open_client(short) as client:
        ceremony = ok(open_ceremony(client, hierarchy.root_key, hierarchy.root))
        time.sleep(1.5)
        assert ok(client.get("/v1/status"), 200)["ceremony"] is None
        response = client.post(
            f"/v1/ceremonies/{ceremony['id']}/crls",
            json={
                "number": 1,
                "thisUpdate": "2026-09-25T00:00:00Z",
                "nextUpdate": "2026-10-25T00:00:00Z",
            },
        )
        assert response.status_code == 404


def test_a_ceremony_signs_its_own_list(unsealed: TestClient, hierarchy: Hierarchy):
    ceremony = ok(open_ceremony(unsealed, hierarchy.root_key, hierarchy.root))
    from datetime import UTC, datetime

    now = datetime.now(UTC)
    ok(
        unsealed.post(
            f"/v1/ceremonies/{ceremony['id']}/crls",
            json={
                "number": 1,
                "thisUpdate": now.isoformat(),
                "nextUpdate": (now + timedelta(days=395)).isoformat(),
            },
        )
    )


def test_a_root_needs_a_path_length(unsealed: TestClient):
    body = ca_spec("CN=Unbounded Root", 1, days=365)
    body["pathLength"] = None
    response = unsealed.post(
        "/v1/roots", json={"certificate": body, "exportPassphrase": EXPORT_PASSPHRASE}
    )
    assert response.status_code == 422


# ---- shapes (ADR 0032)


def make_root(client: TestClient, subject: str, path_length: int) -> dict[str, str]:
    return ok(
        client.post(
            "/v1/roots",
            json={
                "certificate": ca_spec(subject, path_length, days=7300),
                "exportPassphrase": EXPORT_PASSPHRASE,
            },
        )
    )


def test_a_two_tier_root_signs_issuing_cas_not_intermediates(unsealed: TestClient):
    root = make_root(unsealed, "CN=Two Tier Root CA 1", 1)
    ceremony = ok(open_ceremony(unsealed, root["encryptedKey"], root["certificate"]))
    key = ok(unsealed.post("/v1/keys", json={"purpose": "issuer"}))
    issuing = load(
        ok(
            unsealed.post(
                f"/v1/ceremonies/{ceremony['id']}/certificates",
                json=ca_spec("CN=Two Tier Issuing CA 1", 0, days=1825, keyId=key["id"]),
            )
        )["certificate"]
    )
    issuing.verify_directly_issued_by(load(root["certificate"]))
    other = ok(unsealed.post("/v1/keys", json={"purpose": "issuer"}))
    response = unsealed.post(
        f"/v1/ceremonies/{ceremony['id']}/certificates",
        json=ca_spec("CN=Two Tier Intermediate", 1, days=1825, keyId=other["id"]),
    )
    assert response.status_code == 422
    assert response.json()["invariant"] == "path-length"


def test_a_direct_root_opens_a_ceremony_and_signs_minimal_leaves(
    unsealed: TestClient,
):
    root = make_root(unsealed, "CN=Direct Root CA 1", 0)
    ceremony = ok(open_ceremony(unsealed, root["encryptedKey"], root["certificate"]))
    key = ok(unsealed.post("/v1/keys", json={"purpose": "subject"}))
    leaf = load(
        ok(
            unsealed.post(
                f"/v1/ceremonies/{ceremony['id']}/certificates",
                json=spec(
                    "CN=Bespoke Leaf 1",
                    days=365,
                    keyId=key["id"],
                    keyUsage=[],
                    extensions="minimal",
                ),
            )
        )["certificate"]
    )
    leaf.verify_directly_issued_by(load(root["certificate"]))
    assert [e.oid for e in leaf.extensions] == [
        ExtensionOID.SUBJECT_KEY_IDENTIFIER,
        ExtensionOID.AUTHORITY_KEY_IDENTIFIER,
    ]
    assert leaf.signature_hash_algorithm is not None
    assert leaf.signature_hash_algorithm.name == "sha256"


def test_a_direct_root_signs_no_ca(unsealed: TestClient):
    root = make_root(unsealed, "CN=Direct Root CA 2", 0)
    ceremony = ok(open_ceremony(unsealed, root["encryptedKey"], root["certificate"]))
    key = ok(unsealed.post("/v1/keys", json={"purpose": "issuer"}))
    response = unsealed.post(
        f"/v1/ceremonies/{ceremony['id']}/certificates",
        json=ca_spec("CN=Below Direct", 0, days=365, keyId=key["id"]),
    )
    assert response.status_code == 422
    assert response.json()["invariant"] == "ceremony"


def test_a_direct_root_signs_no_issuer_key(unsealed: TestClient):
    root = make_root(unsealed, "CN=Direct Root CA 3", 0)
    ceremony = ok(open_ceremony(unsealed, root["encryptedKey"], root["certificate"]))
    key = ok(unsealed.post("/v1/keys", json={"purpose": "issuer"}))
    response = unsealed.post(
        f"/v1/ceremonies/{ceremony['id']}/certificates",
        json=spec("CN=Leaf With Issuer Key", days=30, keyId=key["id"]),
    )
    assert response.status_code == 422
    assert response.json()["invariant"] == "subject-key"


def test_a_direct_leaf_stays_inside_the_root(unsealed: TestClient):
    root = make_root(unsealed, "CN=Direct Root CA 4", 0)
    ceremony = ok(open_ceremony(unsealed, root["encryptedKey"], root["certificate"]))
    key = ok(unsealed.post("/v1/keys", json={"purpose": "subject"}))
    response = unsealed.post(
        f"/v1/ceremonies/{ceremony['id']}/certificates",
        json=spec("CN=Too Long", days=7400, keyId=key["id"]),
    )
    assert response.status_code == 422
    assert response.json()["invariant"] == "validity"


def test_minimal_extensions_refuse_anything_else(unsealed: TestClient):
    root = make_root(unsealed, "CN=Direct Root CA 5", 0)
    ceremony = ok(open_ceremony(unsealed, root["encryptedKey"], root["certificate"]))
    key = ok(unsealed.post("/v1/keys", json={"purpose": "subject"}))
    response = unsealed.post(
        f"/v1/ceremonies/{ceremony['id']}/certificates",
        json=spec(
            "CN=Minimal With Usage",
            days=30,
            keyId=key["id"],
            extensions="minimal",
        ),
    )
    assert response.status_code == 400
    assert "keyUsage" in response.json()["message"]
