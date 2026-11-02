"""Админка и болельщики: организаторы, журнал правок отметок КП, подписки «Болею за».

Revision ID: 0005
Revises: 0004
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Создать таблицы admin_users, support_subscriptions, checkpoint_pass_log."""
    op.create_table('admin_users',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('login', sa.String(length=100), nullable=False),
    sa.Column('full_name', sa.String(length=200), nullable=False),
    sa.Column('password_hash', sa.String(length=300), nullable=False),
    sa.Column('is_active', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_admin_users')),
    sa.UniqueConstraint('login', name=op.f('uq_admin_users_login'))
    )
    op.create_table('support_subscriptions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('vk_user_id', sa.BigInteger(), nullable=False),
    sa.Column('race_participant_id', sa.Integer(), nullable=False),
    sa.Column('notifications_enabled', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['race_participant_id'], ['race_participants.id'], name=op.f('fk_support_subscriptions_race_participant_id_race_participants'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_support_subscriptions'))
    )
    op.create_index(op.f('ix_support_subscriptions_race_participant_id'), 'support_subscriptions', ['race_participant_id'], unique=False)
    op.create_index(op.f('ix_support_subscriptions_vk_user_id'), 'support_subscriptions', ['vk_user_id'], unique=False)
    op.create_index('uq_support_subscriptions_active', 'support_subscriptions', ['vk_user_id', 'race_participant_id'], unique=True, postgresql_where=sa.text('cancelled_at IS NULL'))
    op.create_table('checkpoint_pass_log',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('checkpoint_pass_id', sa.Integer(), nullable=True),
    sa.Column('race_participant_id', sa.Integer(), nullable=False),
    sa.Column('stage_checkpoint_id', sa.Integer(), nullable=False),
    sa.Column('action', sa.Enum('create', 'update', 'delete', name='changeaction', native_enum=False, length=32), nullable=False),
    sa.Column('before', sa.JSON(), nullable=True),
    sa.Column('after', sa.JSON(), nullable=True),
    sa.Column('changed_by', sa.String(length=200), nullable=False),
    sa.Column('changed_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['checkpoint_pass_id'], ['checkpoint_passes.id'], name=op.f('fk_checkpoint_pass_log_checkpoint_pass_id_checkpoint_passes'), ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['race_participant_id'], ['race_participants.id'], name=op.f('fk_checkpoint_pass_log_race_participant_id_race_participants'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['stage_checkpoint_id'], ['stage_checkpoints.id'], name=op.f('fk_checkpoint_pass_log_stage_checkpoint_id_stage_checkpoints'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_checkpoint_pass_log'))
    )
    op.create_index(op.f('ix_checkpoint_pass_log_checkpoint_pass_id'), 'checkpoint_pass_log', ['checkpoint_pass_id'], unique=False)
    op.create_index(op.f('ix_checkpoint_pass_log_race_participant_id'), 'checkpoint_pass_log', ['race_participant_id'], unique=False)


def downgrade() -> None:
    """Удалить таблицы в обратном порядке."""
    op.drop_index(op.f('ix_checkpoint_pass_log_race_participant_id'), table_name='checkpoint_pass_log')
    op.drop_index(op.f('ix_checkpoint_pass_log_checkpoint_pass_id'), table_name='checkpoint_pass_log')
    op.drop_table('checkpoint_pass_log')
    op.drop_index('uq_support_subscriptions_active', table_name='support_subscriptions', postgresql_where=sa.text('cancelled_at IS NULL'))
    op.drop_index(op.f('ix_support_subscriptions_vk_user_id'), table_name='support_subscriptions')
    op.drop_index(op.f('ix_support_subscriptions_race_participant_id'), table_name='support_subscriptions')
    op.drop_table('support_subscriptions')
    op.drop_table('admin_users')
