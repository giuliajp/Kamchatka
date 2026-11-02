"""Программа фестиваля, FAQ и зрительские локации.

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Создать таблицы контента, ограничения и индексы."""
    op.create_table(
        "spectator_locations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=False),
        sa.Column("longitude", sa.Float(), nullable=False),
        sa.Column("address", sa.String(500), nullable=True),
        sa.Column("how_to_get_there", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "latitude BETWEEN -90 AND 90",
            name=op.f("ck_spectator_locations_latitude_range"),
        ),
        sa.CheckConstraint(
            "longitude BETWEEN -180 AND 180",
            name=op.f("ck_spectator_locations_longitude_range"),
        ),
        sa.CheckConstraint(
            "sort_order >= 0",
            name=op.f("ck_spectator_locations_sort_order_non_negative"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_spectator_locations")),
    )
    op.create_table(
        "program_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("location_id", sa.Integer(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "end_at IS NULL OR end_at >= start_at",
            name=op.f("ck_program_events_end_after_start"),
        ),
        sa.CheckConstraint(
            "sort_order >= 0", name=op.f("ck_program_events_sort_order_non_negative"),
        ),
        sa.ForeignKeyConstraint(
            ["location_id"], ["spectator_locations.id"],
            name=op.f("fk_program_events_location_id_spectator_locations"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_program_events")),
    )
    op.create_index(
        op.f("ix_program_events_location_id"), "program_events", ["location_id"],
    )
    op.create_index(
        op.f("ix_program_events_start_at"), "program_events", ["start_at"],
    )
    op.create_table(
        "faq_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("question", sa.String(500), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "sort_order >= 0", name=op.f("ck_faq_items_sort_order_non_negative"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_faq_items")),
    )


def downgrade() -> None:
    """Удалить таблицы контента; сначала события, ссылающиеся на локации."""
    op.drop_table("faq_items")
    op.drop_index(op.f("ix_program_events_start_at"), table_name="program_events")
    op.drop_index(op.f("ix_program_events_location_id"), table_name="program_events")
    op.drop_table("program_events")
    op.drop_table("spectator_locations")
