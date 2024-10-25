from collections import defaultdict
from typing import List
from uuid import uuid4
import time
import json 
from mev_inspect.models.arbitrages import ArbitrageModel
from mev_inspect.models.arbitrageview import ArbitrageViewModel
from mev_inspect.schemas.arbitrages import Arbitrage
from mev_inspect.schemas.transfers import Transfer
from mev_inspect.schemas.miner_payments import MinerPayment
from mev_inspect.schemas.traces import ClassifiedTrace

from .shared import delete_by_block_range
import requests  # type: ignore

cache = {
    "data": None,
    "timestamp": None
}

def load_price():
    res = requests.get("https://api.sushi.com/price/v1/137")
    data = json.loads(res.text)
    return data

def get_cached_price(hours=1):
    current_time = time.time()
    
    # Check if we have cached data and if it's still valid (within the specified hours)
    if cache["data"] and cache["timestamp"]:
        elapsed_time = (current_time - cache["timestamp"]) / 3600  # Convert seconds to hours
        if elapsed_time < hours:
            # print("Returning cached data.")
            return cache["data"]
    
    # If no valid cache, fetch new data
    # print("Fetching new data.")
    new_data = load_price()
    
    # Update cache with new data and timestamp
    cache["data"] = new_data
    cache["timestamp"] = current_time
    
    return new_data


def delete_arbitrages_for_blocks(
    db_session,
    after_block_number: int,
    before_block_number: int,
) -> None:
    delete_by_block_range(
        db_session,
        ArbitrageModel,
        after_block_number,
        before_block_number,
    )
    db_session.commit()


def write_arbitrages(
    db_session,
    arbitrages: List[Arbitrage],
) -> None:
    arbitrage_models = []
    swap_arbitrage_ids = []

    for arbitrage in arbitrages:
        arbitrage_id = str(uuid4())
        arbitrage_models.append(
            ArbitrageModel(
                id=arbitrage_id,
                block_number=arbitrage.block_number,
                transaction_hash=arbitrage.transaction_hash,
                account_address=arbitrage.account_address,
                profit_token_address=arbitrage.profit_token_address,
                start_amount=arbitrage.start_amount,
                end_amount=arbitrage.end_amount,
                profit_amount=arbitrage.profit_amount,
                error=arbitrage.error,
                protocols={swap.protocol.value for swap in arbitrage.swaps},
            )
        )

        for swap in arbitrage.swaps:
            swap_arbitrage_ids.append(
                {
                    "arbitrage_id": arbitrage_id,
                    "swap_transaction_hash": swap.transaction_hash,
                    "swap_trace_address": swap.trace_address,
                }
            )

    if len(arbitrage_models) > 0:
        db_session.bulk_save_objects(arbitrage_models)
        db_session.execute(
            """
            INSERT INTO arbitrage_swaps
            (arbitrage_id, swap_transaction_hash, swap_trace_address)
            VALUES
            (:arbitrage_id, :swap_transaction_hash, :swap_trace_address)
            """,
            params=swap_arbitrage_ids,
        )

        db_session.commit()


def write_arbitrage_view(
    db_session,
    arbitrages: List[Arbitrage],
    miners_payments: List[MinerPayment],
    transfers: List[Transfer],
    traces:List[ClassifiedTrace]
) -> None:
    prices = load_price()
    arbitrageview_models = []
    # swaps_dict = {swap.transaction_hash: swap for swap in swaps}
    miners_payments_dict = {payment.transaction_hash: payment for payment in miners_payments}
    # traces_dict = {trace.transaction_hash for trace in traces if trace.error != 'Reverted'}

    transfers_dict = defaultdict(list)
    for transfer in transfers:
        transfers_dict[transfer.transaction_hash].append({
            'from_address': transfer.from_address,
            'to_address': transfer.to_address,
            'token_address': transfer.token_address,
            'amount': transfer.amount
        })

    for arbitrage in arbitrages:
        swaps = [{
            'contract_address': swap.contract_address,
            'from_address': swap.from_address,
            'to_address': swap.to_address,
            'token_in_address': swap.token_in_address,
            'token_in_amount': swap.token_in_amount,
            'token_out_address': swap.token_out_address,
            'token_out_amount': swap.token_out_amount,
            'protocol': swap.protocol.value,
            } for swap in arbitrage.swaps]

        arbitrage_id = str(uuid4())
        transaction_hash = arbitrage.transaction_hash
        block_number = arbitrage.block_number
        profit_token_address = arbitrage.profit_token_address
        profit_amount = arbitrage.profit_amount
        protocols = {swap.protocol.value for swap in arbitrage.swaps}
        matching_payment = miners_payments_dict.get(transaction_hash)
        miner_address = matching_payment.miner_address
        coinbase_transfer = matching_payment.coinbase_transfer
        base_fee_per_gas = matching_payment.base_fee_per_gas
        gas_price = matching_payment.gas_price
        gas_price_with_coinbase_transfer = matching_payment.gas_price_with_coinbase_transfer
        gas_used =  matching_payment.gas_used
        transaction_to_address = matching_payment.transaction_to_address
        transaction_from_address= matching_payment.transaction_from_address
        prices = get_cached_price(hours=2)
        if profit_token_address in prices:
            if transaction_from_address and transaction_to_address:
                arbitrageview_models.append(
                    ArbitrageViewModel(
                        id = arbitrage_id,
                        block_number = block_number,
                        transaction_from_address = transaction_from_address,
                        transaction_to_address = transaction_to_address,
                        transaction_hash = transaction_hash,
                        profit_token_address = profit_token_address,
                        profit_amount = profit_amount,
                        swaps = swaps,
                        transfers = transfers_dict[transaction_hash],
                        miner_address = miner_address,
                        coinbase_transfer = coinbase_transfer,
                        base_fee_per_gas = base_fee_per_gas,
                        gas_price = gas_price,
                        gas_price_with_coinbase_transfer = gas_price_with_coinbase_transfer,
                        gas_used = gas_used,
                        profit_usd = profit_amount*prices[profit_token_address],
                        cost_usd = ((gas_price * gas_used))*prices["0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"],
                        protocols = list(protocols)
                    )
            )

    if len(arbitrageview_models) > 0:
        db_session.bulk_save_objects(arbitrageview_models)
        db_session.commit()
