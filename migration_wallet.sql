-- Skyline Airways — wallet + payment-status migration
-- Run this ONCE in the Neon SQL editor if you already have an existing
-- database from before the wallet feature (i.e. you don't want to drop
-- your data and re-run schema.sql + seed.js from scratch).
--
-- Safe to run multiple times — every statement is guarded.

ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    balance_after NUMERIC(12,2) NOT NULL,
    description VARCHAR(200),
    card_last4 VARCHAR(4),
    created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_user ON wallet_transactions(user_id);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'pending';

-- Any booking that was already paid by card is obviously already paid.
-- Existing cash bookings stay 'pending' until the admin marks them paid.
UPDATE bookings SET payment_status = 'paid' WHERE payment_method = 'card' AND payment_status = 'pending';
