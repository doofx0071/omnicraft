from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_get_health_returns_ok():
    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert isinstance(body["uptime"], float)
    assert isinstance(body["timestamp"], str)
