import pytest
from fastapi.testclient import TestClient

from server.interfaces.http.app import create_app
from server.infrastructure.config.settings import get_settings


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("CHAT_BROKER_ENABLED", "false")
    get_settings.cache_clear()
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client
