const { types } = require("pg");
const pool = require("../db");

let prices;

async function getDailyTransaction(day = 1) {
  try {
    const client = await pool.connect();

    const arbitrageUsd = await client.query(
      `SELECT a.profit_token_address , SUM(a.profit_usd) AS total_profit_amount FROM  arbitrages_view a   WHERE  a.profit_usd > 0 AND a.profit_usd < 2000000000000000000 AND a.created_at >= NOW() - INTERVAL '${day} day' AND a.transaction_to_address = '0x3b5997FfAF9B551b7A407C9FE310732A04b5A850'  GROUP BY a.profit_token_address;`
    );

    const liquidationUsd = await client.query(
      `SELECT a.profit_token_address, SUM(a.profit_usd) AS total_profit_amount FROM  arbitrages_view a   WHERE  a.profit_usd > 0 AND a.profit_usd < 2000000000000000000 AND a.created_at >= NOW() - INTERVAL '${day} day' AND a.transaction_to_address = '0xcd8b100e5495C9bdaf1F4F7C3c399989B1234cFe'  GROUP BY a.profit_token_address`
    );

    const sandwichUsd = await client.query(
      `SELECT s.profit_token_address, SUM(s.profit_usd) AS total_profit_amount FROM sandwiched_view s WHERE  s.profit_amount > 0 AND s.profit_usd < 2000000000000000000 AND s.created_at >= NOW() - INTERVAL '${day} day' GROUP BY s.profit_token_address;`
    );

    arbSum = 0;
    arbitrageUsd.rows.forEach((row) => {
      arbSum += Number(row.total_profit_amount) / 10 ** Number(row.decimals);
    });

    sandSum = 0;
    sandwichUsd.rows.forEach((row) => {
      sandSum += Number(row.total_profit_amount) / 10 ** Number(row.decimals);
    });
    let liquidationSum = 0;
    liquidationUsd.rows.forEach((row) => {
      liquidationSum +=
        Number(row.total_profit_amount) / 10 ** Number(row.decimals);
    });
    client.release();
    return {
      totalArbitrageUsd: arbSum,
      totalSandwichUsd: sandSum,
      totalLiquidationusd: liquidationSum,
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
      `SELECT * FROM  arbitrages_view av WHERE av.transaction_to_address = '0x3b5997FfAF9B551b7A407C9FE310732A04b5A850' ORDER BY av.block_number DESC LIMIT 10;`
    );

    const sandwichedTransaction = await client.query(
      `SELECT * FROM sandwiched_view sv WHERE sv.transaction_from_address IN ('0x68394B4aDd514A8fB3Dee310a13FB8A5C5BB4Fcd','0x62EfeE356F57dc2e7BF38a16924cEf2435E3446E','0x2a7C2eCffEa2A72b10b6dC6DC9ac3d5efc18B2C2','0x7CE905Be379C6E8c88b0173f0043B256729593CA','0x900518D54AbCA7505Be000eb0030d7B33c715625') ORDER BY sv.block_number DESC LIMIT 10;`
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

async function getLiquidationTranscations() {
  const client = await pool.connect();
  try {
    const recentTransactions = await client.query(
      `SELECT * FROM  arbitrages_view av WHERE av.transaction_to_address = '0xcd8b100e5495C9bdaf1F4F7C3c399989B1234cFe' ORDER BY av.block_number DESC LIMIT 10;`
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
      `SELECT * FROM  arbitrages_view av WHERE  av.transaction_to_address = '0x3b5997FfAF9B551b7A407C9FE310732A04b5A850' ORDER BY av.block_number DESC LIMIT 10;`
    );
    // const sandwichedTransaction = await client.query(
    //   `SELECT * FROM sandwiched_view sv WHERE sv.profit_usd < 2000000000000000000 AND sv.frontrun_transaction_hash NOT IN (SELECT transaction_hash FROM classified_traces WHERE error = 'Reverted') AND  sv.backrun_transaction_hash NOT IN (SELECT transaction_hash FROM classified_traces WHERE error = 'Reverted') ORDER BY sv.block_number DESC LIMIT 2;`
    // );
    const sandwichedTransaction = await client.query(
      `SELECT * FROM sandwiched_view sv WHERE sv.transaction_from_address IN ('0x68394B4aDd514A8fB3Dee310a13FB8A5C5BB4Fcd',
                                      '0x62EfeE356F57dc2e7BF38a16924cEf2435E3446E',
                                      '0x2a7C2eCffEa2A72b10b6dC6DC9ac3d5efc18B2C2',
                                      '0x7CE905Be379C6E8c88b0173f0043B256729593CA',
                                      '0x900518D54AbCA7505Be000eb0030d7B33c715625') ORDER BY sv.block_number DESC LIMIT 10;`
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
  getLiquidationTranscations,
};
