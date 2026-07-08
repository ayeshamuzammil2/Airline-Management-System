const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');

const router = express.Router();

// ---------- LOGIN ----------
router.post('/login', async (req, res) => {
  const { role, identifier, password } = req.body;
  if (!role || !identifier || !password) return res.status(400).json({ error: 'Missing fields' });

  try {
    const table = role === 'admin' ? 'admins' : 'users';
    const idField = role === 'admin' ? 'username' : 'email';

    const { rows } = await pool.query(`SELECT * FROM ${table} WHERE ${idField} = $1`, [identifier]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Account not found' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Incorrect password' });

    delete user.password;
    res.json({ role, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error, check DB connection' });
  }
});

// ---------- SIGN UP (traveler) ----------
router.post('/signup', async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });

  try {
    const { rows: existing } = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, phone, password) VALUES ($1,$2,$3,$4)
       RETURNING id, name, email, phone`,
      [name, email, phone || null, hash]
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- RESET PASSWORD ----------
router.post('/reset-password', async (req, res) => {
  const { role, identifier, newPassword } = req.body;
  if (!role || !identifier || !newPassword) return res.status(400).json({ error: 'Missing fields' });
  if (newPassword.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });

  try {
    const table = role === 'admin' ? 'admins' : 'users';
    const idField = role === 'admin' ? 'username' : 'email';

    const { rows } = await pool.query(`SELECT id FROM ${table} WHERE ${idField} = $1`, [identifier]);
    if (!rows.length) return res.status(404).json({ error: 'No account found with that ' + (role === 'admin' ? 'username' : 'email') });

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query(`UPDATE ${table} SET password = $1 WHERE id = $2`, [hash, rows[0].id]);

    res.json({ message: 'Password updated. You can log in with your new password now.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
