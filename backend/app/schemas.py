from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints


class ActivityCreate(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=200)]
    category: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=100)]
    description: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ""
    completion_percentage: int = Field(default=0, ge=0, le=100, strict=True)


class ActivityRead(ActivityCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
