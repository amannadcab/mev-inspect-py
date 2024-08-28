const { types } = require("pg");
const pool = require("../db");
let prices;

async function getDailyTransaction() {
  try {

    const client = await pool.connect();

    const arbitrageUsd = await client.query(
      "SELECT a.profit_token_address, t.decimals, SUM(a.profit_amount) AS total_profit_amount FROM arbitrages a JOIN tokens t ON  LOWER(a.profit_token_address) = LOWER(t.token_address) LEFT JOIN  classified_traces ct ON a.transaction_hash = ct.transaction_hash AND ct.error = 'Reverted' GROUP BY a.profit_token_address ,t.decimals;"
    );
    
    const sandwichUsd = await client.query(
      "SELECT s.profit_token_address, t.decimals, SUM(s.profit_amount) AS total_profit_amount FROM sandwiches s JOIN tokens t ON  LOWER(s.profit_token_address) = LOWER(t.token_address) LEFT JOIN classified_traces ct_back ON s.backrun_swap_transaction_hash = ct_back.transaction_hash AND ct_back.error = 'Reverted' LEFT JOIN  classified_traces ct_front ON s.frontrun_swap_transaction_hash = ct_front.transaction_hash AND ct_front.error = 'Reverted' GROUP BY s.profit_token_address ,t.decimals;"
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
    mp.transaction_from_address,  -- Directly selecting transaction_from_address
    mp.transaction_to_address     -- Directly selecting transaction_to_address
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
  SELECT
     s.*,
     sd.profit_amount,
     sd.profit_token_address,
     JSON_BUILD_OBJECT(
         'frontrun_swap_transaction_hash', sd.frontrun_swap_transaction_hash,
         'backrun_swap_transaction_hash', sd.backrun_swap_transaction_hash,
         'frontrun_swap_details', sf.*,
         'backrun_swap_details', sb.*
     ) AS sandwiches_data,
     JSON_BUILD_OBJECT(
         'transfer_front_data', tf.*,
         'transfer_back_data', tb.*
     ) AS trnsfrr,
    JSON_BUILD_OBJECT(
         'miner_payments_front', mpf.*,
         'miner_payments_back', mpb.*
     ) AS minerpayments
  FROM
     swaps s
  LEFT JOIN
     sandwiches sd
     ON s.transaction_hash = sd.frontrun_swap_transaction_hash
     OR s.transaction_hash = sd.backrun_swap_transaction_hash
  LEFT JOIN
     transfers tf
     ON sd.frontrun_swap_transaction_hash = tf.transaction_hash
  LEFT JOIN
     transfers tb
     ON sd.backrun_swap_transaction_hash = tb.transaction_hash
  LEFT JOIN
     swaps sf
     ON sd.frontrun_swap_transaction_hash = sf.transaction_hash
  LEFT JOIN
     swaps sb
     ON sd.backrun_swap_transaction_hash = sb.transaction_hash
  LEFT JOIN 
      miner_payments mpf
      ON sd.frontrun_swap_transaction_hash = mpf.transaction_hash 
  LEFT JOIN 
      miner_payments mpb
      ON sd.backrun_swap_transaction_hash = mpb.transaction_hash  
  WHERE
     (sd.frontrun_swap_transaction_hash IS NOT NULL
     OR sd.backrun_swap_transaction_hash IS NOT NULL)
     AND sd.frontrun_swap_transaction_hash NOT IN (
          SELECT 
              transaction_hash 
          FROM 
              classified_traces 
          WHERE 
              error = 'Reverted'
      )
     AND sd.backrun_swap_transaction_hash NOT IN (
          SELECT 
              transaction_hash 
          FROM 
              classified_traces 
          WHERE 
              error = 'Reverted'
      )
  LIMIT 10;
  
  `);

  wbnb = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

  arbtxs = recentTransactions.rows.map((d) => {
    let obj = {};
    obj.from = d.transaction_from_address;
    obj.contract_address = d.transaction_to_address;
    obj.transaction_hash = d.transaction_hash;
    obj.protocols = d.protocols;
    obj.transfers = d.transfrs;
    obj.block_number = d.block_number;
    obj.profit_token_address = d.profit_token_address;
    obj.gas_cost = ((d.gas_used * d.gas_price) / 1e18) * prices[wbnb];
    obj.profit_usd = d.profit_amount * prices[d.profit_token_address];
    obj.type = "Arbitrage";
    return obj;
  });

  sandwichtxs = sandwichedTransaction.rows.map((d) => {
    let obj = {};
    obj.from = d.minerpayments.miner_payments_front.transaction_from_address;
    obj.contract_address =
      d.minerpayments.miner_payments_front.transaction_to_address;
    obj.transaction_hash = d.transaction_hash;
    obj.protocols = [d.protocol];
    obj.transfers = [
      { token_address: d.token_in_address },
      { token_address: d.token_out_address },
    ];
    obj.block_number = d.block_number;
    obj.profit_token_address = d.profit_token_address;
    obj.gas_cost =
      ((d.minerpayments.miner_payments_front.gas_used *
        d.minerpayments.miner_payments_front.gas_price) /
        1e18 +
        (d.minerpayments.miner_payments_back.gas_used *
          d.minerpayments.miner_payments_back.gas_price) /
          1e18) *
      prices[wbnb];
    obj.profit_usd = d.profit_amount * prices[d.profit_token_address];
    obj.type = "Sandwich";
    return obj;
  });

  let result = [...sandwichtxs, ...arbtxs].sort(
    (a, b) => Number(b.block_number) - Number(a.block_number)
  );
  client.release();
  await client.end();
  return result;
}

async function loadPrice() {
  prices = await fetch("https://api.sushi.com/price/v1/56").then((d) =>
    d.json()
  );
}

async function getTopFiveRecord(req, res) {
  try {
    const query = `
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
    mp.transaction_from_address,  -- Directly selecting transaction_from_address
    mp.transaction_to_address     -- Directly selecting transaction_to_address
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

    ORDER BY a.profit_amount DESC
      LIMIT 5
    `;
    const client = await pool.connect();
    const result = await client.query(query); // Execute the query
    const arbData = result.rows;
    const querySand=`
      SELECT
     s.*,
     sd.profit_amount,
     sd.profit_token_address,
     JSON_BUILD_OBJECT(
         'frontrun_swap_transaction_hash', sd.frontrun_swap_transaction_hash,
         'backrun_swap_transaction_hash', sd.backrun_swap_transaction_hash,
         'frontrun_swap_details', sf.*,
         'backrun_swap_details', sb.*
     ) AS sandwiches_data,
     JSON_BUILD_OBJECT(
         'transfer_front_data', tf.*,
         'transfer_back_data', tb.*
     ) AS trnsfrr,
    JSON_BUILD_OBJECT(
         'miner_payments_front', mpf.*,
         'miner_payments_back', mpb.*
     ) AS minerpayments
  FROM
     swaps s
  LEFT JOIN
     sandwiches sd
     ON s.transaction_hash = sd.frontrun_swap_transaction_hash
     OR s.transaction_hash = sd.backrun_swap_transaction_hash
  LEFT JOIN
     transfers tf
     ON sd.frontrun_swap_transaction_hash = tf.transaction_hash
  LEFT JOIN
     transfers tb
     ON sd.backrun_swap_transaction_hash = tb.transaction_hash
  LEFT JOIN
     swaps sf
     ON sd.frontrun_swap_transaction_hash = sf.transaction_hash
  LEFT JOIN
     swaps sb
     ON sd.backrun_swap_transaction_hash = sb.transaction_hash
  LEFT JOIN 
      miner_payments mpf
      ON sd.frontrun_swap_transaction_hash = mpf.transaction_hash 
  LEFT JOIN 
      miner_payments mpb
      ON sd.backrun_swap_transaction_hash = mpb.transaction_hash  
  WHERE
     (sd.frontrun_swap_transaction_hash IS NOT NULL
     OR sd.backrun_swap_transaction_hash IS NOT NULL)
     AND sd.frontrun_swap_transaction_hash NOT IN (
          SELECT 
              transaction_hash 
          FROM 
              classified_traces 
          WHERE 
              error = 'Reverted'
      )
     AND sd.backrun_swap_transaction_hash NOT IN (
          SELECT 
              transaction_hash 
          FROM 
              classified_traces 
          WHERE 
              error = 'Reverted'
      )
      LIMIT 5;
    `;
    const resultSand = await client.query(querySand); // Execute the query
    const sandData=resultSand.rows;



    return res.json({
      arbitrage: {arbData,type:'arbitrage' },
      sandwich: {sandData,type:'sandwich' },
    });
  } catch (error) {
    console.error("Error fetching top 5 records:", error);
  }
}

loadPrice();
// setInterval(loadPrice,600000);

module.exports = {
  getDailyTransaction,
  getRecentTranscations,
  getTopFiveRecord,
};
