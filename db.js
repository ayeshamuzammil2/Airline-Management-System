require('dotenv').config();
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.warn(
    '\x1b[33m%s\x1b[0m',
    'WARNING: DATABASE_URL is not set. Copy .env.example to .env and paste your Neon connection string.'
  );
}

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false },
});

module.exports = pool;
