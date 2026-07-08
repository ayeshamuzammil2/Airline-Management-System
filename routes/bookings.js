const express = require('express');
const pool = require('../db');
const { genBookingRef } = require('../lib/helpers');
const { generateTicketPDF } = require('../lib/pdf');

const router = express.Router();

const BOOKING_JOIN = `
  SELECT b.*, f.flight_number, f.departure_time, f.arrival_time, f.origin_code, f.destination_code,
    o.city AS origin_city, d.city AS destination_city
  FROM bookings b
  JOIN flights f ON f.id = b.flight_id
  JOIN airports o ON o.code = f.origin_code
  JOIN airports d ON d.code = f.destination_code
`;

// BOOK a seat
router.post('/', async (req, res) => {
  const { user_id, flight_id, passenger_name, passenger_age, passenger_gender, passenger_email, class: cls, seat_number, payment_method, card_last4 } = req.body;
  
  if (!user_id || !flight_id || !passenger_name || !cls || !seat_number) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const method = ['card', 'wallet', 'cash'].includes(payment_method) ? payment_method : 'cash';

  let finalCardLast4 = null;
  if (method === 'card') {
    if (card_last4) {
      finalCardLast4 = String(card_last4).slice(-4);
    } else {
      finalCardLast4 = Math.floor(1000 + Math.random() * 9000).toString();
    }
  }


  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: flightRows } = await client.query('SELECT * FROM flights WHERE id=$1 FOR UPDATE', [flight_id]);
    if (!flightRows.length) throw { status: 404, message: 'Flight not found' };
    const flight = flightRows[0];

    const availField = cls === 'business' ? 'business_available' : 'economy_available';
    if (flight[availField] <= 0) throw { status: 409, message: `No ${cls} seats left on this flight` };

    const { rows: conflict } = await client.query(
      `SELECT id FROM bookings WHERE flight_id=$1 AND seat_number=$2 AND status='confirmed'`,
      [flight_id, seat_number]
    );
    if (conflict.length) throw { status: 409, message: 'That seat was just taken. Please pick another.' };

    const price = cls === 'business' ? flight.business_price : flight.economy_price;
    const ref = genBookingRef();

    let paymentStatus = 'pending';
    let newWalletBalance = null;

    if (method === 'wallet') {
      const { rows: userRows } = await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [user_id]);
      if (!userRows.length) throw { status: 404, message: 'User not found' };
      const balance = Number(userRows[0].wallet_balance);
      if (balance < Number(price)) {
        throw { status: 402, message: `Insufficient wallet balance. You have PKR ${balance.toLocaleString()}, need PKR ${Number(price).toLocaleString()}.` };
      }
      newWalletBalance = balance - Number(price);
      await client.query('UPDATE users SET wallet_balance=$1 WHERE id=$2', [newWalletBalance, user_id]);
      paymentStatus = 'paid';
    } else if (method === 'card') {
      paymentStatus = 'paid'; 
    }

    const { rows } = await client.query(
      `INSERT INTO bookings (booking_ref, user_id, flight_id, passenger_name, passenger_age, passenger_gender,
        passenger_email, class, seat_number, amount, payment_method, card_last4, payment_status, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'confirmed') RETURNING *`,
      [ref, user_id, flight_id, passenger_name, passenger_age || null, passenger_gender || null,
        passenger_email || null, cls, seat_number, price, method, finalCardLast4, // <-- Yahan hamari dynamic value save hogi
        paymentStatus]
    );

    if (method === 'wallet') {
      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description)
         VALUES ($1,'payment',$2,$3,$4)`,
        [user_id, price, newWalletBalance, `Flight ${flight.flight_number} — booking ${ref}`]
      );
    }

    await client.query(`UPDATE flights SET ${availField} = ${availField} - 1 WHERE id=$1`, [flight_id]);

    await client.query('COMMIT');
    res.status(201).json({ booking: rows[0], wallet_balance: newWalletBalance });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// CANCEL a booking
router.post('/:id/cancel', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(`SELECT * FROM bookings WHERE id=$1 FOR UPDATE`, [req.params.id]);
    if (!rows.length) throw { status: 404, message: 'Booking not found' };
    const booking = rows[0];
    if (booking.status === 'cancelled') throw { status: 409, message: 'Already cancelled' };

    await client.query(`UPDATE bookings SET status='cancelled' WHERE id=$1`, [booking.id]);
    const availField = booking.class === 'business' ? 'business_available' : 'economy_available';
    await client.query(`UPDATE flights SET ${availField} = ${availField} + 1 WHERE id=$1`, [booking.flight_id]);

    // Refund to wallet if the booking was paid for out of the wallet.
    if (booking.payment_method === 'wallet' && booking.payment_status === 'paid') {
      const { rows: userRows } = await client.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [booking.user_id]);
      if (userRows.length) {
        const newBalance = Number(userRows[0].wallet_balance) + Number(booking.amount);
        await client.query('UPDATE users SET wallet_balance=$1 WHERE id=$2', [newBalance, booking.user_id]);
        await client.query(
          `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description)
           VALUES ($1,'refund',$2,$3,$4)`,
          [booking.user_id, booking.amount, newBalance, `Refund for cancelled booking ${booking.booking_ref}`]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Booking cancelled' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// MARK a (cash) booking as paid — admin confirms payment at check-in
router.post('/:id/mark-paid', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE bookings SET payment_status='paid' WHERE id=$1 RETURNING *`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// LIST bookings for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const { rows } = await pool.query(
      BOOKING_JOIN + ` WHERE b.user_id=$1 ORDER BY b.booked_at DESC`,
      [req.params.userId]
    );
    res.json({ bookings: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// LIST all bookings (admin)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(BOOKING_JOIN + ' ORDER BY b.booked_at DESC');
    res.json({ bookings: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET a single booking (used by the printable receipt page)
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query(BOOKING_JOIN + ' WHERE b.id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DOWNLOAD ticket PDF
router.get('/:id/ticket', async (req, res) => {
  try {
    const { rows } = await pool.query(BOOKING_JOIN + ' WHERE b.id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Booking not found' });
    generateTicketPDF(res, rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
