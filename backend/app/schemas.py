from typing import Annotated

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StringConstraints


class ActivityCreate(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    category: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)] | None = None
    category_id: int | None = Field(default=None, gt=0, strict=True)
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ""
    completion_percentage: int = Field(default=0, ge=0, le=100, strict=True)


class ActivityRead(ActivityCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int


class ActivityUpdate(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)] | None = None
    category_id: int | None = Field(default=None, gt=0, strict=True)
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] | None = None
    completion_percentage: int | None = Field(default=None, ge=0, le=100, strict=True)


class CategoryCreate(BaseModel):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    color: Annotated[str, StringConstraints(pattern=r"^#[0-9a-fA-F]{6}$")]


class CategoryUpdate(CategoryCreate):
    expected_version: int = Field(gt=0, strict=True)


class CategoryDelete(BaseModel):
    reassign_to: int | None = Field(..., gt=0, strict=True)
    expected_version: int = Field(gt=0, strict=True)
    expected_activity_count: int = Field(ge=0, strict=True)


class CategoryRead(CategoryCreate):
    id: int
    version: int
    activity_count: int


class TimerStart(BaseModel):
    activity_id: int = Field(gt=0, strict=True)


class TimerRead(TimerStart):
    model_config = ConfigDict(from_attributes=True)
    id: str
    started_at: int


class ManualEntryCreate(TimerStart):
    started_at: AwareDatetime
    duration_seconds: int = Field(ge=1, le=86400, strict=True)
    note: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ""


class TimeEntryRead(TimerStart):
    model_config = ConfigDict(from_attributes=True)
    id: int
    started_at: int
    duration_seconds: int
    source: str
    note: str = ""
