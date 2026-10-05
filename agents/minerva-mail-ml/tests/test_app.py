from fastapi.testclient import TestClient

from minerva_mail_ml import __version__
from minerva_mail_ml.app import create_app
from minerva_mail_ml.config import read_config

client = TestClient(create_app(read_config({})))


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": __version__}


def test_metrics() -> None:
    response = client.get("/metrics/")
    assert response.status_code == 200
    assert "python_info" in response.text
