from sqlalchemy import ARRAY, Column, Numeric, String,ARRAY,JSON

from .base import Base


class ArbitrageViewModel(Base):
    __tablename__ = "arbitrages_view"
    id = Column(String, primary_key=True)
    block_number = Column(Numeric, nullable=False)
    transaction_from_address = Column(String, nullable=True)
    transaction_to_address = Column(String, nullable=True)
    transaction_hash = Column(String, nullable=False)
    profit_token_address = Column(String, nullable=False)
    profit_amount = Column(Numeric, nullable=False)
    swaps = Column(ARRAY(JSON), nullable=False)
    transfers = Column(ARRAY(JSON), nullable=False)
    miner_address = Column(String, nullable=True)
    coinbase_transfer = Column(Numeric, nullable=False)
    base_fee_per_gas = Column(Numeric, nullable=False)
    gas_price = Column(Numeric, nullable=False)
    gas_price_with_coinbase_transfer = Column(Numeric, nullable=False)
    gas_used = Column(Numeric, nullable=False)
    profit_usd = Column(Numeric, nullable=False)
    cost_usd = Column(Numeric, nullable=False)
    error = Column(String, nullable=True)
    protocols = Column(ARRAY(String))
