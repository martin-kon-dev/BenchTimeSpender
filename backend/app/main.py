from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from .database import Base, get_session
from .models import Activity
from .schemas import ActivityCreate, ActivityRead
from .tracking import router as tracking_router


def create_app(database_url: str | None = None) -> FastAPI:
    database_path = Path(__file__).resolve().parents[1] / "benchtime.db"
    engine = create_engine(
        database_url or f"sqlite:///{database_path.as_posix()}",
        connect_args={"check_same_thread": False},
    )

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        Base.metadata.create_all(engine)
        try:
            yield
        finally:
            engine.dispose()

    application = FastAPI(title="BenchTimeSpender", lifespan=lifespan)
    application.state.engine = engine
    application.include_router(tracking_router)

    @application.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "message": "BenchTimeSpender API is ready."}

    @application.get("/api/activities", response_model=list[ActivityRead])
    def list_activities(session: Annotated[Session, Depends(get_session)]):
        return session.scalars(select(Activity).order_by(Activity.id)).all()

    @application.post("/api/activities", response_model=ActivityRead, status_code=201)
    def create_activity(data: ActivityCreate, session: Annotated[Session, Depends(get_session)]):
        activity = Activity(**data.model_dump())
        session.add(activity)
        session.commit()
        session.refresh(activity)
        return activity

    return application


app = create_app()
