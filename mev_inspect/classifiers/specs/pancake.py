from typing import List, Optional

from mev_inspect.classifiers.helpers import create_swap_from_pool_transfers
from mev_inspect.schemas.classifiers import ClassifierSpec, SwapClassifier
from mev_inspect.schemas.swaps import Swap
from mev_inspect.schemas.traces import DecodedCallTrace, Protocol
from mev_inspect.schemas.transfers import Transfer

PANCAKE_V2_PAIR_ABI_NAME = "PancakeV2Pair"
PANCAKE_V3_POOL_ABI_NAME = "PancakeV3Pool"


class PancakeV3SwapClassifier(SwapClassifier):
    @staticmethod
    def parse_swap(
        trace: DecodedCallTrace,
        prior_transfers: List[Transfer],
        child_transfers: List[Transfer],
    ) -> Optional[Swap]:

        recipient_address = trace.inputs.get("recipient", trace.from_address)

        swap = create_swap_from_pool_transfers(
            trace, recipient_address, prior_transfers, child_transfers
        )
        return swap


class PancakeV2SwapClassifier(SwapClassifier):
    @staticmethod
    def parse_swap(
        trace: DecodedCallTrace,
        prior_transfers: List[Transfer],
        child_transfers: List[Transfer],
    ) -> Optional[Swap]:
        recipient_address = trace.inputs.get("to", trace.from_address)
        swap = create_swap_from_pool_transfers(
            trace, recipient_address, prior_transfers, child_transfers
        )
        return swap


PANCAKE_V3_CONTRACT_SPECS = [
    ClassifierSpec(
        abi_name="PancakeV3Factory",
        protocol=Protocol.pancake_v3,
        valid_contract_addresses=["0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865"],
    ),
    ClassifierSpec(
        abi_name="UniswapV3Factory",
        protocol=Protocol.uniswap_v3,
        valid_contract_addresses=["0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7"],
    ),
    ClassifierSpec(
        abi_name="UniswapV3Factory",
        protocol=Protocol.uniswap_v3, #algebra finance
        valid_contract_addresses=["0x306F06C147f064A010530292A1EB6737c3e378e4"],
    ),
    ClassifierSpec(
        abi_name="Multicall2",
        protocol=Protocol.pancake_v3,
        valid_contract_addresses=["0xac1cE734566f390A94b00eb9bf561c2625BF44ea"],
    ),
    ClassifierSpec(
        abi_name="Multicall2",
        protocol=Protocol.uniswap_v3,
        valid_contract_addresses=["0x963Df249eD09c358A4819E39d9Cd5736c3087184"],
    ),
    ClassifierSpec(
        abi_name="ProxyAdmin",
        protocol=Protocol.uniswap_v3,
        valid_contract_addresses=["0xC9A7f5b73E853664044ab31936D0E6583d8b1c79"],
    ),
    ClassifierSpec(
        abi_name="TickLens",
        protocol=Protocol.pancake_v3,
        valid_contract_addresses=["0x9a489505a00cE272eAa5e07Dba6491314CaE3796"],
    ),
    ClassifierSpec(
        abi_name="TickLens",
        protocol=Protocol.uniswap_v3,
        valid_contract_addresses=["0xD9270014D396281579760619CCf4c3af0501A47C"],
    ),
    ClassifierSpec(
        abi_name="Quoter",
        protocol=Protocol.pancake_v3,
        valid_contract_addresses=["0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997"],
    ),
    ClassifierSpec(
        abi_name="Quoter",
        protocol=Protocol.uniswap_v3,
        valid_contract_addresses=["0x78D78E420Da98ad378D7799bE8f4AF69033EB077"],
    ),
    ClassifierSpec(
        abi_name="Quoter",
        protocol=Protocol.uniswap_v3, #algebra finance
        valid_contract_addresses=["0xeA68020D6A9532EeC42D4dB0f92B83580c39b2cA"],
    ),
    ClassifierSpec(
        abi_name="SwapRouter",
        protocol=Protocol.pancake_v3,
        valid_contract_addresses=["0x1b81D678ffb9C0263b24A97847620C99d213eB14"],
    ),
    ClassifierSpec(
        abi_name="SwapRouter",
        protocol=Protocol.uniswap_v3,
        valid_contract_addresses=["0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2"],
    ),
    ClassifierSpec(
        abi_name="SwapRouter",
        protocol=Protocol.uniswap_v3, #algebra finance
        valid_contract_addresses=["0x327Dd3208f0bCF590A66110aCB6e5e6941A4EfA0"],
    ),
    
    ClassifierSpec(
        abi_name="NonfungiblePositionManager",
        protocol=Protocol.pancake_v3,
        valid_contract_addresses=["0x46A15B0b27311cedF172AB29E4f4766fbE7F4364"],
    ),
    ClassifierSpec(
        abi_name="NonfungiblePositionManager",
        protocol=Protocol.pancake_v3, # algebra finance
        valid_contract_addresses=["0xa51ADb08Cbe6Ae398046A23bec013979816B77Ab"],
    ),
    ClassifierSpec(
        abi_name="V3Migrator",
        protocol=Protocol.pancake_v3,
        valid_contract_addresses=["0xbC203d7f83677c7ed3F7acEc959963E7F4ECC5C2"],
    ),
    ClassifierSpec(
        abi_name="V3Migrator",
        protocol=Protocol.uniswap_v3,
        valid_contract_addresses=["0x32681814957e0C13117ddc0c2aba232b5c9e760f"],
    ),
    ClassifierSpec(
        abi_name="V3Migrator",
        protocol=Protocol.uniswap_v3, # algebra finance 
        valid_contract_addresses=["0x2AC5617f1C04641393bD3246F38521ede0FC9011"],
    ),
]

PANCAKE_V3_GENERAL_SPECS = [
    ClassifierSpec(
        abi_name=PANCAKE_V3_POOL_ABI_NAME,
        protocol=Protocol.pancake_v3,
        classifiers={
            "swap(address,bool,int256,uint160,bytes)": PancakeV3SwapClassifier,
        },
    ),
    ClassifierSpec(
        abi_name="IUniswapV3SwapCallback",
    ),
    ClassifierSpec(
        abi_name="IUniswapV3MintCallback",
    ),
    ClassifierSpec(
        abi_name="IUniswapV3FlashCallback",
    ),
]


PANCAKEPY_V2_CONTRACT_SPECS = [
     ClassifierSpec(
        abi_name="PancakeV2Router",
        protocol=Protocol.pancake_v2, # uniswap
        valid_contract_addresses=["0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"],
    ),
    ClassifierSpec(
        abi_name="PancakeV2Router",
        protocol=Protocol.pancake_v2,
        valid_contract_addresses=["0x10ED43C718714eb63d5aA57B78B54704E256024E"],
    ),
    ClassifierSpec(
        abi_name="UniswapV2Router",
        protocol=Protocol.sushiswap,
        valid_contract_addresses=["0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506"],
    ),
    ClassifierSpec(
        abi_name="UniswapV2Router",
        protocol=Protocol.sushiswap, #apeswap
        valid_contract_addresses=["0xcF0feBd3f17CEf5b47b0cD257aCf6025c5BFf3b7"],
    ),
    ClassifierSpec(
        abi_name="UniswapV2Router",
        protocol=Protocol.sushiswap, #biswap
        valid_contract_addresses=["0x3a6d8cA21D1CF76F653A67577FA0D27453350dD"],
    ),
    ClassifierSpec(
        abi_name="UniswapV2Router",
        protocol=Protocol.sushiswap, #backeryswap
        valid_contract_addresses=["0xCDe540d7eAFE93aC5fE6233Bee57E1270D3E330F"],
    ),
        ClassifierSpec(
        abi_name="UniswapV2Router",
        protocol=Protocol.sushiswap, #mdex
        valid_contract_addresses=["0x62c1A0d92B09D0912F7BB9c96C5ecdC7F2b87059"],
    ),
    ClassifierSpec(
        abi_name="UniswapV2Router",
        protocol=Protocol.sushiswap, #babySwap
        valid_contract_addresses=["0x8317c460C22A9958c27b4B6403b98d2Ef4E2ad32"],
    ),
    ClassifierSpec(
        abi_name="UniswapV2Router",
        protocol=Protocol.sushiswap, #babyDogeSwap
        valid_contract_addresses=["0xC9a0F685F39d05D835c369036251ee3aEaaF3c47"],
    ),
    
    ClassifierSpec(
        abi_name="UniswapV2Router",
        protocol=Protocol.sushiswap, #melegaSwap
        valid_contract_addresses=["0xc25033218D181b27D4a2944Fbb04FC055da4EAB3"],
    ),
    ClassifierSpec(
        abi_name="UniswapV2Router",
        protocol=Protocol.sushiswap, #nomiswap
        valid_contract_addresses=["0x13147820401f455e3318db8686958D457ad2E7b0"],
    ),
    ClassifierSpec(
        abi_name="UniswapV2Router",
        protocol=Protocol.sushiswap, #autoshark
        valid_contract_addresses=["0xB0EeB0632bAB15F120735e5838908378936bd484"],
    ),
    ClassifierSpec(
        abi_name="UniswapV2Router",
        protocol=Protocol.sushiswap, #jetswap
        valid_contract_addresses=["0xbe65b8f75b9f20f4c522e0067a3887fada714800"],
    ),
    ClassifierSpec(
        abi_name="UniswapV2Router",
        protocol=Protocol.sushiswap, #knightswap
        valid_contract_addresses=["0x05E61E0cDcD2170a76F9568a110CEe3AFdD6c46f"],
    ),
        ClassifierSpec(
        abi_name="UniswapV2Router",
        protocol=Protocol.sushiswap, #pinkswap
        valid_contract_addresses=["0x319EF69a98c8E8aAB36Aea561Daba0Bf3D0fa3ac"],
    ),
    
        ClassifierSpec(
        abi_name="UniswapV2Router",
        protocol=Protocol.sushiswap, #pandaswap
        valid_contract_addresses=["0x29D1Adbb65d93a5710cafe2EF0E8131f64E6AB22"],
    ),
    ClassifierSpec(
        abi_name="UniswapV2Router",
        protocol=Protocol.sushiswap, #definixSwap
        valid_contract_addresses=["0x151030a9Fa62FbB202eEe50Bd4A4057AB9E826AD"],
    ),
    ClassifierSpec(
        abi_name="UniswapV2Router",
        protocol=Protocol.sushiswap, #Impossible finance
        valid_contract_addresses=["0x56F6Ca0a3364Fa3aC9F0E8E9858b2966CdF39d03"],
    ),
    ClassifierSpec(
        abi_name="OdosRouter",
        protocol=Protocol.odos, #Odos finance
        valid_contract_addresses=["0x89b8aa89fdd0507a99d334cbe3c808fafc7d850e"],
    ),
]

PANCAKEPY_V2_PAIR_SPEC = ClassifierSpec(
    abi_name=PANCAKE_V2_PAIR_ABI_NAME,
    protocol=Protocol.pancake_v2,
    classifiers={
        "swap(uint256,uint256,address,bytes)": PancakeV2SwapClassifier,
    },
)


PANCAKE_CLASSIFIER_SPECS: List = [
    *PANCAKE_V3_CONTRACT_SPECS,
    *PANCAKEPY_V2_CONTRACT_SPECS,
    *PANCAKE_V3_GENERAL_SPECS,
    PANCAKEPY_V2_PAIR_SPEC,
]
