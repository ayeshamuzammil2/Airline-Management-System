# ✈️ Skyline Airways — Airline Reservation System

A full-stack airline booking platform built with an **HTML/CSS/JS frontend**, a **Node.js/Express** backend, and a **Neon (serverless Postgres)** database.

It includes a **traveler side** (search, seat selection, wallet, PDF e-tickets, printable receipts, booking history) and an **admin side** (flight management, all bookings, payments, travelers, live charts).

---

## 🛠 Tech Stack

- **Backend:** Node.js, Express, `pg` (node-postgres), bcryptjs, **pdfkit** (PDF tickets)
- **Database:** Neon (PostgreSQL)
- **Frontend:** Plain HTML/CSS/JS — Font Awesome icons, Chart.js (admin graphs), Google Fonts (Sora + Inter)

---

## 📂 Folder Structure

```
airline-web/
├── server.js               # Express entry point
├── db.js                   # Neon/Postgres connection pool
├── schema.sql               # Run this in Neon once, to create tables
├── migration_wallet.sql     # Run instead of schema.sql if you already have
│                             an existing database and don't want to lose data
├── seed.js                  # Run once to insert admin + airports + sample flights
├── lib/
│   ├── helpers.js            # Booking ref generator, seat map builder
│   └── pdf.js                 # Boarding-pass style PDF ticket generator
├── routes/                   # auth, airports, flights, bookings, stats, users
└── public/                    # The actual website (HTML/CSS/JS)
    ├── index.html               # Landing page + flight search
    ├── login.html                # Traveler / admin login
    ├── signup.html                # Traveler signup
    ├── flights.html                 # Search results (dropdown route + date search)
    ├── booking.html                  # Seat map → passenger form → pay → confirm
    ├── receipt.html                   # Printable payment receipt
    ├── mybookings.html                 # Traveler dashboard (tickets, wallet, cancel)
    ├── admin.html                       # Admin dashboard (charts + CRUD + payments)
    ├── css/style.css
    └── js/*.js
```

---

## 🚀 Getting Started

### 1. Set Up the Neon Database

1. Create a free project at [neon.tech](https://neon.tech) (or use an existing one).
2. Open the Neon SQL editor:
   - **Fresh database** — paste the contents of `schema.sql` and run it. This (re)creates `admins`, `users`, `airports`, `flights`, `bookings`, and `wallet_transactions`, and **erases any existing data** in those tables.
   - **Already have data you want to keep** — paste `migration_wallet.sql` instead. It only adds the new wallet/payment-status columns and tables, without touching your existing rows.
3. Copy your connection string from **Connection Details** in the Neon console.

### 2. Configure the Project

1. Create `.env`.
2. Paste your Neon connection string into `DATABASE_URL`:

   ```
   DATABASE_URL=postgresql://USER:PASSWORD@YOUR-NEON-HOST/DBNAME?sslmode=require
   PORT=3000
   ```

### 3. Install & Run (VS Code)

Open the `airline-web` folder in **VS Code** and use its integrated terminal:

```bash
npm install        # installs express, pg, bcryptjs, pdfkit, etc.
npm run seed        # one-time: admin account + 57 airports + 64 sample flights
npm start           # starts the server
```

Then open **http://localhost:3000**. The frontend is served by the same Express server — nothing else to run. Clean URLs like `http://localhost:3000/admin` or `/mybookings` work directly too, not just the `.html` links inside the app.

> This is a Node.js project, so VS Code needs zero setup. IntelliJ can run Node too (with its Node.js plugin), but VS Code's terminal is simpler here.

---

## 🔑 Demo Logins

Created automatically by `npm run seed`:

| Role     | Username / Email  | Password   | Notes                          |
|----------|--------------------|------------|----------------------------------|
| Admin    | `admin`            | `admin123` | —                                |
| Traveler | `demo@skyline.com` | `demo1234` | Starts with PKR 500,000 wallet   |

Or click **"Sign up"** on the homepage to create a new traveler account (new travelers start with a PKR 0 wallet — use "Add money" to top it up).

---

## ⚠️ Troubleshooting: "Admin Login Isn't Working"

The admin account is **not** built into the code — it only exists once you've run `npm run seed` against a database that the server is actually connected to. If login fails, it's almost always one of these:

1. **`npm run seed` was never run** — the `admins` table has no rows yet. Run it once after `schema.sql`.
2. **`.env` is missing or wrong** — if `DATABASE_URL` isn't set (or points at the wrong database), the server can't find the admin row you seeded elsewhere. Check the terminal: if you see a yellow `WARNING: DATABASE_URL is not set` line on startup, this is your problem.
3. **You seeded a different database than the one `DATABASE_URL` points to** — e.g. you ran the SQL editor on Project A in Neon but `.env` points at Project B. Re-check the connection string matches the project you ran `schema.sql` / `seed.js` against.
4. **Typo in the password** — the seeded password is exactly `admin123` (lowercase, no spaces). Use "Forgot password" on the login page to reset it if unsure — it doesn't need email, just confirms the username exists.

> There is no bug in the login route itself — `POST /api/auth/login` was tested directly against a fresh database and correctly authenticates admin and traveler accounts once they're seeded.

---

## ✨ What's Included

- **Search & book** — pick a route and date from dropdowns showing every destination and timing, choose economy or business, tap an actual seat on a live seat map, fill in passenger details, choose to pay by **wallet, card, or cash**, and confirm.
- **Traveler wallet** — every traveler has a wallet balance. They can add money any time (just type an amount — no card details needed) and pay for flights instantly from the balance. Wallet payments are refunded back to the wallet automatically if the booking is cancelled. Every top-up, payment, and refund is logged in a transaction history.
- **Payment status tracking** — wallet and card payments are marked **paid** immediately. Cash payments are marked **pending** until the traveler pays at the counter — the admin then marks them **paid** from the Payments tab, which updates the traveler's booking status everywhere it's shown.
- **Real PDF e-tickets** — every confirmed booking can be downloaded as a boarding-pass style PDF (`GET /api/bookings/:id/ticket`), generated with `pdfkit`, showing payment method and payment status.
- **Printable receipt** — a separate, print-friendly receipt page (`receipt.html?bookingId=...`) with a Print button, for a proper paper (or PDF-via-browser-print) receipt alongside the boarding-pass ticket.
- **Booking safety** — seat booking runs inside a Postgres transaction with a row lock, so two people can't be sold the same seat, and wallet debits/credits are equally transactional so balances can't go wrong under concurrent requests.
- **Admin charts** — bookings & revenue trend (14 days), top routes, economy vs. business split, and seat occupancy per flight, all via Chart.js reading from `/api/stats/*` endpoints. Revenue only counts bookings that are actually marked paid. Charts and stat cards refresh every time you open the Overview tab, so new bookings show up immediately.
- **Admin CRUD** — add, edit, and delete flights (route, schedule, fares, seat counts, status); browse all bookings, payments (with mark-as-paid), and registered travelers (with their wallet balances).
- **Forgot password** — on the login page, travelers/admins can reset their password directly (no email service in this demo, so it's identifier + new password — see `POST /api/auth/reset-password`).
- **57 real airports** across Pakistan, the Middle East, Europe, South & East Asia, North America, Africa, and Oceania, with correct IATA codes, and **64 flights** connecting them — well over the 50-destination mark.

---

## 📝 Notes

- Passwords are hashed with bcrypt — nothing is stored in plain text, including after a password reset.
- Card details (for wallet top-ups and card payments) are never validated or stored beyond the last 4 digits — this is a demo checkout, not a real payment gateway. Any 16-digit number, any expiry/CVV works.
- The color palette (`#0B1F3A`, `#2F5D8C`, `#F2A93B`, `#F7F9FC`) lives as CSS variables at the top of `public/css/style.css` — change it there to re-theme the whole app (including the PDF ticket colors in `lib/pdf.js`).
- If the app can't reach the database, double-check `DATABASE_URL` in `.env` and that you ran `schema.sql` (or `migration_wallet.sql`) in the Neon SQL editor first.
- `db.js` automatically disables SSL if your `DATABASE_URL` points at `localhost`/`127.0.0.1`, so you can also test against a local Postgres during development — Neon itself always requires SSL and works unchanged.
