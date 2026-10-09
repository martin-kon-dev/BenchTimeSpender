from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Response
from sqlalchemy import create_engine, delete, event, select
from sqlalchemy.orm import Session

from .database import Base, get_session
from .models import Activity, RunningTimer, TimeEntry
from .schemas import ActivityCreate, ActivityRead
from .schemas import ActivityUpdate
from .categories import router as categories_router, require_category, legacy_category
from .migrations import migrate
from .tracking import router as tracking_router


def create_app(database_url: str | None = None) -> FastAPI:
    database_path = Path(__file__).resolve().parents[1] / "benchtime.db"
    engine = create_engine(
        database_url or f"sqlite:///{database_path.as_posix()}",
        connect_args={"check_same_thread": False},
    )

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        migrate(engine)
        try:
            yield
        finally:
            engine.dispose()

    @event.listens_for(engine, "connect")
    def enable_foreign_keys(connection, _record):
        cursor = connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    application = FastAPI(title="BenchTimeSpender", lifespan=lifespan)
    application.state.engine = engine
    application.include_router(tracking_router)
    application.include_router(categories_router)

    @application.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "message": "BenchTimeSpender API is ready."}

    @application.get("/api/activities", response_model=list[ActivityRead])
    def list_activities(session: Annotated[Session, Depends(get_session)]):
        return session.scalars(select(Activity).order_by(Activity.id)).all()

    @application.post("/api/activities", response_model=ActivityRead, status_code=201)
    def create_activity(data: ActivityCreate, session: Annotated[Session, Depends(get_session)]):
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        category = require_category(session, data.category_id) if "category_id" in data.model_fields_set else legacy_category(session, data.category)
        activity = Activity(title=data.title, description=data.description, completion_percentage=data.completion_percentage,
                            category_id=category.id if category else None, category=category.name if category else "Uncategorized")
        session.add(activity)
        session.commit()
        session.refresh(activity)
        return activity

    @application.patch("/api/activities/{activity_id}", response_model=ActivityRead)
    def edit_activity(activity_id: int, data: ActivityUpdate, session: Annotated[Session, Depends(get_session)]):
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        activity = session.get(Activity, activity_id)
        if activity is None:
            raise HTTPException(404, "Activity not found.")
        changes = data.model_dump(exclude_unset=True)
        if any(changes.get(key) is None for key in ("title", "description", "completion_percentage") if key in changes):
            raise HTTPException(422, "Title, description and completion cannot be null.")
        if "category_id" in changes:
            category = require_category(session, data.category_id)
            activity.category = category.name if category else "Uncategorized"
        if changes.get("completion_percentage") == 100 and session.scalar(select(RunningTimer).where(RunningTimer.activity_id == activity_id)):
            raise HTTPException(409, "Stop and save the timer before completing this activity.")
        for key, value in changes.items():
            setattr(activity, key, value)
        session.commit()
        return activity

    @application.delete("/api/activities/{activity_id}", status_code=204)
    def delete_activity(activity_id: int, session: Annotated[Session, Depends(get_session)]):
        # Reserve the SQLite write transaction before checking the timer. Concurrent
        # timer starts and manual entries must wait until deletion commits.
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        activity = session.get(Activity, activity_id)
        if activity is None:
            raise HTTPException(404, "Activity not found.")
        if session.scalar(select(RunningTimer).where(RunningTimer.activity_id == activity_id)):
            raise HTTPException(409, "Stop and save the timer before deleting this activity.")
        session.execute(delete(TimeEntry).where(TimeEntry.activity_id == activity_id))
        session.delete(activity)
        session.commit()
        return Response(status_code=204)

    return application


app = create_app()
