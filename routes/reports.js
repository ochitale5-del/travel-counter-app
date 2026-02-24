const express = require('express');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const pdfService = require('../services/pdf');

const router = express.Router();
router.use(requireAuth);

function normalizeDateRange(query) {
  let { from, to } = query || {};
  const { todayDateIST } = require('../utils/time');
  const today = todayDateIST();

  if (!from && !to) {
    from = today;
    to = today;
  } else if (!from) {
    from = to;
  } else if (!to) {
    to = from;
  }

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRe.test(from)) from = today;
  if (!dateRe.test(to)) to = from;

  if (from > to) {
    const tmp = from;
    from = to;
    to = tmp;
  }

  return { from, to };
}

function getReportData(from, to) {
  const revenueRow = db
    .prepare(
      `
      SELECT COALESCE(SUM(total_fare), 0) AS total
      FROM passenger_bookings
      WHERE travel_date BETWEEN ? AND ?
    `
    )
    .get(from, to);

  const commissionRow = db
    .prepare(
      `
      SELECT COALESCE(SUM(commission), 0) AS total
      FROM passenger_bookings
      WHERE travel_date BETWEEN ? AND ?
    `
    )
    .get(from, to);

  const settlementsRow = db
    .prepare(
      `
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM operator_settlements
      WHERE settled = 1 AND date(settled_at) BETWEEN ? AND ?
    `
    )
    .get(from, to);

  const passengerCountRow = db
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM passenger_bookings
      WHERE travel_date BETWEEN ? AND ?
    `
    )
    .get(from, to);

  const parcelCountRow = db
    .prepare(
      `
      SELECT COUNT(*) AS count
      FROM parcel_bookings
      WHERE date(created_at) BETWEEN ? AND ?
    `
    )
    .get(from, to);

  const passengers = db
    .prepare(
      `
      SELECT pb.pnr,
             pb.customer_name,
             pb.destination,
             pb.travel_date,
             pb.total_fare,
             pb.bus_operator,
             e.name AS employee_name
      FROM passenger_bookings pb
      LEFT JOIN employees e ON e.id = pb.created_by
      WHERE pb.travel_date BETWEEN ? AND ?
      ORDER BY pb.travel_date, pb.departure_time, pb.id
    `
    )
    .all(from, to);

  const parcels = db
    .prepare(
      `
      SELECT p.pnr,
             p.sender_name,
             p.receiver_name,
             p.destination,
             p.num_boxes,
             p.rate_fare,
             p.price_per_box,
             p.loading_charges,
             p.unloading_charges,
             p.part_b_returned,
             p.bus_assigned,
             p.created_at
      FROM parcel_bookings p
      WHERE date(p.created_at) BETWEEN ? AND ?
      ORDER BY p.created_at, p.id
    `
    )
    .all(from, to);

  const summary = {
    revenue: revenueRow.total || 0,
    commission: commissionRow.total || 0,
    settlementsPaid: settlementsRow.total || 0,
    passengerCount: passengerCountRow.count || 0,
    parcelCount: parcelCountRow.count || 0,
  };

  return { summary, passengers, parcels };
}

router.get('/', (req, res) => {
  const { from, to } = normalizeDateRange(req.query || {});
  const { summary, passengers, parcels } = getReportData(from, to);

  res.render('reports/index', {
    fromDate: from,
    toDate: to,
    summary,
    passengers,
    parcels,
  });
});

router.get('/pdf', async (req, res) => {
  const { from, to } = normalizeDateRange(req.query || {});
  const { summary, passengers, parcels } = getReportData(from, to);

  try {
    const filepath = await pdfService.reportPdf(from, to, summary, passengers, parcels);
    res.download(filepath, `report-${from}-to-${to}.pdf`);
  } catch (e) {
    console.error('Report PDF error:', e);
    res.status(500).send('Failed to generate report PDF.');
  }
});

module.exports = router;

