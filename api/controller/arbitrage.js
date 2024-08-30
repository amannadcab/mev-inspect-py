const { types } = require("pg");
const pool = require("../db");
let prices;

async function getDailyTransaction() {
  try {
    const client = await pool.connect();

    const arbitrageUsd = await client.query(
      "SELECT a.profit_token_address, t.decimals, SUM(a.profit_amount) AS total_profit_amount FROM  arbitrages a JOIN tokens t ON  LOWER(a.profit_token_address) = LOWER(t.token_address)  WHERE  a.profit_amount > 0 GROUP BY a.profit_token_address, t.decimals;"
    );

    const sandwichUsd = await client.query(
      "SELECT s.profit_token_address, t.decimals, SUM(s.profit_amount) AS total_profit_amount FROM sandwiches s JOIN tokens t ON  LOWER(s.profit_token_address) = LOWER(t.token_address) WHERE  s.profit_amount > 0  GROUP BY s.profit_token_address ,t.decimals;"
    );

    arbSum = 0;
    arbitrageUsd.rows.forEach((row) => {
      arbSum +=
        (prices[row.profit_token_address] * Number(row.total_profit_amount)) /
        10 ** Number(row.decimals);
    });

    sandSum = 0;
    sandwichUsd.rows.forEach((row) => {
      sandSum +=
        (prices[row.profit_token_address] * Number(row.total_profit_amount)) /
        10 ** Number(row.decimals);
    });
    client.release();
    return {
      totalArbitrageUsd: arbSum,
      totalSandwichUsd: sandSum,
    };
  } catch (e) {
    console.log("Error:", e);
    return {
      status: 400,
      error: e.message,
    };
  }
}

async function getRecentTranscations() {
  const client = await pool.connect();
  try {
    const recentTransactions = await client.query(`
SELECT 
    a.*,
    mev.gas_used,
    mev.gas_price,
    mev.coinbase_transfer,
    mev.miner_address,
    mev.base_fee_per_gas,
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'from_address', t.from_address,
            'to_address', t.to_address,
            'token_address', t.token_address,
            'amount', t.amount
        )
    ) AS transfrs,
    mp.transaction_from_address,  
    mp.transaction_to_address   
FROM 
    arbitrages a
LEFT JOIN 
    transfers t
    ON a.transaction_hash = t.transaction_hash
JOIN 
    mev_summary mev 
    ON a.transaction_hash = mev.transaction_hash
LEFT JOIN 
    miner_payments mp
    ON a.transaction_hash = mp.transaction_hash  
WHERE 
    a.transaction_hash NOT IN (
        SELECT 
            transaction_hash 
        FROM 
            classified_traces 
        WHERE 
            error = 'Reverted'
    )
GROUP BY
    a.id,
    mev.gas_used,
    mev.gas_price,
    mev.coinbase_transfer,
    mev.miner_address,
    mev.base_fee_per_gas,
    mp.transaction_from_address,  
    mp.transaction_to_address     
LIMIT 10;

  `);

    const sandwichedTransaction = await client.query(`
WITH swap_details AS (
    SELECT 
        transaction_hash, 
        protocol, 
        token_in_address, 
        token_out_address
    FROM 
        swaps
    WHERE 
        transaction_hash IN (
            SELECT frontrun_swap_transaction_hash FROM sandwiches
            UNION
            SELECT backrun_swap_transaction_hash FROM sandwiches
        )
)

SELECT DISTINCT 
    s.sandwicher_address, 
    s.profit_amount,
    s.profit_token_address, 
    s.backrun_swap_transaction_hash, 
    s.frontrun_swap_transaction_hash, 
    s.block_number, 
    sd_back.protocol AS backrun_protocol,
    sd_back.token_in_address AS backrun_token_in_address,
    sd_back.token_out_address AS backrun_token_out_address,
    sd_front.protocol AS frontrun_protocol,
    sd_front.token_in_address AS frontrun_token_in_address,
    sd_front.token_out_address AS frontrun_token_out_address,
    bminer.gas_price AS b_gas_price,
    bminer.base_fee_per_gas AS b_base_fee_per_gas,
    bminer.gas_price_with_coinbase_transfer AS b_gas_price_with_coinbase_transfer,
    bminer.gas_used AS b_gas_used,
    bminer.transaction_to_address AS b_transaction_to_address,
    bminer.transaction_from_address AS b_transaction_from_address,
    fminer.coinbase_transfer AS fcoinbase_transfer,
    fminer.gas_price AS fgas_price,
    fminer.base_fee_per_gas AS fbase_fee_per_gas,
    fminer.gas_price_with_coinbase_transfer AS fgas_price_with_coinbase_transfer,
    fminer.gas_used AS fgas_used,
    fminer.transaction_to_address AS ftransaction_to_address,
    fminer.transaction_from_address AS ftransaction_from_address
FROM 
    sandwiches s
INNER JOIN 
    miner_payments fminer  
    ON fminer.transaction_hash = s.frontrun_swap_transaction_hash 
INNER JOIN 
    miner_payments bminer  
    ON bminer.transaction_hash = s.backrun_swap_transaction_hash 
LEFT JOIN 
    swap_details sd_back 
    ON s.backrun_swap_transaction_hash = sd_back.transaction_hash
LEFT JOIN 
    swap_details sd_front 
    ON s.frontrun_swap_transaction_hash = sd_front.transaction_hash
ORDER BY 
    s.block_number DESC
LIMIT 100;
  `);

    wbnb = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

    arbtxs = recentTransactions.rows.map((d) => {
      let obj = {};
      obj.from = d.transaction_from_address;
      obj.contract_address = d.transaction_to_address;
      obj.transaction_hash = d.transaction_hash;
      obj.protocols = d.protocols;
      obj.transfers = d.transfrs.map((d) => d.token_address).filter(
        (value, index, self) =>
          self.findIndex(
            (obj) => JSON.stringify(obj) === JSON.stringify(value)
          ) === index
      );
      obj.block_number = d.block_number;
      obj.profit_token_address = d.profit_token_address;
      obj.gas_cost = ((d.gas_used * d.gas_price) / 1e18) * prices[wbnb];
      obj.profit_usd = d.profit_amount * prices[d.profit_token_address];
      obj.type = "Arbitrage";
      return obj;
    });
    let filterData = {};
    sandwichedTransaction.rows.forEach((d) => {
      let key =
        d.frontrun_swap_transaction_hash +
        d.backrun_swap_transaction_hash.slice(2);
      if (filterData[key]) {
        filterData[key].protocol.push(d.backrun_protocol, d.frontrun_protocol);
        filterData[key].tokens.push(
          d.frontrun_token_in_address,
          d.frontrun_token_out_address,
          d.backrun_token_in_address,
          d.backrun_token_out_address
        );
      } else {
        let obj = {
          sandwicher_address: d.sandwicher_address,
          profit_amount: d.profit_amount,
          profit_token_address: d.profit_token_address,
          backrun_swap_transaction_hash: d.backrun_swap_transaction_hash,
          frontrun_swap_transaction_hash: d.frontrun_swap_transaction_hash,
          block_number: d.block_number,
          protocol: [d.backrun_protocol, d.frontrun_protocol],
          tokens: [
            d.frontrun_token_in_address,
            d.frontrun_token_out_address,
            d.backrun_token_in_address,
            d.backrun_token_out_address,
          ],
          gas_price: Number(d.fgas_price) + Number(d.b_gas_price),
          base_fee_per_gas: Number(d.fbase_fee_per_gas) + d.b_base_fee_per_gas,
          gas_price_with_coinbase_transfer:
            Number(d.fgas_price_with_coinbase_transfer) +
            Number(d.b_gas_price_with_coinbase_transfer),
          gas_used: Number(d.fgas_used) + Number(d.b_gas_used),
          transaction_to_address: d.b_transaction_to_address,
          transaction_from_address: d.b_transaction_from_address,
        };
        filterData[key] = obj;
      }
    });

    sandwichtxs = Object.values(filterData).map((d) => {
      let obj = {};
      obj.from = d.transaction_from_address;
      obj.contract_address = d.transaction_to_address;
      obj.transaction_hash = d.backrun_swap_transaction_hash;
      obj.protocols = d.protocol.filter(
        (value, index, self) =>
          self.findIndex(
            (obj) => JSON.stringify(obj) === JSON.stringify(value)
          ) === index
      );
      obj.transfers = d.tokens.filter(
        (value, index, self) =>
          self.findIndex(
            (obj) => JSON.stringify(obj) === JSON.stringify(value)
          ) === index
      );
      obj.block_number = d.block_number;
      obj.profit_token_address = d.profit_token_address;
      obj.gas_cost = ((d.gas_used * d.gas_price) / 1e18) * prices[wbnb];
      obj.profit_usd = d.profit_amount * prices[d.profit_token_address];
      obj.type = "Sandwich";
      return obj;
    });

    let result = [...sandwichtxs, ...arbtxs].sort(
      (a, b) => Number(b.block_number) - Number(a.block_number)
    );

    return result;
  } catch (e) {
    console.log("Error:", e);
  } finally {
    if (client) {
      client.release(); // Release the client back to the pool
    }
  }
}


async function getTopTranscations() {
  const client = await pool.connect();
  try {
    const recentTransactions = await client.query(`
SELECT 
    a.*,
    mev.gas_used,
    mev.gas_price,
    mev.coinbase_transfer,
    mev.miner_address,
    mev.base_fee_per_gas,
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'from_address', t.from_address,
            'to_address', t.to_address,
            'token_address', t.token_address,
            'amount', t.amount
        )
    ) AS transfrs,
    mp.transaction_from_address,  
    mp.transaction_to_address   
FROM 
    arbitrages a
LEFT JOIN 
    transfers t
    ON a.transaction_hash = t.transaction_hash
JOIN 
    mev_summary mev 
    ON a.transaction_hash = mev.transaction_hash
LEFT JOIN 
    miner_payments mp
    ON a.transaction_hash = mp.transaction_hash  
WHERE 
    a.transaction_hash NOT IN (
        SELECT 
            transaction_hash 
        FROM 
            classified_traces 
        WHERE 
            error = 'Reverted'
    )
GROUP BY
    a.id,
    mev.gas_used,
    mev.gas_price,
    mev.coinbase_transfer,
    mev.miner_address,
    mev.base_fee_per_gas,
    mp.transaction_from_address,  
    mp.transaction_to_address 
ORDER BY
    a.profit_amount DESC
LIMIT 30;

  `);

    const sandwichedTransaction = await client.query(`
WITH swap_details AS (
    SELECT 
        transaction_hash, 
        protocol, 
        token_in_address, 
        token_out_address
    FROM 
        swaps
    WHERE 
        transaction_hash IN (
            SELECT frontrun_swap_transaction_hash FROM sandwiches
            UNION
            SELECT backrun_swap_transaction_hash FROM sandwiches
        )
)

SELECT DISTINCT 
    s.sandwicher_address, 
    s.profit_amount,
    s.profit_token_address, 
    s.backrun_swap_transaction_hash, 
    s.frontrun_swap_transaction_hash, 
    s.block_number, 
    sd_back.protocol AS backrun_protocol,
    sd_back.token_in_address AS backrun_token_in_address,
    sd_back.token_out_address AS backrun_token_out_address,
    sd_front.protocol AS frontrun_protocol,
    sd_front.token_in_address AS frontrun_token_in_address,
    sd_front.token_out_address AS frontrun_token_out_address,
    bminer.gas_price AS b_gas_price,
    bminer.base_fee_per_gas AS b_base_fee_per_gas,
    bminer.gas_price_with_coinbase_transfer AS b_gas_price_with_coinbase_transfer,
    bminer.gas_used AS b_gas_used,
    bminer.transaction_to_address AS b_transaction_to_address,
    bminer.transaction_from_address AS b_transaction_from_address,
    fminer.coinbase_transfer AS fcoinbase_transfer,
    fminer.gas_price AS fgas_price,
    fminer.base_fee_per_gas AS fbase_fee_per_gas,
    fminer.gas_price_with_coinbase_transfer AS fgas_price_with_coinbase_transfer,
    fminer.gas_used AS fgas_used,
    fminer.transaction_to_address AS ftransaction_to_address,
    fminer.transaction_from_address AS ftransaction_from_address
FROM 
    sandwiches s
INNER JOIN 
    miner_payments fminer  
    ON fminer.transaction_hash = s.frontrun_swap_transaction_hash 
INNER JOIN 
    miner_payments bminer  
    ON bminer.transaction_hash = s.backrun_swap_transaction_hash 
LEFT JOIN 
    swap_details sd_back 
    ON s.backrun_swap_transaction_hash = sd_back.transaction_hash
LEFT JOIN 
    swap_details sd_front 
    ON s.frontrun_swap_transaction_hash = sd_front.transaction_hash
ORDER BY
    s.profit_amount DESC
LIMIT 100;
  `);

    wbnb = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

    arbtxs = recentTransactions.rows.map((d) => {
      let obj = {};
      obj.from = d.transaction_from_address;
      obj.contract_address = d.transaction_to_address;
      obj.transaction_hash = d.transaction_hash;
      obj.protocols = d.protocols;
      obj.transfers = d.transfrs.map((d) => d.token_address).filter(
        (value, index, self) =>
          self.findIndex(
            (obj) => JSON.stringify(obj) === JSON.stringify(value)
          ) === index
      );
      obj.block_number = d.block_number;
      obj.profit_token_address = d.profit_token_address;
      obj.gas_cost = ((d.gas_used * d.gas_price) / 1e18) * prices[wbnb];
      obj.profit_usd = d.profit_amount * prices[d.profit_token_address];
      obj.type = "Arbitrage";
      return obj;
    });
    let filterData = {};
    sandwichedTransaction.rows.forEach((d) => {
      let key =
        d.frontrun_swap_transaction_hash +
        d.backrun_swap_transaction_hash.slice(2);
      if (filterData[key]) {
        filterData[key].protocol.push(d.backrun_protocol, d.frontrun_protocol);
        filterData[key].tokens.push(
          d.frontrun_token_in_address,
          d.frontrun_token_out_address,
          d.backrun_token_in_address,
          d.backrun_token_out_address
        );
      } else {
        let obj = {
          sandwicher_address: d.sandwicher_address,
          profit_amount: d.profit_amount,
          profit_token_address: d.profit_token_address,
          backrun_swap_transaction_hash: d.backrun_swap_transaction_hash,
          frontrun_swap_transaction_hash: d.frontrun_swap_transaction_hash,
          block_number: d.block_number,
          protocol: [d.backrun_protocol, d.frontrun_protocol],
          tokens: [
            d.frontrun_token_in_address,
            d.frontrun_token_out_address,
            d.backrun_token_in_address,
            d.backrun_token_out_address,
          ],
          gas_price: Number(d.fgas_price) + Number(d.b_gas_price),
          base_fee_per_gas: Number(d.fbase_fee_per_gas) + d.b_base_fee_per_gas,
          gas_price_with_coinbase_transfer:
            Number(d.fgas_price_with_coinbase_transfer) +
            Number(d.b_gas_price_with_coinbase_transfer),
          gas_used: Number(d.fgas_used) + Number(d.b_gas_used),
          transaction_to_address: d.b_transaction_to_address,
          transaction_from_address: d.b_transaction_from_address,
        };
        filterData[key] = obj;
      }
    });

    sandwichtxs = Object.values(filterData).map((d) => {
      let obj = {};
      obj.from = d.transaction_from_address;
      obj.contract_address = d.transaction_to_address;
      obj.transaction_hash = d.backrun_swap_transaction_hash;
      obj.protocols = d.protocol.filter(
        (value, index, self) =>
          self.findIndex(
            (obj) => JSON.stringify(obj) === JSON.stringify(value)
          ) === index
      );
      obj.transfers = d.tokens.filter(
        (value, index, self) =>
          self.findIndex(
            (obj) => JSON.stringify(obj) === JSON.stringify(value)
          ) === index
      );
      obj.block_number = d.block_number;
      obj.profit_token_address = d.profit_token_address;
      obj.gas_cost = ((d.gas_used * d.gas_price) / 1e18) * prices[wbnb];
      obj.profit_usd = d.profit_amount * prices[d.profit_token_address];
      obj.type = "Sandwich";
      return obj;
    });

    let sandwichTx = sandwichtxs.sort(
      (a, b) => Number(b.profit_usd) - Number(a.profit_usd)
    );
    let arbTx = arbtxs.sort(
      (a, b) => Number(b.profit_usd) - Number(a.profit_usd)
    );
    return {sandwich:sandwichTx.slice(0,5),arbitrage:arbTx.slice(0,5)};
  } catch (e) {
    console.log("Error:", e);
  } finally {
    if (client) {
      client.release(); // Release the client back to the pool
    }
  }
}

async function loadPrice() {
  prices = await fetch("https://api.sushi.com/price/v1/56").then((d) =>
    d.json()
  );
}


loadPrice();

module.exports = {
  getDailyTransaction,
  getRecentTranscations,
  getTopTranscations
};
