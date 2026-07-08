const express = require('express');
const pool = require('../db');
const router = express.Router();

// LIST all travelers (admin) — includes wallet balance
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, phone, wallet_balance, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET one traveler's wallet balance + transaction history
router.get('/:id/wallet', async (req, res) => {
  try {
    const { rows: userRows } = await pool.query('SELECT id, name, wallet_balance FROM users WHERE id=$1', [req.params.id]);
    if (!userRows.length) return res.status(404).json({ error: 'User not found' });

    const { rows: txns } = await pool.query(
      `SELECT * FROM wallet_transactions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json({ wallet_balance: userRows[0].wallet_balance, transactions: txns });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ADD MONEY to wallet — "card" details here are never validated or stored
router.post('/:id/wallet/topup', async (req, res) => {
  const { amount, card_last4 } = req.body;
  const amt = Number(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Enter a valid amount' });
  if (amt > 1000000) return res.status(400).json({ error: 'Maximum top-up is PKR 1,000,000 at a time' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: userRows } = await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [req.params.id]);
    if (!userRows.length) throw { status: 404, message: 'User not found' };

    const newBalance = Number(userRows[0].wallet_balance) + amt;
    await client.query('UPDATE users SET wallet_balance=$1 WHERE id=$2', [newBalance, req.params.id]);
    const { rows: txnRows } = await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description, card_last4)
       VALUES ($1,'topup',$2,$3,'Wallet top-up',$4) RETURNING *`,
      [req.params.id, amt, newBalance, card_last4 ? String(card_last4).slice(-4) : null]
    );

    await client.query('COMMIT');
    res.status(201).json({ wallet_balance: newBalance, transaction: txnRows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
