from fastapi.testclient import TestClient

from minerva_mail_ml import __version__
from minerva_mail_ml.app import create_app
from minerva_mail_ml.config import read_config


def test_health_names_the_serving_feature_version(store) -> None:
    client = TestClient(create_app(read_config({}), store))
    assert client.get("/health").json() == {
        "status": "ok",
        "version": __version__,
        "featureVersion": None,
    }
    store.begin_version("v1", 8)
    store.complete("v1")
    assert client.get("/health").json()["featureVersion"] == "v1"


def test_metrics(store) -> None:
    client = TestClient(create_app(read_config({}), store))
    response = client.get("/metrics/")
    assert response.status_code == 200
    assert "python_info" in response.text


def test_the_plain_listener_takes_no_text(store) -> None:
    client = TestClient(create_app(read_config({}), store))
    assert client.post("/v1/features", json={}).status_code == 404
