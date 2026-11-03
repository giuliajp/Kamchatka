"""Пользователи приложения, закладки, журнал push; правки штрафов в журнале без протокола.

Revision ID: 0007
Revises: 0006

result_change_log.protocol_id становится необязательным: штраф относится к гонке,
а не к протоколу этапа. При откате такие записи журнала удаляются.
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Создать app_users, bookmarks, push_messages; protocol_id в журнале — необязательный."""
    op.create_table('app_users',
    sa.Column('vk_user_id', sa.BigInteger(), autoincrement=False, nullable=False),
    sa.Column('notifications_allowed', sa.Boolean(), nullable=False),
    sa.Column('first_seen_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('last_seen_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('vk_user_id', name=op.f('pk_app_users'))
    )
    op.create_table('bookmarks',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('vk_user_id', sa.BigInteger(), nullable=False),
    sa.Column('kind', sa.String(length=20), nullable=False),
    sa.Column('item_id', sa.String(length=100), nullable=False),
    sa.Column('title', sa.String(length=300), nullable=True),
    sa.Column('url', sa.String(length=1000), nullable=True),
    sa.Column('image_url', sa.String(length=1000), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_bookmarks')),
    sa.UniqueConstraint('vk_user_id', 'kind', 'item_id', name='uq_bookmarks_user_item')
    )
    op.create_index(op.f('ix_bookmarks_vk_user_id'), 'bookmarks', ['vk_user_id'], unique=False)
    op.create_table('push_messages',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('segment', sa.String(length=100), nullable=False),
    sa.Column('message', sa.String(length=300), nullable=False),
    sa.Column('fragment', sa.String(length=200), nullable=True),
    sa.Column('trigger', sa.String(length=50), nullable=False),
    sa.Column('recipients', sa.Integer(), nullable=False),
    sa.Column('delivered', sa.Integer(), nullable=False),
    sa.Column('error', sa.Text(), nullable=True),
    sa.Column('created_by', sa.String(length=200), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_push_messages'))
    )
    op.alter_column('result_change_log', 'protocol_id',
               existing_type=sa.INTEGER(),
               nullable=True)


def downgrade() -> None:
    """Откат. Записи журнала о штрафах (без протокола) удаляются."""
    op.execute("DELETE FROM result_change_log WHERE protocol_id IS NULL")
    op.alter_column('result_change_log', 'protocol_id',
               existing_type=sa.INTEGER(),
               nullable=False)
    op.drop_table('push_messages')
    op.drop_index(op.f('ix_bookmarks_vk_user_id'), table_name='bookmarks')
    op.drop_table('bookmarks')
    op.drop_table('app_users')
