"""Align content CHECK constraints with the new design's event and location types.

Revision ID: 0010
Revises: 0009
"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint(op.f('ck_program_events_event_type_valid'), 'program_events', type_='check')
    op.create_check_constraint(op.f('ck_program_events_event_type_valid'), 'program_events',
                               "event_type IN ('stage_start', 'stage_finish', 'festival', 'master_class', 'meeting')")
    op.drop_constraint(op.f('ck_spectator_locations_location_type_valid'), 'spectator_locations', type_='check')
    op.create_check_constraint(op.f('ck_spectator_locations_location_type_valid'), 'spectator_locations',
                               "location_type IN ('start', 'finish', 'festival', 'viewpoint', 'checkpoint')")


def downgrade() -> None:
    connection = op.get_bind()
    has_new_types = connection.execute(sa.text("""
        SELECT EXISTS (SELECT 1 FROM program_events WHERE event_type IN ('master_class', 'meeting'))
            OR EXISTS (SELECT 1 FROM spectator_locations WHERE location_type = 'checkpoint')
    """)).scalar()
    if has_new_types:
        raise RuntimeError('Перед откатом 0010 измените типы master_class, meeting и checkpoint в админке. Данные не удалены.')
    op.drop_constraint(op.f('ck_program_events_event_type_valid'), 'program_events', type_='check')
    op.create_check_constraint(op.f('ck_program_events_event_type_valid'), 'program_events',
                               "event_type IN ('stage_start', 'stage_finish', 'festival')")
    op.drop_constraint(op.f('ck_spectator_locations_location_type_valid'), 'spectator_locations', type_='check')
    op.create_check_constraint(op.f('ck_spectator_locations_location_type_valid'), 'spectator_locations',
                               "location_type IN ('start', 'finish', 'festival', 'viewpoint')")
