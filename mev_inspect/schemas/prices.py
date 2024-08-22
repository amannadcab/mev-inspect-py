from datetime import datetime

from pydantic import BaseModel, validator

BNB_TOKEN_ADDRESS =  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
WBNB_TOKEN_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
WETH_TOKEN_ADDRESS = "0x2170Ed0880ac9A755fd29B2688956BD959F933F8"
WBTC_TOKEN_ADDRESS = "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c"
USDC_TOKEN_ADDRESS = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"
DAI_TOKEN_ADDRESS =  "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3"
BUSD_TOKEN_ADDRESS = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"
USDT_TOKEN_ADDRESS = "0x55d398326f99059fF775485246999027B3197955"
CAKE_TOKEN_ADDRESS = "0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82"

TOKEN_ADDRESSES = [
 BNB_TOKEN_ADDRESS,
 WBNB_TOKEN_ADDRESS,
 WBTC_TOKEN_ADDRESS,
 WETH_TOKEN_ADDRESS,
 USDC_TOKEN_ADDRESS,
 DAI_TOKEN_ADDRESS,
 BUSD_TOKEN_ADDRESS,
 USDT_TOKEN_ADDRESS,
 CAKE_TOKEN_ADDRESS
]

COINGECKO_ID_BY_ADDRESS = {
    WETH_TOKEN_ADDRESS: "binance-peg-weth",
    WBTC_TOKEN_ADDRESS: "binance-bitcoin",
    USDC_TOKEN_ADDRESS: "usd-coin",
    DAI_TOKEN_ADDRESS: "binance-peg-dai",
    WBNB_TOKEN_ADDRESS: "wbnb",
    BNB_TOKEN_ADDRESS: "binancecoin",
    BUSD_TOKEN_ADDRESS:"binance-peg-busd",
    USDT_TOKEN_ADDRESS:"binance-bridged-usdt-bnb-smart-chain",
    CAKE_TOKEN_ADDRESS:"pancakeswap-token"
}


class Price(BaseModel):
    token_address: str
    usd_price: float
    timestamp: datetime

    @validator("token_address")
    def lower_token_address(cls, v: str) -> str:
        return v.lower()
