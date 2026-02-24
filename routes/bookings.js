const express = require('express');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { passengerPnr } = require('../services/pnr');
const pdfService = require('../services/pdf');
const emailService = require('../services/email');
const path = require('path');
const fs = require('fs');
const { to12Hour } = require('../utils/time');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const list = db.prepare(`
    SELECT pb.*, e.name AS created_by_name
    FROM passenger_bookings pb
    LEFT JOIN employees e ON e.id = pb.created_by
    ORDER BY pb.travel_date DESC, pb.departure_time DESC
    LIMIT 200
  `).all();
  res.render('bookings/list', { bookings: list });
});

router.get('/new', (req, res) => {
  res.render('bookings/form', { booking: null, operators: getOperators(), pnr: req.query.pnr || '' });
});

function getOperators() {
  const rows = db.prepare(`
    SELECT DISTINCT bus_operator FROM passenger_bookings
    UNION SELECT DISTINCT bus_assigned FROM parcel_bookings WHERE bus_assigned IS NOT NULL AND bus_assigned != ''
    ORDER BY bus_operator
  `).all();
  return rows.map(r => r.bus_operator).filter(Boolean);
}

router.post('/new', async (req, res) => {
  const body = req.body || {};
  const pnr = body.pnr || passengerPnr();
  const createdBy = req.session.userId;

  const rateFare = parseFloat(body.rate_fare) || 0;
  let netFare = parseFloat(body.net_fare);
  if (!Number.isFinite(netFare) || netFare < 0) {
    netFare = rateFare;
  }
  if (netFare > rateFare) {
    netFare = rateFare;
  }
  const commission = rateFare - netFare;
  const operatorAmount = netFare;

  const insert = db.prepare(`
    INSERT INTO passenger_bookings (
      pnr, customer_name, customer_phone, customer_email, customer_age,
      from_place, destination, boarding_point, travel_date, seat_number,
      bus_operator, departure_time, total_fare, commission, net_fare, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insert.run(
    pnr,
    body.customer_name || '',
    body.customer_phone || '',
    body.customer_email || null,
    body.customer_age ? parseInt(body.customer_age, 10) : null,
    body.from_place || '',
    body.destination || '',
    body.boarding_point || null,
    body.travel_date || '',
    body.seat_number || '',
    body.bus_operator || '',
    body.departure_time || '',
    rateFare,
    commission,
    netFare,
    createdBy
  );

  // Operator settlement
  if (body.bus_operator && operatorAmount > 0) {
    const bookingId = db.prepare('SELECT last_insert_rowid() as id').get().id;
    db.prepare(`
      INSERT INTO operator_settlements (operator_name, booking_type, booking_id, amount)
      VALUES (?, 'passenger', ?, ?)
    `).run(body.bus_operator, bookingId, operatorAmount);
  }

  // Upsert customer for auto-fill
  if (body.customer_phone) {
    db.prepare(`
      INSERT INTO customers (name, phone, email, age)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(phone) DO UPDATE SET name=excluded.name, email=excluded.email, age=excluded.age
    `).run(
      body.customer_name || '',
      body.customer_phone,
      body.customer_email || null,
      body.customer_age ? parseInt(body.customer_age, 10) : null
    );
  }

  const booking = db.prepare('SELECT * FROM passenger_bookings WHERE pnr = ?').get(pnr);

  // Generate PDFs and send
  let partAPath = null;
  try {
    partAPath = await pdfService.passengerPartA(booking);
    await pdfService.passengerPartB(booking);
  } catch (e) {
    console.error('PDF error:', e);
  }

  var boardingText = booking.boarding_point ? (' Boarding point: ' + booking.boarding_point + '.') : '';
  const ticketMsg = `Your ticket PNR: ${pnr}. From: ${booking.from_place} to ${booking.destination}, Date: ${booking.travel_date}, Seat: ${booking.seat_number}. ${booking.bus_operator} - ${to12Hour(booking.departure_time)}.${boardingText}`;
  // WhatsApp not sent automatically to avoid costs. Use the "Notify on WhatsApp" button in the UI.
  if (booking.customer_email) {
    emailService.sendTicketEmail(
      booking.customer_email,
      `Ticket PNR ${pnr} - ${booking.from_place} to ${booking.destination}`,
      ticketMsg,
      partAPath
    ).catch(() => {});
  }

  req.session.flash = { type: 'success', message: `Booking created. PNR: ${pnr}` };
  res.redirect('/bookings?pnr=' + encodeURIComponent(pnr));
});

router.get('/:id/part-b', (req, res) => {
  const booking = db.prepare('SELECT * FROM passenger_bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).send('Not found');
  const filepath = path.join(pdfService.outputDir, `passenger-${booking.pnr}-partB.pdf`);
  if (!fs.existsSync(filepath)) {
    return res.status(404).send('Part B not generated. Create booking again.');
  }
  res.sendFile(path.resolve(filepath));
});

router.get('/:id/part-a', (req, res) => {
  const booking = db.prepare('SELECT * FROM passenger_bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).send('Not found');
  const filepath = path.join(pdfService.outputDir, `passenger-${booking.pnr}-partA.pdf`);
  if (!fs.existsSync(filepath)) {
    return res.status(404).send('Part A not generated.');
  }
  res.sendFile(path.resolve(filepath));
});

router.post('/:id/mark-part-b-returned', (req, res) => {
  const id = req.params.id;
  db.prepare('UPDATE passenger_bookings SET part_b_returned = 1 WHERE id = ?').run(id);
  const b = db.prepare('SELECT bus_operator FROM passenger_bookings WHERE id = ?').get(id);
  if (b) {
    db.prepare(`
      UPDATE operator_settlements SET settled = 1, settled_at = CURRENT_TIMESTAMP
      WHERE booking_type = 'passenger' AND booking_id = ?
    `).run(id);
  }
  req.session.flash = { type: 'success', message: 'Part B marked returned.' };
  res.redirect(req.headers.referer || '/');
});

// Edit net fare (after booking, e.g. operator changed rate)
router.get('/:id/edit-net', (req, res) => {
  const booking = db.prepare('SELECT * FROM passenger_bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).send('Not found');
  const netFare = booking.net_fare || booking.total_fare || 0;
  const commission = (booking.total_fare || 0) - netFare;
  res.render('bookings/edit_net', { booking, netFare, commission });
});

router.post('/:id/edit-net', (req, res) => {
  const id = req.params.id;
  const booking = db.prepare('SELECT * FROM passenger_bookings WHERE id = ?').get(id);
  if (!booking) {
    return res.redirect('/bookings');
  }
  const rateFare = booking.total_fare || 0;
  let netFare = parseFloat(req.body.net_fare);
  if (!Number.isFinite(netFare) || netFare < 0) {
    netFare = rateFare;
  }
  if (netFare > rateFare) {
    netFare = rateFare;
  }
  const commission = rateFare - netFare;

  db.prepare(`
    UPDATE passenger_bookings
    SET net_fare = ?, commission = ?
    WHERE id = ?
  `).run(netFare, commission, id);

  // Update operator settlement amount if not settled yet
  db.prepare(`
    UPDATE operator_settlements
    SET amount = ?
    WHERE booking_type = 'passenger' AND booking_id = ? AND settled = 0
  `).run(netFare, id);

  req.session.flash = { type: 'success', message: 'Net fare updated.' };
  res.redirect('/bookings');
});

module.exports = router;
