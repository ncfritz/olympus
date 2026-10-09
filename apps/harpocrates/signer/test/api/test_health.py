from fastapi.testclient import TestClient

from harpocrates_signer.app import create_app


def test_health_answers_ok():
    response = TestClient(create_app()).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_no_documentation_is_served():
    client = TestClient(create_app())
    for route in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(route).status_code == 404
