from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints


class ActivityCreate(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    category: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ""
    completion_percentage: int = Field(default=0, ge=0, le=100, strict=True)


class ActivityRead(ActivityCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int


class TimerStart(BaseModel):
    activity_id: int = Field(gt=0, strict=True)


class TimerRead(TimerStart):
    model_config = ConfigDict(from_attributes=True)
    id: str
    started_at: int


class ManualEntryCreate(TimerStart):
    started_at: AwareDatetime
    duration_seconds: int = Field(ge=1, le=86400, strict=True)


class TimeEntryRead(TimerStart):
    model_config = ConfigDict(from_attributes=True)
    id: int
    started_at: int
    duration_seconds: int
    source: str
