const { Pool } = require("pg");

// Create a PostgreSQL pool connection
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "mev_inspect",
  password: "postgres",
  port: 5432,
});

module.exports = pool;
