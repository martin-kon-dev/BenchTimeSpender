"""Additive SQLite migration; the pre-migration backup is the restoration path."""
from pathlib import Path
import sqlite3

from sqlalchemy import inspect, text

from .database import Base

COLORS = {"work": "#8b5cf6", "learning": "#f97316", "health": "#14b8a6", "personal": "#3b82f6"}


def migrate(engine):
    existing = inspect(engine).has_table("activities")
    columns = {c["name"] for c in inspect(engine).get_columns("activities")} if existing else set()
    if existing and "category_id" not in columns and engine.url.database:
        database = Path(engine.url.database)
        backup = database.with_name(database.name + ".pre-redesign-v1.bak")
        if database.is_file() and not backup.exists():
            with sqlite3.connect(database) as source, sqlite3.connect(backup) as destination:
                source.backup(destination)
    Base.metadata.create_all(engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("BEGIN IMMEDIATE")
        connection.exec_driver_sql("CREATE TABLE IF NOT EXISTS schema_versions (version INTEGER PRIMARY KEY)")
        if connection.scalar(text("SELECT version FROM schema_versions WHERE version = 1")):
            return
        if "category_id" not in {c["name"] for c in inspect(connection).get_columns("activities")}:
            connection.exec_driver_sql("ALTER TABLE activities ADD COLUMN category_id INTEGER REFERENCES categories(id)")
        if "note" not in {c["name"] for c in inspect(connection).get_columns("time_entries")}:
            connection.exec_driver_sql("ALTER TABLE time_entries ADD COLUMN note VARCHAR(2000) NOT NULL DEFAULT ''")
        rows = connection.execute(text("SELECT id, category FROM activities")).all()
        for activity_id, legacy_name in rows:
            name = legacy_name.strip()
            if not name or name.casefold() == "uncategorized":
                continue
            key = name.casefold()
            category_id = connection.scalar(text("SELECT id FROM categories WHERE name_key=:key"), {"key": key})
            if category_id is None:
                category_id = connection.execute(text(
                    "INSERT INTO categories(name,name_key,color,version) VALUES (:name,:key,:color,1) RETURNING id"
                ), {"name": name, "key": key, "color": COLORS.get(key, "#8b5cf6")}).scalar_one()
            connection.execute(text("UPDATE activities SET category_id=:category_id WHERE id=:id"),
                               {"category_id": category_id, "id": activity_id})
        connection.execute(text("INSERT INTO schema_versions(version) VALUES (1)"))
