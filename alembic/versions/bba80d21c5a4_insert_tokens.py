"""Add tokens to database

Revision ID: bba80d21c5a4
Revises: b26ab0051a88
Create Date: 2022-01-19 22:19:59.514998

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = "bba80d21c5a4"
down_revision = "630783c18a93"
branch_labels = None
depends_on = None


def upgrade():
    op.execute(
        """
        INSERT INTO tokens (token_address,decimals) VALUES
        ('0x55d398326f99059fF775485246999027B3197955',18),
        ('0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',18),
        ('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',18),
        ('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',18),
        ('0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',18),
        ('0x2170Ed0880ac9A755fd29B2688956BD959F933F8',18),
        ('0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3',18),
        ('0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',18),
        ('0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',18);
        """
    )


def downgrade():
    op.execute("DELETE FROM tokens")
