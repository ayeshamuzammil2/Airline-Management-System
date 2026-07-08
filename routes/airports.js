const express = require('express');
const pool = require('../db');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM airports ORDER BY city ASC');
    res.json({ airports: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
