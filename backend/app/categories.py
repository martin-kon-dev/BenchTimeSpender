from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import func, select, update

from .models import Activity, Category
from .migrations import COLORS
from .schemas import CategoryCreate, CategoryDelete, CategoryRead, CategoryUpdate
from .tracking import DatabaseSession

router = APIRouter(prefix="/api/categories")


def require_category(session, category_id):
    category = session.get(Category, category_id) if category_id is not None else None
    if category_id is not None and category is None:
        raise HTTPException(404, "Category not found. Reload categories and retry.")
    return category


def legacy_category(session, name):
    if name is None or name.casefold() == "uncategorized":
        return None
    category = session.scalar(select(Category).where(Category.name_key == name.casefold()))
    if category is None:
        category = Category(name=name, name_key=name.casefold(), color=COLORS.get(name.casefold(), "#8b5cf6"))
        session.add(category)
        session.flush()
    return category


def count(session, category_id):
    return session.scalar(select(func.count()).select_from(Activity).where(Activity.category_id == category_id))


def read(session, category):
    return {"id": category.id, "name": category.name, "color": category.color,
            "version": category.version, "activity_count": count(session, category.id)}


def validate_name(session, name, excluded_id=None):
    if name.casefold() == "uncategorized":
        raise HTTPException(422, "Uncategorized is the protected fallback. Choose another name.")
    duplicate = session.scalar(select(Category).where(Category.name_key == name.casefold()))
    if duplicate and duplicate.id != excluded_id:
        raise HTTPException(409, "A category with this name already exists.")


@router.get("", response_model=list[CategoryRead])
def list_categories(session: DatabaseSession):
    return [read(session, category) for category in session.scalars(select(Category).order_by(Category.name_key))]


@router.post("", response_model=CategoryRead, status_code=201)
def create_category(data: CategoryCreate, session: DatabaseSession):
    session.connection().exec_driver_sql("BEGIN IMMEDIATE")
    validate_name(session, data.name)
    category = Category(name=data.name, name_key=data.name.casefold(), color=data.color)
    session.add(category)
    session.commit()
    return read(session, category)


@router.put("/{category_id}", response_model=CategoryRead)
def edit_category(category_id: int, data: CategoryUpdate, session: DatabaseSession):
    session.connection().exec_driver_sql("BEGIN IMMEDIATE")
    category = require_category(session, category_id)
    if category.version != data.expected_version:
        raise HTTPException(409, "Category changed in another tab. Reload categories and retry.")
    validate_name(session, data.name, category_id)
    category.name, category.name_key, category.color = data.name, data.name.casefold(), data.color
    category.version += 1
    session.execute(update(Activity).where(Activity.category_id == category_id).values(category=data.name))
    session.commit()
    return read(session, category)


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: int, data: CategoryDelete, session: DatabaseSession):
    session.connection().exec_driver_sql("BEGIN IMMEDIATE")
    category = require_category(session, category_id)
    if category.version != data.expected_version or count(session, category_id) != data.expected_activity_count:
        raise HTTPException(409, "Category or activity count changed. Reload categories and review deletion again.")
    if data.reassign_to == category_id:
        raise HTTPException(422, "Choose another category or Uncategorized.")
    target = require_category(session, data.reassign_to)
    session.execute(update(Activity).where(Activity.category_id == category_id).values(
        category_id=data.reassign_to, category=target.name if target else "Uncategorized"))
    session.delete(category)
    session.commit()
    return Response(status_code=204)
