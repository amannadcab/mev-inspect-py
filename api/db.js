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

// pool.on('error', (err) => {
//   ch.logger('Unexpected error on idle pool client', err);
// });

pool.connect((err) => {
  if (err) {
    ch.logger('Error while logging into DataBase', err.stack);
  }
});

module.exports = pool;
