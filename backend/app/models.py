from sqlalchemy import CheckConstraint, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Category(Base):
    __tablename__ = "categories"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    name_key: Mapped[str] = mapped_column(String(200), unique=True)
    color: Mapped[str] = mapped_column(String(7))
    version: Mapped[int] = mapped_column(default=1)


class Activity(Base):
    __tablename__ = "activities"
    __table_args__ = (
        CheckConstraint("completion_percentage BETWEEN 0 AND 100"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"), nullable=True)
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
    note: Mapped[str] = mapped_column(String(2000), default="")


class RunningTimer(Base):
    __tablename__ = "running_timer"
    __table_args__ = (CheckConstraint("slot = 1"),)

    slot: Mapped[int] = mapped_column(primary_key=True, default=1)
    id: Mapped[str] = mapped_column(String(36), unique=True)
    activity_id: Mapped[int] = mapped_column(ForeignKey("activities.id"))
    started_at: Mapped[int]
