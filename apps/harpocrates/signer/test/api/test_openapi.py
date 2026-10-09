import json
from pathlib import Path

from harpocrates_signer.__main__ import write_openapi
from harpocrates_signer.app import create_app

COMMITTED = Path(__file__).parents[2] / "openapi" / "signer.json"


def test_the_committed_document_is_current():
    assert json.loads(COMMITTED.read_text()) == create_app().openapi()


def test_health_is_left_out():
    assert "/health" not in create_app().openapi()["paths"]


def test_writes_the_document_as_the_node_services_do(tmp_path: Path):
    written = write_openapi(tmp_path).read_text()
    assert written.endswith("}\n")
    assert written.startswith('{\n  "openapi"')
