require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./db');

const airports = [
  // Pakistan
  ['KHI', 'Karachi', 'Jinnah International Airport', 'Pakistan'],
  ['LHE', 'Lahore', 'Allama Iqbal International Airport', 'Pakistan'],
  ['ISB', 'Islamabad', 'Islamabad International Airport', 'Pakistan'],
  ['PEW', 'Peshawar', 'Bacha Khan International Airport', 'Pakistan'],
  ['MUX', 'Multan', 'Multan International Airport', 'Pakistan'],
  ['SKT', 'Sialkot', 'Sialkot International Airport', 'Pakistan'],
  ['UET', 'Quetta', 'Quetta International Airport', 'Pakistan'],
  ['FSD', 'Faisalabad', 'Faisalabad International Airport', 'Pakistan'],
  // Middle East
  ['DXB', 'Dubai', 'Dubai International Airport', 'UAE'],
  ['AUH', 'Abu Dhabi', 'Zayed International Airport', 'UAE'],
  ['SHJ', 'Sharjah', 'Sharjah International Airport', 'UAE'],
  ['JED', 'Jeddah', 'King Abdulaziz International Airport', 'Saudi Arabia'],
  ['RUH', 'Riyadh', 'King Khalid International Airport', 'Saudi Arabia'],
  ['MED', 'Medina', 'Prince Mohammad Bin Abdulaziz Airport', 'Saudi Arabia'],
  ['DOH', 'Doha', 'Hamad International Airport', 'Qatar'],
  ['MCT', 'Muscat', 'Muscat International Airport', 'Oman'],
  ['BAH', 'Manama', 'Bahrain International Airport', 'Bahrain'],
  ['KWI', 'Kuwait City', 'Kuwait International Airport', 'Kuwait'],
  ['AMM', 'Amman', 'Queen Alia International Airport', 'Jordan'],
  ['BEY', 'Beirut', 'Beirut–Rafic Hariri International Airport', 'Lebanon'],
  // Europe
  ['LHR', 'London', 'Heathrow Airport', 'United Kingdom'],
  ['MAN', 'Manchester', 'Manchester Airport', 'United Kingdom'],
  ['CDG', 'Paris', 'Charles de Gaulle Airport', 'France'],
  ['FRA', 'Frankfurt', 'Frankfurt Airport', 'Germany'],
  ['MUC', 'Munich', 'Munich Airport', 'Germany'],
  ['AMS', 'Amsterdam', 'Amsterdam Airport Schiphol', 'Netherlands'],
  ['IST', 'Istanbul', 'Istanbul Airport', 'Turkey'],
  ['MAD', 'Madrid', 'Adolfo Suárez Madrid–Barajas Airport', 'Spain'],
  ['BCN', 'Barcelona', 'Barcelona–El Prat Airport', 'Spain'],
  ['FCO', 'Rome', 'Leonardo da Vinci–Fiumicino Airport', 'Italy'],
  ['ZRH', 'Zurich', 'Zurich Airport', 'Switzerland'],
  ['VIE', 'Vienna', 'Vienna International Airport', 'Austria'],
  ['CPH', 'Copenhagen', 'Copenhagen Airport', 'Denmark'],
  ['OSL', 'Oslo', 'Oslo Airport', 'Norway'],
  // South Asia
  ['DEL', 'New Delhi', 'Indira Gandhi International Airport', 'India'],
  ['BOM', 'Mumbai', 'Chhatrapati Shivaji Maharaj Airport', 'India'],
  ['DAC', 'Dhaka', 'Hazrat Shahjalal International Airport', 'Bangladesh'],
  ['CMB', 'Colombo', 'Bandaranaike International Airport', 'Sri Lanka'],
  ['KTM', 'Kathmandu', 'Tribhuvan International Airport', 'Nepal'],
  // Southeast & East Asia
  ['SIN', 'Singapore', 'Singapore Changi Airport', 'Singapore'],
  ['KUL', 'Kuala Lumpur', 'Kuala Lumpur International Airport', 'Malaysia'],
  ['BKK', 'Bangkok', 'Suvarnabhumi Airport', 'Thailand'],
  ['HKG', 'Hong Kong', 'Hong Kong International Airport', 'Hong Kong'],
  ['NRT', 'Tokyo', 'Narita International Airport', 'Japan'],
  ['ICN', 'Seoul', 'Incheon International Airport', 'South Korea'],
  ['PEK', 'Beijing', 'Beijing Capital International Airport', 'China'],
  ['PVG', 'Shanghai', 'Shanghai Pudong International Airport', 'China'],
  // North America
  ['JFK', 'New York', 'John F. Kennedy International Airport', 'USA'],
  ['LAX', 'Los Angeles', 'Los Angeles International Airport', 'USA'],
  ['ORD', 'Chicago', 'O\u2019Hare International Airport', 'USA'],
  ['IAD', 'Washington D.C.', 'Washington Dulles International Airport', 'USA'],
  ['YYZ', 'Toronto', 'Toronto Pearson International Airport', 'Canada'],
  // Africa & Oceania
  ['CAI', 'Cairo', 'Cairo International Airport', 'Egypt'],
  ['JNB', 'Johannesburg', 'O.R. Tambo International Airport', 'South Africa'],
  ['NBO', 'Nairobi', 'Jomo Kenyatta International Airport', 'Kenya'],
  ['SYD', 'Sydney', 'Sydney Kingsford Smith Airport', 'Australia'],
  ['MEL', 'Melbourne', 'Melbourne Airport', 'Australia'],
];

function daysFromNow(days, hour, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, min, 0, 0);
  return d;
}

function buildFlights() {
  const routes = [
    // domestic
    ['SA-101', 'KHI', 'LHE', 6, 8, 9, 30, 45000, 110000],
    ['SA-102', 'LHE', 'KHI', 6, 18, 19, 30, 45000, 110000],
    ['SA-103', 'KHI', 'LHE', 10, 14, 15, 30, 45000, 110000],
    ['SA-201', 'KHI', 'ISB', 3, 7, 9, 0, 42000, 105000],
    ['SA-202', 'ISB', 'KHI', 3, 16, 18, 0, 42000, 105000],
    ['SA-203', 'LHE', 'ISB', 4, 9, 10, 0, 30000, 80000],
    ['SA-204', 'ISB', 'PEW', 2, 11, 11, 45, 25000, 65000],
    ['SA-205', 'KHI', 'UET', 5, 6, 7, 30, 33000, 85000],
    ['SA-206', 'LHE', 'MUX', 2, 13, 14, 0, 22000, 60000],
    ['SA-207', 'KHI', 'SKT', 8, 15, 16, 30, 40000, 100000],
    ['SA-208', 'ISB', 'FSD', 6, 10, 11, 0, 26000, 68000],
    // Middle East
    ['SA-301', 'KHI', 'DXB', 1, 2, 4, 30, 95000, 240000],
    ['SA-302', 'DXB', 'KHI', 2, 23, 1, 30, 95000, 240000],
    ['SA-303', 'LHE', 'DXB', 3, 4, 6, 30, 98000, 245000],
    ['SA-304', 'ISB', 'AUH', 5, 3, 5, 30, 92000, 230000],
    ['SA-305', 'KHI', 'SHJ', 7, 1, 3, 15, 90000, 225000],
    ['SA-401', 'KHI', 'JED', 4, 3, 6, 0, 120000, 300000],
    ['SA-402', 'LHE', 'RUH', 6, 5, 8, 0, 118000, 295000],
    ['SA-403', 'ISB', 'MED', 9, 2, 5, 0, 115000, 290000],
    ['SA-501', 'ISB', 'DOH', 5, 5, 8, 0, 105000, 260000],
    ['SA-502', 'KHI', 'MCT', 3, 6, 8, 30, 88000, 220000],
    ['SA-503', 'LHE', 'BAH', 8, 4, 7, 0, 100000, 250000],
    ['SA-504', 'KHI', 'KWI', 6, 1, 4, 30, 108000, 270000],
    ['SA-505', 'ISB', 'AMM', 10, 3, 7, 30, 130000, 320000],
    ['SA-506', 'LHE', 'BEY', 11, 2, 7, 0, 135000, 330000],
    // Europe
    ['SA-601', 'LHE', 'IST', 7, 1, 6, 30, 140000, 340000],
    ['SA-602', 'KHI', 'IST', 9, 2, 7, 30, 145000, 350000],
    ['SA-701', 'KHI', 'LHR', 9, 2, 11, 0, 210000, 520000],
    ['SA-702', 'ISB', 'LHR', 12, 1, 10, 30, 215000, 525000],
    ['SA-703', 'LHE', 'MAN', 8, 3, 12, 0, 205000, 510000],
    ['SA-704', 'KHI', 'CDG', 10, 2, 11, 30, 220000, 540000],
    ['SA-705', 'LHE', 'FRA', 6, 1, 10, 0, 218000, 530000],
    ['SA-706', 'ISB', 'MUC', 7, 2, 11, 0, 216000, 528000],
    ['SA-707', 'KHI', 'AMS', 13, 3, 12, 30, 222000, 545000],
    ['SA-708', 'LHE', 'MAD', 14, 4, 14, 0, 225000, 550000],
    ['SA-709', 'KHI', 'BCN', 15, 2, 12, 0, 224000, 548000],
    ['SA-710', 'ISB', 'FCO', 9, 3, 12, 30, 219000, 535000],
    ['SA-711', 'LHE', 'ZRH', 11, 1, 10, 30, 228000, 555000],
    ['SA-712', 'KHI', 'VIE', 12, 2, 11, 30, 217000, 532000],
    ['SA-713', 'ISB', 'CPH', 16, 3, 13, 0, 230000, 560000],
    ['SA-714', 'LHE', 'OSL', 17, 2, 12, 30, 232000, 562000],
    // South Asia
    ['SA-801', 'KHI', 'DEL', 3, 9, 11, 0, 60000, 150000],
    ['SA-802', 'LHE', 'BOM', 4, 8, 10, 30, 62000, 155000],
    ['SA-803', 'ISB', 'DAC', 5, 6, 10, 0, 75000, 190000],
    ['SA-804', 'KHI', 'CMB', 6, 5, 10, 30, 80000, 200000],
    ['SA-805', 'LHE', 'KTM', 7, 7, 11, 0, 78000, 195000],
    // Southeast & East Asia
    ['SA-901', 'KHI', 'SIN', 5, 1, 12, 30, 150000, 380000],
    ['SA-902', 'LHE', 'KUL', 6, 2, 13, 0, 148000, 375000],
    ['SA-903', 'ISB', 'BKK', 4, 3, 10, 30, 140000, 355000],
    ['SA-904', 'KHI', 'HKG', 8, 1, 13, 30, 165000, 400000],
    ['SA-905', 'LHE', 'NRT', 14, 2, 16, 0, 195000, 480000],
    ['SA-906', 'ISB', 'ICN', 13, 1, 14, 30, 190000, 470000],
    ['SA-907', 'KHI', 'PEK', 10, 3, 14, 0, 185000, 460000],
    ['SA-908', 'LHE', 'PVG', 11, 2, 13, 30, 188000, 465000],
    // North America
    ['SA-1001', 'ISB', 'JFK', 12, 0, 16, 0, 320000, 780000],
    ['SA-1002', 'KHI', 'LAX', 16, 1, 19, 0, 340000, 820000],
    ['SA-1003', 'LHE', 'ORD', 15, 2, 18, 30, 335000, 810000],
    ['SA-1004', 'ISB', 'IAD', 18, 1, 17, 0, 330000, 800000],
    ['SA-1005', 'KHI', 'YYZ', 17, 2, 18, 0, 325000, 795000],
    // Africa & Oceania
    ['SA-1101', 'KHI', 'CAI', 5, 4, 8, 0, 85000, 215000],
    ['SA-1102', 'LHE', 'JNB', 9, 3, 13, 0, 175000, 430000],
    ['SA-1103', 'ISB', 'NBO', 8, 5, 11, 0, 110000, 275000],
    ['SA-1104', 'KHI', 'SYD', 19, 1, 20, 0, 280000, 690000],
    ['SA-1105', 'LHE', 'MEL', 20, 2, 21, 0, 285000, 700000],
  ];
  return routes.map(([num, origin, dest, dayOffset, depH, arrH, arrM, ecoPrice, bizPrice]) => ({
    flight_number: num,
    origin_code: origin,
    destination_code: dest,
    departure_time: daysFromNow(dayOffset, depH),
    arrival_time: daysFromNow(dayOffset + (arrH < depH ? 1 : 0), arrH, arrM),
    economy_price: ecoPrice,
    business_price: bizPrice,
    economy_seats: 24,
    business_seats: 8,
  }));
}

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Seeding admin...');
    const adminHash = await bcrypt.hash('admin123', 10);
    await client.query(
      `INSERT INTO admins (username, password) VALUES ($1,$2) ON CONFLICT (username) DO NOTHING`,
      ['admin', adminHash]
    );

    console.log('Seeding airports...');
    for (const [code, city, name, country] of airports) {
      await client.query(
        `INSERT INTO airports (code, city, name, country) VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO NOTHING`,
        [code, city, name, country]
      );
    }

    console.log('Seeding flights...');
    for (const f of buildFlights()) {
      await client.query(
        `INSERT INTO flights (flight_number, origin_code, destination_code, departure_time, arrival_time,
          economy_price, business_price, economy_seats, business_seats, economy_available, business_available)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$8,$9)
         ON CONFLICT (flight_number) DO NOTHING`,
        [f.flight_number, f.origin_code, f.destination_code, f.departure_time, f.arrival_time,
          f.economy_price, f.business_price, f.economy_seats, f.business_seats]
      );
    }

    console.log('Seeding demo user...');
    const userHash = await bcrypt.hash('demo1234', 10);
    const { rows: demoRows } = await client.query(
      `INSERT INTO users (name, email, phone, password, wallet_balance) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO NOTHING RETURNING id`,
      ['Demo Traveler', 'demo@skyline.com', '+92 300 0000000', userHash, 500000]
    );
    if (demoRows.length) {
      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, description)
         VALUES ($1,'topup',500000,500000,'Welcome bonus — starting wallet balance')`,
        [demoRows[0].id]
      );
    }

    console.log('\nDone!');
    console.log('Admin login -> username: admin | password: admin123');
    console.log('Demo user login -> email: demo@skyline.com | password: demo1234 (wallet: PKR 500,000)');
  } catch (err) {
    console.error('Seed failed:', err.message);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
