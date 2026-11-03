"""Экран «Ещё»: раздел «Гостям», переключатели push в профиле, PDF протокола этапа.

Revision ID: 0009
Revises: 0008
"""

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Раздел «Гостям», переключатели push пользователя, PDF протокола этапа."""
    op.create_table('guest_info_items',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('section', sa.String(length=30), nullable=False),
    sa.Column('title', sa.String(length=200), nullable=True),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('sort_order', sa.Integer(), nullable=False),
    sa.Column('is_published', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.CheckConstraint("section IN ('how_to_get_there', 'what_to_bring', 'safety')", name=op.f('ck_guest_info_items_section_valid')),
    sa.CheckConstraint('sort_order >= 0', name=op.f('ck_guest_info_items_sort_order_non_negative')),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_guest_info_items'))
    )
    op.add_column('app_users', sa.Column('notify_checkpoints', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('app_users', sa.Column('notify_results', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('app_users', sa.Column('notify_news', sa.Boolean(), server_default='true', nullable=False))
    op.add_column('stages', sa.Column('protocol_pdf_url', sa.String(length=1000), nullable=True))


def downgrade() -> None:
    """Откат: удалить таблицу и колонки."""
    op.drop_column('stages', 'protocol_pdf_url')
    op.drop_column('app_users', 'notify_news')
    op.drop_column('app_users', 'notify_results')
    op.drop_column('app_users', 'notify_checkpoints')
    op.drop_table('guest_info_items')
