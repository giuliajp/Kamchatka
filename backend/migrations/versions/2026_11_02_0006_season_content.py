"""Программа и локации по сезонам, типы контента и контакты организаторов.

Revision ID: 0006
Revises: 0005

Существующие события и локации — демонстрационные: очищаются перед добавлением
обязательной ссылки на сезон. Удалённые примеры при downgrade не восстанавливаются.
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | None = None
depends_on: str | None = None


CONTENT_TYPES = (
    (
        "spectator_locations",
        "location_type",
        "'start', 'finish', 'festival', 'viewpoint'",
    ),
    ("program_events", "event_type", "'stage_start', 'stage_finish', 'festival'"),
)


def upgrade() -> None:
    # Сначала дочерние события, затем локации. FAQ и другие данные сохраняются.
    op.execute(sa.text("DELETE FROM program_events"))
    op.execute(sa.text("DELETE FROM spectator_locations"))
    op.create_unique_constraint("uq_stages_id_race", "stages", ["id", "race_id"])
    for table, type_column, values in CONTENT_TYPES:
        op.add_column(table, sa.Column("race_id", sa.Integer(), nullable=False))
        op.add_column(table, sa.Column("stage_id", sa.Integer(), nullable=True))
        op.add_column(table, sa.Column(type_column, sa.String(32), nullable=False))
        op.create_foreign_key(
            op.f(f"fk_{table}_race_id_races"),
            table,
            "races",
            ["race_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_foreign_key(
            f"fk_{table}_stage_race",
            table,
            "stages",
            ["stage_id", "race_id"],
            ["id", "race_id"],
            ondelete="RESTRICT",
        )
        op.create_check_constraint(
            op.f(f"ck_{table}_{type_column}_valid"),
            table,
            f"{type_column} IN ({values})",
        )
        for column in ("race_id", "stage_id"):
            op.create_index(op.f(f"ix_{table}_{column}"), table, [column])
    op.create_table(
        "organizer_contacts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("name", sa.String(200), nullable=True),
        sa.Column("phone", sa.String(100), nullable=True),
        sa.Column("email", sa.String(320), nullable=True),
        sa.Column("url", sa.String(2000), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "sort_order >= 0",
            name=op.f("ck_organizer_contacts_sort_order_non_negative"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_organizer_contacts")),
    )


def downgrade() -> None:
    op.drop_table("organizer_contacts")
    for table, type_column, _ in reversed(CONTENT_TYPES):
        for column in ("stage_id", "race_id"):
            op.drop_index(op.f(f"ix_{table}_{column}"), table_name=table)
        op.drop_constraint(
            op.f(f"ck_{table}_{type_column}_valid"), table, type_="check"
        )
        op.drop_constraint(f"fk_{table}_stage_race", table, type_="foreignkey")
        op.drop_constraint(op.f(f"fk_{table}_race_id_races"), table, type_="foreignkey")
        op.drop_column(table, type_column)
        op.drop_column(table, "stage_id")
        op.drop_column(table, "race_id")
    op.drop_constraint("uq_stages_id_race", "stages", type_="unique")
