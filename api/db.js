const { Pool } = require("pg");

// Create a PostgreSQL pool connection
const pool = new Pool({
  user: "mevowner",
  host: "64.227.129.194",
  database: "mev_inspect",
  password: "SRTrDKSqeH",
  max: 150,
  keepAlive: true,
  idleTimeoutMillis: 60000, 
  connectionTimeoutMillis: 60000,
  port: 5432,
});



module.exports = pool;
