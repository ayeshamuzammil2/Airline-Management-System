const express = require('express');
const pool = require('../db');
const { buildSeatMap } = require('../lib/helpers');

const router = express.Router();

const SELECT_JOIN = `
  SELECT f.*, 
    o.city AS origin_city, o.name AS origin_name,
    d.city AS destination_city, d.name AS destination_name
  FROM flights f
  JOIN airports o ON o.code = f.origin_code
  JOIN airports d ON d.code = f.destination_code
`;

// SEARCH flights 
router.get('/search', async (req, res) => {
  const { from, to, date } = req.query;
  try {
    let query = SELECT_JOIN + ` WHERE f.status != 'cancelled'`;
    const params = [];
    if (from) { params.push(from); query += ` AND f.origin_code = $${params.length}`; }
    if (to) { params.push(to); query += ` AND f.destination_code = $${params.length}`; }
    if (date) { params.push(date); query += ` AND f.departure_time::date = $${params.length}`; }
    query += ` ORDER BY f.departure_time ASC`;

    const { rows } = await pool.query(query, params);
    res.json({ flights: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// LIST all (admin)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(SELECT_JOIN + ' ORDER BY f.departure_time ASC');
    res.json({ flights: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET one flight + seat map + taken seats
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(SELECT_JOIN + ' WHERE f.id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Flight not found' });
    const flight = rows[0];

    const { rows: taken } = await pool.query(
      `SELECT seat_number, class FROM bookings WHERE flight_id=$1 AND status='confirmed'`,
      [flight.id]
    );
    const seatMap = buildSeatMap(flight.business_seats, flight.economy_seats);

    res.json({ flight, seatMap, takenSeats: taken.map((t) => t.seat_number) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// CREATE flight (admin)
router.post('/', async (req, res) => {
  const {
    flight_number, origin_code, destination_code, departure_time, arrival_time,
    economy_price, business_price, economy_seats, business_seats,
  } = req.body;

  if (!flight_number || !origin_code || !destination_code || !departure_time || !arrival_time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (origin_code === destination_code) {
    return res.status(400).json({ error: 'Origin and destination cannot be the same' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO flights (flight_number, origin_code, destination_code, departure_time, arrival_time,
        economy_price, business_price, economy_seats, business_seats, economy_available, business_available)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$8,$9) RETURNING *`,
      [flight_number, origin_code, destination_code, departure_time, arrival_time,
        economy_price, business_price, economy_seats || 24, business_seats || 8]
    );
    res.status(201).json({ flight: rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23505') return res.status(409).json({ error: 'Flight number already exists' });
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE flight (admin)
router.put('/:id', async (req, res) => {
  const {
    flight_number, origin_code, destination_code, departure_time, arrival_time,
    economy_price, business_price, status,
  } = req.body;

  try {
    const { rows } = await pool.query(
      `UPDATE flights SET flight_number=$1, origin_code=$2, destination_code=$3, departure_time=$4,
        arrival_time=$5, economy_price=$6, business_price=$7, status=$8
       WHERE id=$9 RETURNING *`,
      [flight_number, origin_code, destination_code, departure_time, arrival_time,
        economy_price, business_price, status || 'scheduled', req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Flight not found' });
    res.json({ flight: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE flight (admin)
router.delete('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM flights WHERE id=$1 RETURNING flight_number', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Flight not found' });
    res.json({ message: 'Flight deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
