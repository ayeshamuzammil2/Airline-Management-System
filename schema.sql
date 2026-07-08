DROP TABLE IF EXISTS wallet_transactions CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS flights CASCADE;
DROP TABLE IF EXISTS airports CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS admins CASCADE;

CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(30),
    password VARCHAR(255) NOT NULL,
    wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE wallet_transactions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- topup | payment | refund
    amount NUMERIC(12,2) NOT NULL,
    balance_after NUMERIC(12,2) NOT NULL,
    description VARCHAR(200),
    card_last4 VARCHAR(4),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE airports (
    code VARCHAR(4) PRIMARY KEY,
    city VARCHAR(80) NOT NULL,
    name VARCHAR(150) NOT NULL,
    country VARCHAR(80) NOT NULL
);

CREATE TABLE flights (
    id SERIAL PRIMARY KEY,
    flight_number VARCHAR(20) UNIQUE NOT NULL,
    airline_name VARCHAR(100) NOT NULL DEFAULT 'Skyline Airways',
    origin_code VARCHAR(4) REFERENCES airports(code),
    destination_code VARCHAR(4) REFERENCES airports(code),
    departure_time TIMESTAMP NOT NULL,
    arrival_time TIMESTAMP NOT NULL,
    economy_price NUMERIC(10,2) NOT NULL,
    business_price NUMERIC(10,2) NOT NULL,
    economy_seats INT NOT NULL DEFAULT 24,
    business_seats INT NOT NULL DEFAULT 8,
    economy_available INT NOT NULL DEFAULT 24,
    business_available INT NOT NULL DEFAULT 8,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- scheduled | delayed | cancelled | completed
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    booking_ref VARCHAR(12) UNIQUE NOT NULL,
    user_id INT REFERENCES users(id) ON DELETE CASCADE,
    flight_id INT REFERENCES flights(id) ON DELETE CASCADE,
    passenger_name VARCHAR(120) NOT NULL,
    passenger_age INT,
    passenger_gender VARCHAR(20),
    passenger_email VARCHAR(150),
    class VARCHAR(20) NOT NULL, -- economy | business
    seat_number VARCHAR(6) NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'cash', -- cash | card | wallet
    card_last4 VARCHAR(4),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | paid
    status VARCHAR(20) NOT NULL DEFAULT 'confirmed', -- confirmed | cancelled
    booked_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_flight ON bookings(flight_id);
CREATE INDEX idx_flights_route ON flights(origin_code, destination_code, departure_time);
CREATE INDEX idx_wallet_txn_user ON wallet_transactions(user_id);

-- Default admin login after seeding -> username: admin | password: admin123
