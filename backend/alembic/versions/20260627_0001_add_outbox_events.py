"""add outbox events table for durable realtime

Revision ID: b9c4d7e2f8a1
Revises: 609dd7af16b7
Create Date: 2026-06-27 00:01:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'b9c4d7e2f8a1'
down_revision = '609dd7af16b7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'outbox_events',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('salon_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('published_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_outbox_events_salon_id', 'outbox_events', ['salon_id'], unique=False)
    op.create_index(
        'ix_outbox_unpublished',
        'outbox_events',
        ['created_at'],
        unique=False,
        postgresql_where=sa.text('published_at IS NULL'),
    )


def downgrade() -> None:
    op.drop_index('ix_outbox_unpublished', table_name='outbox_events')
    op.drop_index('ix_outbox_events_salon_id', table_name='outbox_events')
    op.drop_table('outbox_events')
