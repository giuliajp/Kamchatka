"""Справочник дисциплин: три дисциплины гонки 2026 года (пока ориентируемся на них и в 2027).

Revision ID: 0002
Revises: 0001
"""
from typing import Sequence, Union
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DISCIPLINES = [
    # code,       name,                                          equipment, dogs_min, dogs_max, sort
    ("ski_2",     "Лыжи — длинная дистанция, 2 собаки",          "ski",     2,        2,        1),
    ("sled_8",    "Нарта — длинная дистанция, 8 собак",          "sled",    8,        8,        2),
    ("sled_8plus", "Нарта — длинная дистанция, более 8 собак",   "sled",    9,        None,     3),
]


def upgrade() -> None:
    table = sa.table(
        "disciplines",
        sa.column("code", sa.String), sa.column("name", sa.String),
        sa.column("equipment", sa.String), sa.column("dogs_min", sa.Integer),
        sa.column("dogs_max", sa.Integer), sa.column("sort_order", sa.Integer),
        sa.column("is_active", sa.Boolean),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    now = datetime.now(timezone.utc)
    op.bulk_insert(table, [
        {"code": c, "name": n, "equipment": e, "dogs_min": dmin, "dogs_max": dmax,
         "sort_order": s, "is_active": True, "created_at": now, "updated_at": now}
        for c, n, e, dmin, dmax, s in DISCIPLINES
    ])


def downgrade() -> None:
    codes = ", ".join(f"'{c[0]}'" for c in DISCIPLINES)
    op.execute(f"DELETE FROM disciplines WHERE code IN ({codes})")
