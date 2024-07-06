from typing import List, Optional

from mev_inspect.classifiers.helpers import get_debt_transfer, get_received_transfer
from mev_inspect.schemas.classifiers import (
    Classification,
    ClassifiedTrace,
    ClassifierSpec,
    DecodedCallTrace,
    LiquidationClassifier,
    SeizeClassifier,
)
from mev_inspect.schemas.liquidations import Liquidation
from mev_inspect.schemas.prices import ETH_TOKEN_ADDRESS
from mev_inspect.schemas.traces import Protocol
from mev_inspect.schemas.transfers import Transfer

CRETH_TOKEN_ADDRESS = "0x1ffe17b99b439be0afc831239ddecda2a790ff3a"


class CreamLiquidationClassifier(LiquidationClassifier):
    @staticmethod
    def parse_liquidation(
        liquidation_trace: DecodedCallTrace,
        child_transfers: List[Transfer],
        child_traces: List[ClassifiedTrace],
    ) -> Optional[Liquidation]:

        liquidator = liquidation_trace.from_address
        liquidated = liquidation_trace.inputs["borrower"]

        debt_token_address = liquidation_trace.to_address
        received_token_address = liquidation_trace.inputs["cTokenCollateral"]

        debt_purchase_amount = None
        received_amount = None

        debt_purchase_amount, debt_token_address = (
            (liquidation_trace.value, ETH_TOKEN_ADDRESS)
            if debt_token_address == CRETH_TOKEN_ADDRESS
            and liquidation_trace.value != 0
            else (liquidation_trace.inputs["repayAmount"], CRETH_TOKEN_ADDRESS)
        )

        debt_transfer = get_debt_transfer(liquidator, child_transfers)

        received_transfer = get_received_transfer(liquidator, child_transfers)

        seize_trace = _get_seize_call(child_traces)

        if debt_transfer is not None:
            debt_token_address = debt_transfer.token_address
            debt_purchase_amount = debt_transfer.amount

        if received_transfer is not None:
            received_token_address = received_transfer.token_address
            received_amount = received_transfer.amount

        elif seize_trace is not None and seize_trace.inputs is not None:
            received_amount = seize_trace.inputs["seizeTokens"]

        if received_amount is None:
            return None

        return Liquidation(
            liquidated_user=liquidated,
            debt_token_address=debt_token_address,
            liquidator_user=liquidator,
            debt_purchase_amount=debt_purchase_amount,
            protocol=liquidation_trace.protocol,
            received_amount=received_amount,
            received_token_address=received_token_address,
            transaction_hash=liquidation_trace.transaction_hash,
            trace_address=liquidation_trace.trace_address,
            block_number=liquidation_trace.block_number,
            error=liquidation_trace.error,
        )

        return None


CREAM_CRETH_SPEC = ClassifierSpec(
    abi_name="CEther",
    protocol=Protocol.cream,
    valid_contract_addresses=["0x1ffe17b99b439be0afc831239ddecda2a790ff3a"],
    classifiers={
        "liquidateBorrow(address,address)": CreamLiquidationClassifier,
        "seize(address,address,uint256)": SeizeClassifier,
    },
)

CREAM_CTOKEN_SPEC = ClassifierSpec(
    abi_name="CToken",
    protocol=Protocol.cream,
    valid_contract_addresses=[
        "0x1ffe17b99b439be0afc831239ddecda2a790ff3a"
        "0x15CC701370cb8ADA2a2B6f4226eC5CF6AA93bC67"
        "0x2bc4eb013ddee29d37920938b96d353171289b7c",
        "0x11883Cdea6bAb720092791cc89affa54428Ce069",
        "0xAa46e2c21B7763a73DB48e9b318899253E66e20C",
        "0xCb87Cee8c77CdFD310fb3C58ff72e688d46f90b1",
        "0xb31f5d117541825D6692c10e4357008EDF3E2BCD",
        "0x8cc7E2a6de999758499658bB702143FD025E09B2",
        "0xEF6d459FE81C3Ed53d292c936b2df5a8084975De",
        "0x3942936782d788ce69155F776A51A5F1C9dd9B22",
        "0x53D88d2ffDBE71E81D95b08AE0cA49D0C4A8515f",
        "0x81C15D3E956e55e77E1f3F257f0A65Bd2725fC55",
        "0x426D6D53187be3288fe37f214e3F6901D8145b62",
        "0x738f3810b3dA0F3e6dC8C689D0d72f3b4992c43b",
        "0x19eE64850862cFd234e20c0db4edA286f12ec907",
        "0x9095e8d707E40982aFFce41C61c10895157A1B22",
        "0xE692714717a89E4F2ab89dd17d8DDdD7bb52De8e",
        "0x1aF8c1C3AD36A041cb6678feD86B1E095004fd16",
        "0xEA466cd2583A0290b9E7b987a769a7Eb468FB0A5",
        "0x3B0Be453a4008EBc2eDd457e7Bd355f1C5469d68",
        "0x0E9d900C884964dC4B26db96Ba113825B1a09Baa",
        "0xD83C88DB3A6cA4a32FFf1603b0f7DDce01F5f727",
        "0x264Bc4Ea2F45cF6331AD6C3aC8d7257Cf487FcbC",
        "0x2d3bfaDF9BC94E3Ab796029A030e863F1898aA06",
        "0xbf9b95b78bc42f6cf53ff2a0ce19d607cfe1ff82",
        "0x4ebdef163ff08ac1d56a89bafefd6c01cc28a48f",
        "0x4cB7F1f4aD7a6b53802589Af3B90612C1674Fec4",
        "0x84902bd5ccef97648Bf69C5096729A9367043bEb",
        "0xF77DF34F4Bf632Fb5CA928592a73a29A42BCf0B1",
        "0x7F746A80506a4cafA39938f7C08Ad59cFa6dE418",
        "0xbE7E1d74AcAE787355169bC61A8729b2040fCe6b",
        "0xDCf60E349a5AAeeEcdd2fb6772931FBF3486eD1C",
        "0xc17C8C5b8bB9456c624f8534FdE6cBda2451488C",
        "0xa8D75A0D17D2f4F2f4673975Ab8470269D019c96",
        "0x9B53e7D5e3F6Cc8694840eD6C9f7fee79e7Bcee5"
   
    ],
    classifiers={
        "liquidateBorrow(address,uint256,address)": CreamLiquidationClassifier,
        "seize(address,address,uint256)": SeizeClassifier,
    },
)

CREAM_CLASSIFIER_SPECS: List[ClassifierSpec] = [
    CREAM_CRETH_SPEC,
    CREAM_CTOKEN_SPEC,
]


def _get_seize_call(traces: List[ClassifiedTrace]) -> Optional[ClassifiedTrace]:
    """Find the call to `seize` in the child traces (successful liquidation)"""
    for trace in traces:
        if trace.classification == Classification.seize:
            return trace
    return None
