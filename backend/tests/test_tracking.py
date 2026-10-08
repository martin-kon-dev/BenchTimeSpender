from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def activity_id(client):
    return client.post('/api/activities', json={'title': 'Python', 'category': 'Learning'}).json()['id']


def test_timer_start_restore_stop(client, activity_id, monkeypatch):
    monkeypatch.setattr('app.tracking.time.time', lambda: 1000)
    assert client.get('/api/timer').json() is None
    started = client.post('/api/timer/start', json={'activity_id': activity_id})
    assert started.status_code == 201
    timer = started.json()
    assert timer['started_at'] == 1000
    assert client.get('/api/timer').json() == timer
    assert client.post('/api/timer/start', json={'activity_id': activity_id}).status_code == 409

    monkeypatch.setattr('app.tracking.time.time', lambda: 1090)
    stopped = client.post(f"/api/timer/{timer['id']}/stop")
    assert stopped.status_code == 200
    assert stopped.json()['duration_seconds'] == 90
    assert stopped.json()['source'] == 'timer'
    assert client.get('/api/timer').json() is None
    assert client.post(f"/api/timer/{timer['id']}/stop").status_code == 404
    assert client.get('/api/time-entries').json() == [stopped.json()]


def test_stale_stop_does_not_stop_new_timer(client, activity_id):
    old = client.post('/api/timer/start', json={'activity_id': activity_id}).json()
    client.post(f"/api/timer/{old['id']}/stop")
    new = client.post('/api/timer/start', json={'activity_id': activity_id}).json()
    assert client.post(f"/api/timer/{old['id']}/stop").status_code == 404
    assert client.get('/api/timer').json() == new


def test_concurrent_start_allows_only_one_timer(client, activity_id):
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: client.post('/api/timer/start', json={'activity_id': activity_id}).status_code, range(2)))
    assert sorted(results) == [201, 409]


def test_concurrent_stop_records_once(client, activity_id):
    timer = client.post('/api/timer/start', json={'activity_id': activity_id}).json()
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: client.post(f"/api/timer/{timer['id']}/stop").status_code, range(2)))
    assert sorted(results) == [200, 404]
    assert len(client.get('/api/time-entries').json()) == 1


def test_manual_entry_normalizes_timezone(client, activity_id):
    response = client.post('/api/time-entries', json={
        'activity_id': activity_id, 'started_at': '2026-01-01T10:00:00+02:00', 'duration_seconds': 1800,
    })
    assert response.status_code == 201
    entry = response.json()
    assert entry['started_at'] == int(datetime(2026, 1, 1, 8, tzinfo=timezone.utc).timestamp())
    assert entry['duration_seconds'] == 1800
    assert entry['source'] == 'manual'
    assert client.get('/api/time-entries').json() == [entry]


@pytest.mark.parametrize('changes', [
    {'duration_seconds': 0}, {'duration_seconds': -1}, {'duration_seconds': 86401},
    {'duration_seconds': 1.5}, {'duration_seconds': True},
    {'started_at': '2026-01-01T10:00:00'}, {'started_at': 'not-a-date'},
    {'started_at': '2099-01-01T00:00:00Z'},
])
def test_invalid_manual_entries_are_not_saved(client, activity_id, changes):
    data = {'activity_id': activity_id, 'started_at': '2026-01-01T00:00:00Z', 'duration_seconds': 60, **changes}
    assert client.post('/api/time-entries', json=data).status_code == 422
    assert client.get('/api/time-entries').json() == []


def test_manual_entry_must_finish_in_past(client, activity_id, monkeypatch):
    monkeypatch.setattr('app.tracking.time.time', lambda: 2000)
    response = client.post('/api/time-entries', json={
        'activity_id': activity_id, 'started_at': '1970-01-01T00:30:00Z', 'duration_seconds': 300,
    })
    assert response.status_code == 422


def test_unknown_activity_is_rejected(client):
    assert client.post('/api/timer/start', json={'activity_id': 99}).status_code == 404
    assert client.post('/api/time-entries', json={
        'activity_id': 99, 'started_at': '2026-01-01T00:00:00Z', 'duration_seconds': 60,
    }).status_code == 404


def test_timer_survives_restart(tmp_path, monkeypatch):
    database_url = f"sqlite:///{(tmp_path / 'timer.db').as_posix()}"
    monkeypatch.setattr('app.tracking.time.time', lambda: 1000)
    with TestClient(create_app(database_url)) as first:
        activity = first.post('/api/activities', json={'title': 'Python', 'category': 'Learning'}).json()
        timer = first.post('/api/timer/start', json={'activity_id': activity['id']}).json()
    monkeypatch.setattr('app.tracking.time.time', lambda: 1300)
    with TestClient(create_app(database_url)) as restarted:
        assert restarted.get('/api/timer').json() == timer
        entry = restarted.post(f"/api/timer/{timer['id']}/stop").json()
        assert entry['duration_seconds'] == 300
    with TestClient(create_app(database_url)) as final:
        assert final.get('/api/timer').json() is None
        assert final.get('/api/time-entries').json() == [entry]
