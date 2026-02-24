const express = require('express');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// DASHBOARD ROUTE
router.get('/', requireAuth, (req, res) => {
  const { todayDateIST } = require('../utils/time');
  const today = todayDateIST();

  try {
    const passengerBookings = db.prepare(`
      SELECT pb.*, e.name AS created_by_name
      FROM passenger_bookings pb
      LEFT JOIN employees e ON e.id = pb.created_by
      WHERE pb.travel_date = ?
      ORDER BY pb.departure_time, pb.id
    `).all(today);

    const parcelBookings = db.prepare(`
      SELECT p.*, e.name AS created_by_name
      FROM parcel_bookings p
      LEFT JOIN employees e ON e.id = p.created_by
      WHERE date(p.created_at) = ?
      ORDER BY p.id DESC
    `).all(today);

    const revenueToday = db.prepare(`
      SELECT COALESCE(SUM(total_fare), 0) AS total
      FROM passenger_bookings WHERE travel_date = ?
    `).get(today);

    const commissionToday = db.prepare(`
      SELECT COALESCE(SUM(commission), 0) AS total
      FROM passenger_bookings WHERE travel_date = ?
    `).get(today);

    const pendingSettlements = db.prepare(`
      SELECT operator_name, SUM(amount) AS total
      FROM operator_settlements
      WHERE settled = 0
      GROUP BY operator_name
      ORDER BY total DESC
    `).all();

    const schedule = db.prepare(`
      SELECT bus_operator, departure_time,
             GROUP_CONCAT(seat_number) AS seats,
             COUNT(*) AS pax,
             SUM(total_fare) AS fare_total
      FROM passenger_bookings
      WHERE travel_date = ?
      GROUP BY bus_operator, departure_time
      ORDER BY departure_time
    `).all(today);

    res.render('dashboard', {
      passengerBookings,
      parcelBookings,
      revenueToday: revenueToday?.total || 0,
      commissionToday: commissionToday?.total || 0,
      pendingSettlements,
      schedule,
      today
    });
  } catch (err) {
    console.error("Dashboard Load Error:", err);
    res.status(500).send("Error loading dashboard.");
  }
});

// SEARCH ROUTE: Direct Address to your Search Form
router.get('/search', requireAuth, (req, res) => {
  const q = (req.query.q || '').trim();
  
  if (!q) {
    return res.render('search', { q: '', passengers: [], parcels: [] });
  }

  const like = `%${q}%`;

  try {
    const passengers = db.prepare(`
      SELECT pb.*, e.name AS created_by_name
      FROM passenger_bookings pb
      LEFT JOIN employees e ON e.id = pb.created_by
      WHERE pb.pnr LIKE ? 
         OR pb.customer_phone LIKE ? 
         OR pb.customer_name LIKE ?
      ORDER BY pb.travel_date DESC
    `).all(like, like, like);

    const parcels = db.prepare(`
      SELECT p.*, e.name AS created_by_name
      FROM parcel_bookings p
      LEFT JOIN employees e ON e.id = p.created_by
      WHERE p.pnr LIKE ? 
         OR p.sender_phone LIKE ? 
         OR p.sender_name LIKE ?
      ORDER BY p.id DESC
    `).all(like, like, like);

    res.render('search', { q, passengers, parcels });
  } catch (err) {
    console.error("Search Logic Error:", err);
    res.status(500).send("Search failed.");
  }
});

module.exports = router;