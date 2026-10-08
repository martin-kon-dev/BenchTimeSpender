from concurrent.futures import ThreadPoolExecutor


def create_activity(client, title="Python"):
    return client.post("/api/activities", json={"title": title, "category": "Learning"}).json()["id"]


def add_time(client, activity_id):
    return client.post("/api/time-entries", json={
        "activity_id": activity_id, "started_at": "2026-01-01T00:00:00Z", "duration_seconds": 60,
    })


def test_delete_removes_only_selected_activity_and_its_time(client):
    deleted = create_activity(client)
    kept = create_activity(client, "Portfolio")
    assert add_time(client, deleted).status_code == 201
    kept_entry = add_time(client, kept).json()
    response = client.delete(f"/api/activities/{deleted}")
    assert response.status_code == 204
    assert response.content == b""
    assert [activity["id"] for activity in client.get("/api/activities").json()] == [kept]
    assert client.get("/api/time-entries").json() == [kept_entry]
    assert client.delete(f"/api/activities/{deleted}").status_code == 404
    assert add_time(client, deleted).status_code == 404
    assert client.post("/api/timer/start", json={"activity_id": deleted}).status_code == 404


def test_delete_running_activity_is_blocked_until_timer_stops(client):
    activity_id = create_activity(client)
    timer = client.post("/api/timer/start", json={"activity_id": activity_id}).json()
    response = client.delete(f"/api/activities/{activity_id}")
    assert response.status_code == 409
    assert client.get("/api/timer").json() == timer
    assert len(client.get("/api/activities").json()) == 1
    assert client.post(f"/api/timer/{timer['id']}/stop").status_code == 200
    assert client.delete(f"/api/activities/{activity_id}").status_code == 204
    assert client.get("/api/time-entries").json() == []


def test_can_delete_another_activity_while_timer_runs(client):
    running = create_activity(client)
    deleted = create_activity(client, "Portfolio")
    timer = client.post("/api/timer/start", json={"activity_id": running}).json()
    assert client.delete(f"/api/activities/{deleted}").status_code == 204
    assert client.get("/api/timer").json() == timer


def test_concurrent_delete_and_start_cannot_leave_orphan_timer(client):
    activity_id = create_activity(client)
    with ThreadPoolExecutor(max_workers=2) as pool:
        start = pool.submit(client.post, "/api/timer/start", json={"activity_id": activity_id})
        delete = pool.submit(client.delete, f"/api/activities/{activity_id}")
    assert (start.result().status_code, delete.result().status_code) in {(201, 409), (404, 204)}
    saved = client.get("/api/activities").json()
    timer = client.get("/api/timer").json()
    assert (timer is None and saved == []) or (timer["activity_id"] == saved[0]["id"])


def test_concurrent_delete_and_manual_save_cannot_leave_orphan_entry(client):
    activity_id = create_activity(client)
    with ThreadPoolExecutor(max_workers=2) as pool:
        save = pool.submit(add_time, client, activity_id)
        delete = pool.submit(client.delete, f"/api/activities/{activity_id}")
    assert save.result().status_code in {201, 404}
    assert delete.result().status_code == 204
    assert client.get("/api/activities").json() == []
    assert client.get("/api/time-entries").json() == []
