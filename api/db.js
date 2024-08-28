const { Pool } = require("pg");

// Create a PostgreSQL pool connection
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "mev_inspect",
  password: "postgres",
  max: 150,
  keepAlive: true,
  idleTimeoutMillis: 60000, 
  connectionTimeoutMillis: 60000,
  port: 5432,
});



module.exports = pool;
