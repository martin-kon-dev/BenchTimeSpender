import time
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import get_session
from .models import Activity, RunningTimer, TimeEntry
from .schemas import ManualEntryCreate, TimeEntryRead, TimerRead, TimerStart

router = APIRouter(prefix="/api")
DatabaseSession = Annotated[Session, Depends(get_session)]


def require_activity(session: Session, activity_id: int):
    if session.get(Activity, activity_id) is None:
        raise HTTPException(404, "Activity not found.")


@router.get("/timer", response_model=TimerRead | None)
def get_timer(session: DatabaseSession):
    return session.get(RunningTimer, 1)


@router.post("/timer/start", response_model=TimerRead, status_code=201)
def start_timer(data: TimerStart, session: DatabaseSession):
    require_activity(session, data.activity_id)
    timer = RunningTimer(slot=1, id=str(uuid4()), activity_id=data.activity_id, started_at=int(time.time()))
    session.add(timer)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "A timer is already running. Stop it before starting another.")
    session.refresh(timer)
    return timer


@router.post("/timer/{timer_id}/stop", response_model=TimeEntryRead)
def stop_timer(timer_id: str, session: DatabaseSession):
    # Deleting and recording in one transaction prevents two stops creating duplicate entries.
    timer = session.execute(
        delete(RunningTimer).where(RunningTimer.id == timer_id)
        .returning(RunningTimer.activity_id, RunningTimer.started_at)
    ).first()
    if timer is None:
        raise HTTPException(404, "This timer is no longer running.")
    entry = TimeEntry(
        activity_id=timer.activity_id, started_at=timer.started_at,
        duration_seconds=max(1, int(time.time()) - timer.started_at), source="timer",
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


@router.get("/time-entries", response_model=list[TimeEntryRead])
def list_time_entries(session: DatabaseSession):
    return session.scalars(select(TimeEntry).order_by(TimeEntry.started_at.desc(), TimeEntry.id.desc())).all()


@router.post("/time-entries", response_model=TimeEntryRead, status_code=201)
def create_manual_entry(data: ManualEntryCreate, session: DatabaseSession):
    require_activity(session, data.activity_id)
    start = data.started_at.timestamp()
    if start + data.duration_seconds > time.time():
        raise HTTPException(422, "The entry must finish in the past.")
    entry = TimeEntry(
        activity_id=data.activity_id, started_at=int(start),
        duration_seconds=data.duration_seconds, source="manual",
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry
