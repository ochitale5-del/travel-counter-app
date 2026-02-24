const express = require('express');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { passengerPnr } = require('../services/pnr');
const pdfService = require('../services/pdf');
const emailService = require('../services/email');
const path = require('path');
const fs = require('fs');
const { to12Hour } = require('../utils/time');
const whatsappService = require('../services/whatsapp');

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
  // Thermal print layout
  pdfService
    .passengerPartB(booking)
    .then(({ filepath }) => res.sendFile(path.resolve(filepath)))
    .catch((e) => {
      console.error('Thermal Part B error:', e);
      res.status(500).send('Failed to generate Part B.');
    });
});

router.get('/:id/part-a', (req, res) => {
  const booking = db.prepare('SELECT * FROM passenger_bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).send('Not found');
  // Thermal print layout
  pdfService
    .passengerPartA(booking)
    .then(({ filepath }) => res.sendFile(path.resolve(filepath)))
    .catch((e) => {
      console.error('Thermal Part A error:', e);
      res.status(500).send('Failed to generate Part A.');
    });
});

router.post('/:id/notify-whatsapp', async (req, res) => {
  const booking = db.prepare('SELECT * FROM passenger_bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).send('Not found');
  // Build message per requested format, include reporting time (15 minutes before departure)
  const departure = booking.departure_time || '';
  function subtractMinutes(timeStr, mins) {
    if (!timeStr || typeof timeStr !== 'string') return '';
    const parts = timeStr.split(':');
    if (parts.length < 2) return '';
    let h = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
    let total = h * 60 + m - mins;
    if (total < 0) total += 24 * 60;
    const nh = Math.floor(total / 60) % 24;
    const nm = total % 60;
    return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
  }

  const reportingRaw = subtractMinutes(departure, 15);
  const reportingDisplay = reportingRaw ? to12Hour(reportingRaw) : 'TBD';
  const departureDisplay = departure ? to12Hour(departure) : 'TBD';

  // Number of seats: count comma-separated seat numbers or default to 1 if seat present
  let seatsCount = 0;
  if (booking.seat_number && String(booking.seat_number).trim() !== '') {
    seatsCount = String(booking.seat_number).split(',').filter(Boolean).length || 1;
  }

  const msg =
    `Good news — your booking is confirmed!\n\n` +
    `PNR: ${booking.pnr || ''}\n` +
    `From: ${booking.from_place || ''}\n` +
    `To: ${booking.destination || ''}\n` +
    `Date: ${booking.travel_date || ''}\n` +
    `Departure: ${departureDisplay}\n` +
    `Reporting time: ${reportingDisplay} (always 15min before departure time)\n` +
    `No. of seats: ${seatsCount}\n` +
    `Seat(s): ${booking.seat_number || ''}\n` +
    `Operator: ${booking.bus_operator || ''}\n` +
    `Boarding point: ${booking.boarding_point || ''}\n\n` +
    `Relax — arrive at the reporting point a little early and we will take care of the rest. Have a pleasant journey!`;

  // A4 PDF link appended if PUBLIC_BASE_URL/MEDIA_TOKEN configured
  const { filename } = await pdfService.passengerPartA_A4(booking);
  const base = process.env.PUBLIC_BASE_URL || '';
  const token = process.env.MEDIA_TOKEN || '';
  const publicLink = base && token ? `${base}/media/${encodeURIComponent(filename)}?token=${encodeURIComponent(token)}` : null;
  const finalMsg = publicLink ? `${msg}\n\nTicket: ${publicLink}` : msg;

  const result = await whatsappService.sendWhatsApp(booking.customer_phone, finalMsg);
  if (result.fallbackUrl) {
    return res.redirect(result.fallbackUrl);
  }
  req.session.flash = { type: 'success', message: 'WhatsApp notification sent (A4 PDF attached if configured).' };
  res.redirect(req.headers.referer || '/bookings');
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
