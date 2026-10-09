from fastapi.testclient import TestClient

from harpocrates_signer.config import Config
from test.conftest import PASSPHRASE, Hierarchy, csr_for, ok, open_client, spec


def test_every_route_but_health_needs_the_token(client: TestClient):
    del client.headers["Authorization"]
    assert client.get("/health").status_code == 200
    for method, route in [
        ("GET", "/v1/status"),
        ("POST", "/v1/seal"),
        ("POST", "/v1/keys"),
        ("GET", "/v1/ceremonies/current"),
    ]:
        response = client.request(method, route)
        assert response.status_code == 401, route
        assert response.json()["error"] == "unauthorized"


def test_status_before_and_after_initialising(client: TestClient):
    assert ok(client.get("/v1/status"), 200) == {
        "initialised": False,
        "sealed": True,
        "reason": "uninitialised",
        "ceremony": None,
        "keys": 0,
    }
    key = ok(client.post("/v1/initialise", json={"passphrase": PASSPHRASE}))
    assert len(key["unsealKey"]) == 44
    status = ok(client.get("/v1/status"), 200)
    assert status["initialised"] and not status["sealed"]
    assert (
        client.post("/v1/initialise", json={"passphrase": PASSPHRASE}).status_code
        == 409
    )


def test_nothing_signs_while_sealed(hierarchy: Hierarchy, unsealed: TestClient):
    ok(unsealed.post("/v1/seal"), 204)
    _, csr = csr_for(["localhost"])
    response = unsealed.post(
        f"/v1/issuers/{hierarchy.issuer_id}/certificates",
        json=spec("CN=localhost", days=30, csr=csr),
    )
    assert response.status_code == 503
    assert response.json()["error"] == "sealed"
    assert unsealed.post("/v1/keys", json={"purpose": "subject"}).status_code == 503
    # Read-only still answers.
    assert unsealed.get(f"/v1/issuers/{hierarchy.issuer_id}").status_code == 200


def test_a_deliberate_seal_survives_a_restart(config: Config, unsealed: TestClient):
    ok(unsealed.post("/v1/seal"), 204)
    unsealed.__exit__(None, None, None)
    with open_client(config) as restarted:
        assert ok(restarted.get("/v1/status"), 200)["reason"] == "deliberate"
        assert (
            restarted.post("/v1/unseal", json={"passphrase": "the wrong passphrase"})
        ).status_code == 403
        ok(restarted.post("/v1/unseal", json={"passphrase": PASSPHRASE}), 204)
        assert not ok(restarted.get("/v1/status"), 200)["sealed"]


def test_restarting_unseals_with_the_unseal_key(config: Config, unsealed: TestClient):
    unsealed.__exit__(None, None, None)
    with open_client(config) as restarted:
        assert not ok(restarted.get("/v1/status"), 200)["sealed"]
    assert config.unseal_key_file is not None
    config.unseal_key_file.unlink()
    with open_client(config) as restarted:
        assert ok(restarted.get("/v1/status"), 200)["reason"] == "no-unseal-key"


def test_malformed_requests_answer_400_in_the_error_shape(unsealed: TestClient):
    response = unsealed.post("/v1/keys", json={"purpose": "nobody"})
    assert response.status_code == 400
    assert response.json()["error"] == "bad-request"
