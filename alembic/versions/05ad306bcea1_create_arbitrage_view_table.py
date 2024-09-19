"""create arbitrage_view table

Revision ID: 05ad306bcea1
Revises: 5c5375de15fd
Create Date: 2024-09-16 13:53:33.199126

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '05ad306bcea1'
down_revision = '5c5375de15fd'
branch_labels = None
depends_on = None


def upgrade():
     op.create_table(
        "arbitrages_view",
        sa.Column("id", sa.String(256), primary_key=True),
        sa.Column("created_at", sa.TIMESTAMP, server_default=sa.func.now()),
        sa.Column("transaction_from_address", sa.String(256), nullable=False),
        sa.Column("transaction_to_address", sa.String(256), nullable=False),
        sa.Column("transaction_hash", sa.String(66), nullable=False),
        sa.Column("profit_token_address",sa.String(66), nullable=False),
        sa.Column("profit_amount", sa.Numeric, nullable=False),
        sa.Column("block_number", sa.Numeric, nullable=False),
        sa.Column("swaps", sa.ARRAY(sa.JSON), nullable=False),
        sa.Column("transfers", sa.ARRAY(sa.JSON), nullable=False),
        sa.Column("miner_address", sa.String(256), nullable=False),
        sa.Column("coinbase_transfer", sa.Numeric, nullable=False),
        sa.Column("base_fee_per_gas", sa.Numeric, nullable=False),
        sa.Column("gas_price", sa.Numeric, nullable=False),
        sa.Column("gas_price_with_coinbase_transfer", sa.Numeric, nullable=False),
        sa.Column("gas_used", sa.Numeric, nullable=False),
        sa.Column("profit_usd", sa.Numeric, nullable=False),
        sa.Column("cost_usd", sa.Numeric, nullable=False),
        sa.Column("protocols", sa.ARRAY(sa.String), nullable=False),
        sa.Column("error", sa.String(256),nullable=True)
    )

 
def downgrade():
    op.drop_table("arbitrages_view")
