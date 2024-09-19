"""create sandwichs_view table

Revision ID: a97bcfa98ade
Revises: 05ad306bcea1
Create Date: 2024-09-17 11:45:45.986062

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a97bcfa98ade'
down_revision = '05ad306bcea1'
branch_labels = None
depends_on = None


def upgrade():
     op.create_table(
        "sandwiched_view",
        sa.Column("id", sa.String(256), primary_key=True),
        sa.Column("created_at", sa.TIMESTAMP, server_default=sa.func.now()),
        sa.Column("sandwicher_address", sa.String(256), nullable=False),
        sa.Column("transaction_from_address", sa.String(256), nullable=False),
        sa.Column("transaction_to_address", sa.String(256), nullable=False),
        sa.Column("frontrun_transaction_hash", sa.String(256), nullable=False),
        sa.Column("backrun_transaction_hash", sa.String(256), nullable=False),
        sa.Column("profit_token_address",sa.String(66), nullable=False),
        sa.Column("profit_amount", sa.Numeric, nullable=False),
        sa.Column("block_number", sa.Numeric, nullable=False),
        sa.Column("frontrun_swap", sa.JSON, nullable=False),
        sa.Column("sandwiched_swaps", sa.ARRAY(sa.JSON), nullable=False),
        sa.Column("backrun_swap", sa.JSON, nullable=False),
        sa.Column("profit_usd", sa.Numeric, nullable=False),
        sa.Column("cost", sa.Numeric, nullable=False),
        sa.Column("cost_usd", sa.Numeric, nullable=False),
        sa.Column("protocols", sa.ARRAY(sa.String), nullable=False)
     )

def downgrade():
    op.drop_table("sandwiched_view")
