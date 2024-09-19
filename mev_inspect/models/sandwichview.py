from sqlalchemy import ARRAY, Column, Numeric, String,ARRAY,JSON

from .base import Base


class SandwichViewModel(Base):
    __tablename__ = "sandwiched_view"
    id = Column(String, primary_key=True)
    block_number = Column(Numeric, nullable=False)
    sandwicher_address = Column(String, nullable=True)
    transaction_from_address = Column(String, nullable=True)
    transaction_to_address = Column(String, nullable=True)
    frontrun_transaction_hash = Column(String, nullable=True)
    backrun_transaction_hash = Column(String, nullable=True)
    profit_token_address = Column(String, nullable=False)
    profit_amount = Column(Numeric, nullable=False)
    frontrun_swap = Column(JSON,nullable=False)
    sandwiched_swaps = Column(ARRAY(JSON), nullable=False)
    backrun_swap = Column(JSON,nullable=False)
    profit_usd = Column(Numeric, nullable=False)
    cost = Column(Numeric, nullable=False)
    cost_usd = Column(Numeric, nullable=False)
    protocols = Column(ARRAY(String))
