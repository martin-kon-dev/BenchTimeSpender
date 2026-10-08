from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Activity(Base):
    __tablename__ = "activities"
    __table_args__ = (
        CheckConstraint("completion_percentage BETWEEN 0 AND 100"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(2000), default="")
    completion_percentage: Mapped[int] = mapped_column(default=0)


class TimeEntry(Base):
    __tablename__ = "time_entries"
    __table_args__ = (CheckConstraint("duration_seconds > 0"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id"))
    started_at: Mapped[int]
    duration_seconds: Mapped[int]
    source: Mapped[str] = mapped_column(String(10))


class RunningTimer(Base):
    __tablename__ = "running_timer"
    __table_args__ = (CheckConstraint("slot = 1"),)

    slot: Mapped[int] = mapped_column(primary_key=True, default=1)
    id: Mapped[str] = mapped_column(String(36), unique=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id"))
    started_at: Mapped[int]
