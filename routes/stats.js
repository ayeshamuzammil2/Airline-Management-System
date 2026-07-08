const express = require('express');
const pool = require('../db');
const router = express.Router();

// Overview stat cards
router.get('/overview', async (req, res) => {
  try {
    const [flights, users, bookings, revenue] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM flights`),
      pool.query(`SELECT COUNT(*) FROM users`),
      pool.query(`SELECT COUNT(*) FROM bookings WHERE status='confirmed'`),
      pool.query(`SELECT COALESCE(SUM(amount),0) AS total FROM bookings WHERE status='confirmed' AND payment_status='paid'`),
    ]);
    res.json({
      flights: Number(flights.rows[0].count),
      users: Number(users.rows[0].count),
      bookings: Number(bookings.rows[0].count),
      revenue: Number(revenue.rows[0].total),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Bookings + revenue over the last 14 days
router.get('/trend', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
        COALESCE(COUNT(b.id), 0) AS bookings,
        COALESCE(SUM(b.amount) FILTER (WHERE b.status='confirmed' AND b.payment_status='paid'), 0) AS revenue
      FROM generate_series(
        -- Yeh strictly current year ki 1st July se series start karega
        (to_char(CURRENT_DATE, 'YYYY') || '-07-01')::date, 
        CURRENT_DATE, 
        INTERVAL '1 day'
      ) AS d(day)
      LEFT JOIN bookings b ON b.booked_at::date = d.day AND b.status='confirmed'
      GROUP BY d.day 
      ORDER BY d.day ASC
    `);
    res.json({ trend: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Top routes by booking count
router.get('/top-routes', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT f.origin_code, f.destination_code, COUNT(b.id) AS bookings
      FROM bookings b JOIN flights f ON f.id = b.flight_id
      WHERE b.status='confirmed'
      GROUP BY f.origin_code, f.destination_code
      ORDER BY bookings DESC LIMIT 6
    `);
    res.json({ routes: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Class distribution (economy vs business)
router.get('/class-split', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT class, COUNT(*) AS count FROM bookings WHERE status='confirmed' GROUP BY class
    `);
    res.json({ split: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Seat occupancy per flight (top 8 soonest flights)
router.get('/occupancy', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT flight_number,
        (economy_seats + business_seats) AS total_seats,
        ((economy_seats - economy_available) + (business_seats - business_available)) AS booked_seats
      FROM flights WHERE status != 'cancelled'
      ORDER BY departure_time ASC LIMIT 8
    `);
    res.json({ occupancy: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
