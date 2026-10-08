import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client(tmp_path):
    application = create_app(f"sqlite:///{(tmp_path / 'test.db').as_posix()}")
    with TestClient(application) as test_client:
        yield test_client
