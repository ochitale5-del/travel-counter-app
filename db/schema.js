const db = require('../config/database');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function init() {
  // Employees (login)
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Customers (for auto-fill)
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      age INTEGER,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(phone)
    )
  `);

  // Passenger bookings
  db.exec(`
    CREATE TABLE IF NOT EXISTS passenger_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pnr TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      customer_age INTEGER,
      from_place TEXT NOT NULL,
      destination TEXT NOT NULL,
      boarding_point TEXT,
      travel_date DATE NOT NULL,
      seat_number TEXT NOT NULL,
      bus_operator TEXT NOT NULL,
      departure_time TEXT NOT NULL,
      total_fare REAL NOT NULL,
      commission REAL NOT NULL DEFAULT 0,
      net_fare REAL NOT NULL DEFAULT 0,
      part_b_returned INTEGER DEFAULT 0,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES employees(id)
    )
  `);

  // Parcel bookings
  db.exec(`
    CREATE TABLE IF NOT EXISTS parcel_bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pnr TEXT UNIQUE NOT NULL,
      sender_name TEXT NOT NULL,
      sender_phone TEXT NOT NULL,
      sender_address TEXT,
      receiver_name TEXT NOT NULL,
      receiver_phone TEXT NOT NULL,
      receiver_address TEXT,
      destination TEXT NOT NULL,
      num_boxes INTEGER NOT NULL DEFAULT 1,
      price_per_box REAL NOT NULL,
      loading_charges REAL DEFAULT 0,
      unloading_charges REAL DEFAULT 0,
      delivery_address TEXT,
      delivery_contact TEXT,
      status INTEGER NOT NULL DEFAULT 1,
      rate_fare REAL NOT NULL DEFAULT 0,
      net_fare REAL NOT NULL DEFAULT 0,
      commission REAL NOT NULL DEFAULT 0,
      bus_assigned TEXT,
      bus_departure_time TEXT, 
      bus_number TEXT, 
      driver_name TEXT,
      driver_phone TEXT,
      lr_number TEXT, 
      part_b_returned INTEGER DEFAULT 0,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES employees(id)
    )
  `);

  // Operator settlement tracking (amount owed per operator from passenger bookings)
  db.exec(`
    CREATE TABLE IF NOT EXISTS operator_settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator_name TEXT NOT NULL,
      booking_type TEXT NOT NULL,
      booking_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      settled INTEGER DEFAULT 0,
      settled_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Backfill columns for older databases (ignore errors if columns already exist)
  try {
    db.exec('ALTER TABLE passenger_bookings ADD COLUMN net_fare REAL NOT NULL DEFAULT 0');
  } catch (e) {}

  try {
    db.exec('ALTER TABLE passenger_bookings ADD COLUMN boarding_point TEXT');
  } catch (e) {}

  try {
    db.exec('ALTER TABLE employees ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
  } catch (e) {}

  try {
    db.exec('ALTER TABLE parcel_bookings ADD COLUMN rate_fare REAL NOT NULL DEFAULT 0');
  } catch (e) {}
  try {
    db.exec('ALTER TABLE parcel_bookings ADD COLUMN net_fare REAL NOT NULL DEFAULT 0');
  } catch (e) {}
  try {
    db.exec('ALTER TABLE parcel_bookings ADD COLUMN commission REAL NOT NULL DEFAULT 0');
  } catch (e) {}
  try {
    db.exec('ALTER TABLE parcel_bookings ADD COLUMN delivery_address TEXT');
  } catch (e) {}
  try {
    db.exec('ALTER TABLE parcel_bookings ADD COLUMN delivery_contact TEXT');
  } catch (e) {}
  try {
    db.exec('ALTER TABLE parcel_bookings ADD COLUMN status INTEGER NOT NULL DEFAULT 1');
  } catch (e) {}

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_passenger_pnr ON passenger_bookings(pnr);
    CREATE INDEX IF NOT EXISTS idx_passenger_date ON passenger_bookings(travel_date);
    CREATE INDEX IF NOT EXISTS idx_passenger_operator ON passenger_bookings(bus_operator);
    CREATE INDEX IF NOT EXISTS idx_parcel_pnr ON parcel_bookings(pnr);
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_operator_settlements_name ON operator_settlements(operator_name);
  `);

  // Activity log for audit (records every request / action)
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      query TEXT,
      body TEXT,
      ip TEXT,
      user_agent TEXT,
      status INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

module.exports = { init };
