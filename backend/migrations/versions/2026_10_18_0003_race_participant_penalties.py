"""Привязать штрафы к участию в гонке вместо результата этапа.

Revision ID: 0003
Revises: 0002
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Перенести владельцев штрафов, сохранив записи и времена этапов."""
    # Не удаляем старую сумму, если она расходится с записями штрафов.
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM stage_results AS result
                WHERE result.penalty_seconds <> (
                    SELECT COALESCE(SUM(penalty.seconds), 0)
                    FROM penalties AS penalty
                    WHERE penalty.stage_result_id = result.id
                )
            ) THEN
                RAISE EXCEPTION 'Stage penalty totals disagree with penalty records';
            END IF;
        END $$;
    """)
    op.drop_constraint(
        "fk_penalties_stage_result_id_stage_results", "penalties", type_="foreignkey"
    )
    op.drop_index("ix_penalties_stage_result_id", table_name="penalties")
    op.alter_column(
        "penalties", "stage_result_id", new_column_name="race_participant_id"
    )
    op.execute("""
        UPDATE penalties AS penalty
        SET race_participant_id = result.race_participant_id
        FROM stage_results AS result
        WHERE result.id = penalty.race_participant_id
    """)
    op.create_foreign_key(
        "fk_penalties_race_participant_id_race_participants",
        "penalties",
        "race_participants",
        ["race_participant_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_penalties_race_participant_id", "penalties", ["race_participant_id"]
    )
    op.drop_constraint(
        op.f("ck_stage_results_final_equals_net_plus_penalty"),
        "stage_results",
        type_="check",
    )
    op.drop_constraint(
        op.f("ck_stage_results_penalty_non_negative"), "stage_results", type_="check"
    )
    op.drop_column("stage_results", "penalty_seconds")


def downgrade() -> None:
    """Вернуть прежнюю схему, не назначая штрафам выдуманные этапы."""
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM penalties) THEN
                RAISE EXCEPTION 'Cannot downgrade 0003: penalty stages are unknown';
            END IF;
        END $$;
    """)
    op.add_column(
        "stage_results",
        sa.Column("penalty_seconds", sa.Integer(), nullable=False, server_default="0"),
    )
    op.alter_column("stage_results", "penalty_seconds", server_default=None)
    op.create_check_constraint(
        op.f("ck_stage_results_penalty_non_negative"),
        "stage_results",
        "penalty_seconds >= 0",
    )
    op.create_check_constraint(
        op.f("ck_stage_results_final_equals_net_plus_penalty"),
        "stage_results",
        "final_time_seconds IS NULL OR final_time_seconds = net_time_seconds + penalty_seconds",
    )
    op.drop_constraint(
        "fk_penalties_race_participant_id_race_participants",
        "penalties",
        type_="foreignkey",
    )
    op.drop_index("ix_penalties_race_participant_id", table_name="penalties")
    op.alter_column(
        "penalties", "race_participant_id", new_column_name="stage_result_id"
    )
    op.create_foreign_key(
        "fk_penalties_stage_result_id_stage_results",
        "penalties",
        "stage_results",
        ["stage_result_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_penalties_stage_result_id", "penalties", ["stage_result_id"])
