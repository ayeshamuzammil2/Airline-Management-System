require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const airportRoutes = require('./routes/airports');
const flightRoutes = require('./routes/flights');
const bookingRoutes = require('./routes/bookings');
const statsRoutes = require('./routes/stats');
const userRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.use('/api/auth', authRoutes);
app.use('/api/airports', airportRoutes);
app.use('/api/flights', flightRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/users', userRoutes);

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Fallback: any other unmatched route that isn't an API call goes to the
// homepage instead of showing "Cannot GET" (e.g. a bookmarked/typed URL).
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n✈️  Skyline Airways running at http://localhost:${PORT}\n`);
});
