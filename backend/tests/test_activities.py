import pytest
from fastapi.testclient import TestClient

from app.main import create_app


def test_new_database_has_no_activities(client):
    response = client.get("/api/activities")
    assert response.status_code == 200
    assert response.json() == []


def test_create_and_list_activity(client):
    response = client.post("/api/activities", json={
        "title": " Learn Python ", "category": " Learning ", "description": " Practice FastAPI ",
    })
    assert response.status_code == 201
    activity = response.json()
    assert activity == {
        "id": 1, "title": "Learn Python", "category": "Learning",
        "description": "Practice FastAPI", "completion_percentage": 0,
    }
    assert client.get("/api/activities").json() == [activity]


@pytest.mark.parametrize("changes", [
    {"title": "   "}, {"category": ""}, {"title": "x" * 201},
    {"category": "x" * 101}, {"description": "x" * 2001},
    {"completion_percentage": -1}, {"completion_percentage": 101},
    {"completion_percentage": 1.5}, {"completion_percentage": True},
])
def test_invalid_activity_is_not_saved(client, changes):
    data = {"title": "Learning", "category": "Development", **changes}
    assert client.post("/api/activities", json=data).status_code == 422
    assert client.get("/api/activities").json() == []


def test_activities_survive_application_restart(tmp_path):
    database_url = f"sqlite:///{(tmp_path / 'persistent.db').as_posix()}"
    with TestClient(create_app(database_url)) as first_client:
        response = first_client.post("/api/activities", json={
            "title": "Portfolio", "category": "Personal project", "completion_percentage": 100,
        })
        assert response.status_code == 201
        saved = response.json()

    with TestClient(create_app(database_url)) as restarted_client:
        assert restarted_client.get("/api/activities").json() == [saved]
