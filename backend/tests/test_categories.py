import sqlite3
from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient
from app.main import create_app


def category(client, name="Work"):
    response = client.post('/api/categories', json={'name': name, 'color': '#8b5cf6'})
    assert response.status_code == 201
    return response.json()


def test_category_rename_retains_id_and_updates_activities(client):
    original = category(client)
    activity = client.post('/api/activities', json={'title': 'Portfolio', 'category_id': original['id']}).json()
    changed = client.put(f"/api/categories/{original['id']}", json={'name': ' Projects ', 'color': '#3b82f6', 'expected_version': 1})
    assert changed.status_code == 200
    assert changed.json() == {**original, 'name': 'Projects', 'color': '#3b82f6', 'version': 2, 'activity_count': 1}
    updated = client.get('/api/activities').json()[0]
    assert updated == {**activity, 'category': 'Projects'}
    assert client.post('/api/categories', json={'name': 'projects', 'color': '#ffffff'}).status_code == 409
    assert client.put(f"/api/categories/{original['id']}", json={'name': 'Stale', 'color': '#ffffff', 'expected_version': 1}).status_code == 409


def test_reassignment_keeps_history_notes_activity_and_running_timer(client):
    source, target = category(client), category(client, 'Learning')
    activity = client.post('/api/activities', json={'title': 'Python', 'category_id': source['id'], 'completion_percentage': 40}).json()
    entry = client.post('/api/time-entries', json={'activity_id': activity['id'], 'started_at': '2026-01-01T10:00:00Z', 'duration_seconds': 1800, 'note': 'Original note'}).json()
    timer = client.post('/api/timer/start', json={'activity_id': activity['id']}).json()
    response = client.request('DELETE', f"/api/categories/{source['id']}", json={'reassign_to': target['id'], 'expected_version': 1, 'expected_activity_count': 1})
    assert response.status_code == 204
    assert client.get('/api/activities').json() == [{**activity, 'category_id': target['id'], 'category': target['name']}]
    assert client.get('/api/time-entries').json() == [entry]
    assert client.get('/api/timer').json() == timer


def test_delete_requires_explicit_valid_destination_and_current_count(client):
    source = category(client)
    activity = client.post('/api/activities', json={'title': 'Python', 'category_id': source['id']}).json()
    url = f"/api/categories/{source['id']}"
    data = {'expected_version': 1, 'expected_activity_count': 1}
    assert client.request('DELETE', url, json=data).status_code == 422
    assert client.request('DELETE', url, json={**data, 'reassign_to': source['id']}).status_code == 422
    assert client.request('DELETE', url, json={**data, 'reassign_to': 999}).status_code == 404
    assert client.request('DELETE', url, json={**data, 'reassign_to': None, 'expected_activity_count': 0}).status_code == 409
    assert client.get('/api/activities').json() == [activity]
    assert client.request('DELETE', url, json={**data, 'reassign_to': None}).status_code == 204
    assert client.get('/api/activities').json() == [{**activity, 'category_id': None, 'category': 'Uncategorized'}]


def test_concurrent_case_insensitive_creates_only_one_category(client):
    with ThreadPoolExecutor(max_workers=2) as pool:
        codes = list(pool.map(lambda name: client.post('/api/categories', json={'name': name, 'color': '#8b5cf6'}).status_code, ['Work', 'work']))
    assert sorted(codes) == [201, 409]


def test_category_validation_and_protected_fallback(client):
    for name in [' ', 'Uncategorized', 'UNCATEGORIZED']:
        assert client.post('/api/categories', json={'name': name, 'color': '#ffffff'}).status_code == 422
    assert client.post('/api/categories', json={'name': 'Work', 'color': 'invalid'}).status_code == 422


def test_edit_complete_reopen_preserves_time_and_blocks_active_timer(client):
    activity = client.post('/api/activities', json={'title': 'Python'}).json()
    url = f"/api/activities/{activity['id']}"
    timer = client.post('/api/timer/start', json={'activity_id': activity['id']}).json()
    assert client.patch(url, json={'completion_percentage': 100}).status_code == 409
    entry = client.post(f"/api/timer/{timer['id']}/stop").json()
    assert client.patch(url, json={'title': 'Renamed', 'completion_percentage': 100}).status_code == 200
    assert client.post('/api/timer/start', json={'activity_id': activity['id']}).status_code == 409
    assert client.patch(url, json={'completion_percentage': 0}).status_code == 200
    assert client.get('/api/time-entries').json() == [entry]
    assert client.patch(url, json={'title': None}).status_code == 422


def test_existing_database_migrates_once_with_ids_history_and_backup_intact(tmp_path):
    database = tmp_path / 'legacy.db'
    with sqlite3.connect(database) as connection:
        connection.executescript('''
          CREATE TABLE activities (id INTEGER PRIMARY KEY, title VARCHAR(200) NOT NULL, category VARCHAR(100) NOT NULL, description VARCHAR(2000) NOT NULL, completion_percentage INTEGER NOT NULL);
          CREATE TABLE time_entries (id INTEGER PRIMARY KEY, activity_id INTEGER NOT NULL REFERENCES activities(id), started_at INTEGER NOT NULL, duration_seconds INTEGER NOT NULL, source VARCHAR(10) NOT NULL);
          CREATE TABLE running_timer (slot INTEGER PRIMARY KEY, id VARCHAR(36) NOT NULL, activity_id INTEGER NOT NULL REFERENCES activities(id), started_at INTEGER NOT NULL);
          INSERT INTO activities VALUES(7,'Python','Learning','Keep description',65),(9,'Portfolio','learning','',100),(11,'Other','Uncategorized','',0);
          INSERT INTO time_entries VALUES(22,7,1700000000,1800,'manual'),(24,9,1700003600,1200,'timer');
        ''')
    url = f"sqlite:///{database.as_posix()}"
    with TestClient(create_app(url)) as first:
        activities = first.get('/api/activities').json()
        entries = first.get('/api/time-entries').json()
        assert [a['id'] for a in activities] == [7,9,11]
        assert activities[0]['completion_percentage'] == 65
        assert activities[0]['description'] == 'Keep description'
        assert activities[0]['category_id'] == activities[1]['category_id']
        assert activities[2]['category_id'] is None
        assert len(first.get('/api/categories').json()) == 1
        assert sorted(e['id'] for e in entries) == [22,24]
        assert sum(e['duration_seconds'] for e in entries) == 3000
        assert all(e['note'] == '' for e in entries)
    backup = database.with_name('legacy.db.pre-redesign-v1.bak')
    assert backup.is_file()
    with sqlite3.connect(backup) as saved:
        assert saved.execute('SELECT COUNT(*), SUM(duration_seconds) FROM time_entries').fetchone() == (2,3000)
        assert 'category_id' not in [row[1] for row in saved.execute('PRAGMA table_info(activities)')]
    with TestClient(create_app(url)) as restarted:
        assert restarted.get('/api/activities').json() == activities
        assert restarted.get('/api/time-entries').json() == entries
    with sqlite3.connect(database) as saved:
        assert saved.execute('SELECT version FROM schema_versions').fetchall() == [(1,)]
