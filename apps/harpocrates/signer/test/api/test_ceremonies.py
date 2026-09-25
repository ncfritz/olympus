import time
from datetime import timedelta

from fastapi.testclient import TestClient

from harpocrates_signer.config import Config
from test.conftest import (
    EXPORT_PASSPHRASE,
    Hierarchy,
    build_hierarchy,
    ca_spec,
    csr_for,
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
