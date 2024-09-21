const { types } = require("pg");
const pool = require("../db");

let prices;

async function getDailyTransaction(day = 1) {
  try {
    const client = await pool.connect();

    const arbitrageUsd = await client.query(
      `SELECT a.profit_token_address, t.decimals, SUM(a.profit_usd) AS total_profit_amount FROM  arbitrages_view a JOIN tokens t ON  LOWER(a.profit_token_address) = LOWER(t.token_address)  WHERE  a.profit_usd > 0 AND a.profit_usd < 2000000000000000000 AND a.created_at >= NOW() - INTERVAL '${day} day' GROUP BY a.profit_token_address, t.decimals;`
    );

    const sandwichUsd = await client.query(
      `SELECT s.profit_token_address, t.decimals, SUM(s.profit_usd) AS total_profit_amount FROM sandwiched_view s JOIN tokens t ON  LOWER(s.profit_token_address) = LOWER(t.token_address) WHERE  s.profit_amount > 0 AND s.profit_usd < 2000000000000000000 AND s.created_at >= NOW() - INTERVAL '${day} day' GROUP BY s.profit_token_address ,t.decimals;`
    );

    arbSum = 0;
    arbitrageUsd.rows.forEach((row) => {
      arbSum += Number(row.total_profit_amount) / 10 ** Number(row.decimals);
    });

    sandSum = 0;
    sandwichUsd.rows.forEach((row) => {
      sandSum += Number(row.total_profit_amount) / 10 ** Number(row.decimals);
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
    const recentTransactions = await client.query(
      `SELECT * FROM  arbitrages_view av WHERE  av.profit_usd < 2000000000000000000 ORDER BY av.block_number DESC LIMIT 10;`
    );

    const sandwichedTransaction = await client.query(
      `SELECT * FROM sandwiched_view sv WHERE sv.profit_usd < 2000000000000000000 ORDER BY sv.block_number DESC LIMIT 10;`
    );

    arbtxs = recentTransactions.rows.map((d) => {
      let obj = {};
      obj.created_at = d.created_at;
      obj.from = d.transaction_from_address;
      obj.contract_address = d.transaction_to_address;
      obj.transaction_hash = d.transaction_hash;
      obj.protocols = d.protocols;
      obj.transfers = d.transfers
        .map((d) => d.token_address)
        .filter(
          (value, index, self) =>
            self.findIndex(
              (obj) => JSON.stringify(obj) === JSON.stringify(value)
            ) === index
        );
      obj.block_number = d.block_number;
      obj.profit_token_address = d.profit_token_address;
      obj.gas_cost = d.cost_usd;
      obj.profit_usd = d.profit_usd;
      obj.type = "Arbitrage";
      return obj;
    });

    let filterData = {};
    sandwichedTransaction.rows.forEach((d) => {
      let key =
        d.frontrun_transaction_hash + d.backrun_transaction_hash.slice(2);
      if (filterData[key]) {
        filterData[key].protocol.push(
          d.backrun_swap.protocol,
          d.frontrun_swap.protocol
        );
        filterData[key].tokens.push(
          d.frontrun_swap.token_in_address,
          d.frontrun_swap.token_out_address,
          d.backrun_swap.token_in_address,
          d.backrun_swap.token_out_address
        );
      } else {
        let obj = {
          created_at: d.created_at,
          sandwicher_address: d.sandwicher_address,
          profit_amount: d.profit_amount,
          profit_token_address: d.profit_token_address,
          backrun_swap_transaction_hash: d.backrun_transaction_hash,
          frontrun_swap_transaction_hash: d.frontrun_transaction_hash,
          block_number: d.block_number,
          protocol: [d.backrun_swap.protocol, d.frontrun_swap.protocol],
          tokens: [
            d.frontrun_swap.token_in_address,
            d.frontrun_swap.token_out_address,
            d.backrun_swap.token_in_address,
            d.backrun_swap.token_out_address,
          ],
          gas_usd: d.cost_usd,
          profit_usd: d.profit_usd,
          transaction_to_address: d.transaction_to_address,
          transaction_from_address: d.transaction_from_address,
        };
        filterData[key] = obj;
      }
    });

    sandwichtxs = Object.values(filterData).map((d) => {
      let obj = {};
      obj.created_at = d.created_at;
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
      obj.gas_cost = d.gas_usd;
      obj.profit_usd = d.profit_usd;
      obj.type = "Sandwich";
      return obj;
    });

    let result = [...sandwichtxs, ...arbtxs].sort(
      (a, b) => Number(b.block_number) - Number(a.block_number)
    );
    return {
      result: result,
      arbitrageBlock: arbtxs[0]?.block_number,
      sandwichBlock: sandwichtxs[0]?.block_number,
    };
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
    // const recentTransactions = await client.query(
    //   `SELECT * FROM  arbitrages_view av WHERE av.profit_usd < 2000000000000000000 AND av.transaction_hash NOT IN (SELECT transaction_hash FROM classified_traces WHERE error = 'Reverted') ORDER BY av.profit_usd DESC LIMIT 2;`
    // );
    const recentTransactions = await client.query(
      `SELECT * FROM  arbitrages_view av WHERE av.profit_usd < 2000000000000000000  ORDER BY av.block_number DESC LIMIT 10;`
    );
    // const sandwichedTransaction = await client.query(
    //   `SELECT * FROM sandwiched_view sv WHERE sv.profit_usd < 2000000000000000000 AND sv.frontrun_transaction_hash NOT IN (SELECT transaction_hash FROM classified_traces WHERE error = 'Reverted') AND  sv.backrun_transaction_hash NOT IN (SELECT transaction_hash FROM classified_traces WHERE error = 'Reverted') ORDER BY sv.block_number DESC LIMIT 2;`
    // );
    const sandwichedTransaction = await client.query(
      `SELECT * FROM sandwiched_view sv WHERE sv.profit_usd < 2000000000000000000  ORDER BY sv.block_number DESC LIMIT 10;`
    );
    arbtxs = recentTransactions.rows.map((d) => {
      let obj = {};
      obj.created_at = d.created_at;
      obj.from = d.transaction_from_address;
      obj.contract_address = d.transaction_to_address;
      obj.transaction_hash = d.transaction_hash;
      obj.protocols = d.protocols;
      obj.transfers = d.transfers
        .map((d) => d.token_address)
        .filter(
          (value, index, self) =>
            self.findIndex(
              (obj) => JSON.stringify(obj) === JSON.stringify(value)
            ) === index
        );
      obj.block_number = d.block_number;
      obj.profit_token_address = d.profit_token_address;
      obj.gas_cost = d.cost_usd;
      obj.profit_usd = d.profit_usd;
      obj.type = "Arbitrage";
      return obj;
    });

    let filterData = {};
    sandwichedTransaction.rows.forEach((d) => {
      let key =
        d.frontrun_transaction_hash + d.backrun_transaction_hash.slice(2);
      if (filterData[key]) {
        filterData[key].protocol.push(
          d.backrun_swap.protocol,
          d.frontrun_swap.protocol
        );
        filterData[key].tokens.push(
          d.frontrun_swap.token_in_address,
          d.frontrun_swap.token_out_address,
          d.backrun_swap.token_in_address,
          d.backrun_swap.token_out_address
        );
      } else {
        let obj = {
          created_at: d.created_at,
          sandwicher_address: d.sandwicher_address,
          profit_amount: d.profit_amount,
          profit_token_address: d.profit_token_address,
          backrun_swap_transaction_hash: d.backrun_transaction_hash,
          frontrun_swap_transaction_hash: d.frontrun_transaction_hash,
          block_number: d.block_number,
          protocol: [d.backrun_swap.protocol, d.frontrun_swap.protocol],
          tokens: [
            d.frontrun_swap.token_in_address,
            d.frontrun_swap.token_out_address,
            d.backrun_swap.token_in_address,
            d.backrun_swap.token_out_address,
          ],
          gas_usd: d.cost_usd,
          profit_usd: d.profit_usd,
          transaction_to_address: d.transaction_to_address,
          transaction_from_address: d.transaction_from_address,
        };
        filterData[key] = obj;
      }
    });

    sandwichtxs = Object.values(filterData).map((d) => {
      let obj = {};
      obj.created_at = d.created_at;
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
      obj.gas_cost = d.gas_usd;
      obj.profit_usd = d.profit_usd;
      obj.type = "Sandwich";
      return obj;
    });

    // let sandwichTx = sandwichtxs.sort(
    //   (a, b) => Number(b.profit_usd) - Number(a.profit_usd)
    // );
    // let arbTx = arbtxs.sort(
    //   (a, b) => Number(b.profit_usd) - Number(a.profit_usd)
    // );
    let result = [...sandwichtxs, ...arbtxs].sort(
      (a, b) => Number(b.block_number) - Number(a.block_number)
    );
    return {
      result: result,
      arbitrageBlock: arbtxs[0]?.block_number,
      sandwichBlock: sandwichtxs[0]?.block_number,
    };
    // return { sandwich: sandwichTx.slice(0, 5), arbitrage: arbTx.slice(0, 5) };
  } catch (e) {
    console.log("Error:", e);
    return { sandwich: [], arbitrage: [] };
  } finally {
    if (client) {
      client.release(); // Release the client back to the pool
    }
  }
}




module.exports = {
  getDailyTransaction,
  getRecentTranscations,
  getTopTranscations,
};
