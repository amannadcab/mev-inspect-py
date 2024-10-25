from typing import List
from uuid import uuid4
import time
from collections import defaultdict
from mev_inspect.models.sandwiches import SandwichModel
from mev_inspect.models.sandwichview import SandwichViewModel
from mev_inspect.schemas.sandwiches import Sandwich
from mev_inspect.schemas.transfers import Transfer
from mev_inspect.schemas.miner_payments import MinerPayment
from mev_inspect.schemas.traces import ClassifiedTrace
from .shared import delete_by_block_range
import requests 
import json

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
            print("Returning cached data.")
            return cache["data"]
    
    # If no valid cache, fetch new data
    print("Fetching new data.")
    new_data = load_price()
    
    # Update cache with new data and timestamp
    cache["data"] = new_data
    cache["timestamp"] = current_time
    
    return new_data

def delete_sandwiches_for_blocks(
    db_session,
    after_block_number: int,
    before_block_number: int,
) -> None:
    delete_by_block_range(
        db_session,
        SandwichModel,
        after_block_number,
        before_block_number,
    )
    db_session.commit()


def write_sandwiches(
    db_session,
    sandwiches: List[Sandwich],
) -> None:
    sandwich_models = []
    sandwiched_swaps = []

    for sandwich in sandwiches:
        sandwich_id = str(uuid4())
        sandwich_models.append(
            SandwichModel(
                id=sandwich_id,
                block_number=sandwich.block_number,
                sandwicher_address=sandwich.sandwicher_address,
                frontrun_swap_transaction_hash=sandwich.frontrun_swap.transaction_hash,
                frontrun_swap_trace_address=sandwich.frontrun_swap.trace_address,
                backrun_swap_transaction_hash=sandwich.backrun_swap.transaction_hash,
                backrun_swap_trace_address=sandwich.backrun_swap.trace_address,
                profit_token_address=sandwich.profit_token_address,
                profit_amount=sandwich.profit_amount,
            )
        )

        for swap in sandwich.sandwiched_swaps:
            sandwiched_swaps.append(
                {
                    "sandwich_id": sandwich_id,
                    "block_number": swap.block_number,
                    "transaction_hash": swap.transaction_hash,
                    "trace_address": swap.trace_address,
                }
            )

    if len(sandwich_models) > 0:
        db_session.bulk_save_objects(sandwich_models)
        db_session.execute(
            """
            INSERT INTO sandwiched_swaps
            (sandwich_id, block_number, transaction_hash, trace_address)
            VALUES
            (:sandwich_id, :block_number, :transaction_hash, :trace_address)
            """,
            params=sandwiched_swaps,
        )

        db_session.commit()


def write_sandwichs_view( 
    db_session,
    sandwiches: List[Sandwich],
    miners_payments: List[MinerPayment],
    transfers: List[Transfer],
    traces:List[ClassifiedTrace]
    )-> None:
    sandwich_models = []
    sandwiched_swaps = []
    miners_payments_dict = {payment.transaction_hash: payment for payment in miners_payments}

    transfers_dict = defaultdict(list)
    for transfer in transfers:
        transfers_dict[transfer.transaction_hash].append({
            'from_address': transfer.from_address,
            'to_address': transfer.to_address,
            'token_address': transfer.token_address,
            'amount': transfer.amount
        })
    for sandwich in sandwiches:
        sandwich_id = str(uuid4())
        sandwicher_address = sandwich.sandwicher_address,
        block_number = sandwich.block_number
        frontrun_swap = {
            'transaction_hash': sandwich.frontrun_swap.transaction_hash,
            'transaction_position': sandwich.frontrun_swap.transaction_position,
            'contract_address': sandwich.frontrun_swap.contract_address,
            'from_address': sandwich.frontrun_swap.from_address,
            'to_address': sandwich.frontrun_swap.to_address,
            'token_in_address': sandwich.frontrun_swap.token_in_address,
            'token_in_amount': sandwich.frontrun_swap.token_in_amount,
            'token_out_address': sandwich.frontrun_swap.token_out_address,
            'token_out_amount': sandwich.frontrun_swap.token_out_amount,
            'protocol': sandwich.frontrun_swap.protocol.value,
        }
        backrun_swap = {
            'transaction_hash': sandwich.backrun_swap.transaction_hash,
            'transaction_position': sandwich.backrun_swap.transaction_position,
            'contract_address': sandwich.backrun_swap.contract_address,
            'from_address': sandwich.backrun_swap.from_address,
            'to_address': sandwich.backrun_swap.to_address,
            'token_in_address': sandwich.backrun_swap.token_in_address,
            'token_in_amount': sandwich.backrun_swap.token_in_amount,
            'token_out_address': sandwich.backrun_swap.token_out_address,
            'token_out_amount': sandwich.backrun_swap.token_out_amount,
            'protocol': sandwich.backrun_swap.protocol.value,
        }
        sandwiched_swaps = [{
            'transaction_hash': swap.transaction_hash,
            'transaction_position': swap.transaction_position,
            'contract_address': swap.contract_address,
            'from_address': swap.from_address,
            'to_address': swap.to_address,
            'token_in_address': swap.token_in_address,
            'token_in_amount': swap.token_in_amount,
            'token_out_address': swap.token_out_address,
            'token_out_amount': swap.token_out_amount,
            'protocol': swap.protocol.value,
        } for swap in sandwich.sandwiched_swaps]
        protocols = {sandwich.frontrun_swap.protocol.value,sandwich.backrun_swap.protocol.value}
        front_matching_payment = miners_payments_dict.get(sandwich.frontrun_swap.transaction_hash)
        back_matching_payment = miners_payments_dict.get(sandwich.backrun_swap.transaction_hash)
        profit_token_address = sandwich.profit_token_address
        price = get_cached_price(hours=2)
        if profit_token_address in price:
            profit_amount = sandwich.profit_amount
            transaction_to_address = front_matching_payment.transaction_to_address
            transaction_from_address= front_matching_payment.transaction_from_address
            coinbase_transfer = front_matching_payment.coinbase_transfer + back_matching_payment.coinbase_transfer
            cost = (front_matching_payment.gas_price*front_matching_payment.gas_used) + (back_matching_payment.gas_price*back_matching_payment.gas_used) + coinbase_transfer
            cost_usd = cost * price['0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270']
            profit_usd = profit_amount * price[profit_token_address]
    
            sandwich_models.append(SandwichViewModel(
                id = sandwich_id,
                sandwicher_address = sandwicher_address,
                block_number = block_number,
                frontrun_transaction_hash = sandwich.frontrun_swap.transaction_hash,
                backrun_transaction_hash = sandwich.backrun_swap.transaction_hash,
                frontrun_swap = frontrun_swap,
                backrun_swap = backrun_swap,
                profit_token_address = profit_token_address,
                profit_amount = profit_amount,
                cost = cost,
                sandwiched_swaps = sandwiched_swaps,
                transaction_to_address = transaction_to_address,
                transaction_from_address = transaction_from_address,
                cost_usd = cost_usd,
                profit_usd = profit_usd,
                protocols= list(protocols)
            ))
    if len(sandwich_models) > 0:
        db_session.bulk_save_objects(sandwich_models)
        db_session.commit()
