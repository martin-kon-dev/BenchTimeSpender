from sqlalchemy import CheckConstraint, String
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
