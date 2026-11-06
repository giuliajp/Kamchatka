"""Штраф без штрафного времени: seconds может быть 0.

Revision ID: 0011
Revises: 0010

Заказчик: штраф не всегда означает штрафное время. Если время есть, оно уже входит
в итоговое время этапа (прибавляется один раз). Штраф без времени хранится как факт.
"""

from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Разрешить штраф без времени (seconds = 0)."""
    op.drop_constraint(op.f("ck_penalties_seconds_positive"), "penalties", type_="check")
    op.create_check_constraint(op.f("ck_penalties_seconds_non_negative"), "penalties", "seconds >= 0")


def downgrade() -> None:
    """Откат: штрафы без времени удаляются."""
    op.execute("DELETE FROM penalties WHERE seconds = 0")
    op.drop_constraint(op.f("ck_penalties_seconds_non_negative"), "penalties", type_="check")
    op.create_check_constraint(op.f("ck_penalties_seconds_positive"), "penalties", "seconds > 0")
