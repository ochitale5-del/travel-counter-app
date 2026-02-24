const express = require('express');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { parcelPnr } = require('../services/pnr');
const pdfService = require('../services/pdf');
const whatsappService = require('../services/whatsapp');
const path = require('path');
const fs = require('fs');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const list = db.prepare(`
    SELECT p.*, e.name AS created_by_name
    FROM parcel_bookings p
    LEFT JOIN employees e ON e.id = p.created_by
    ORDER BY p.created_at DESC
    LIMIT 200
  `).all();
  res.render('parcels/list', { parcels: list });
});

router.get('/new', (req, res) => {
  res.render('parcels/form', { parcel: null });
});

router.get('/:id', (req, res) => {
  const parcel = db.prepare('SELECT * FROM parcel_bookings WHERE id = ?').get(req.params.id);
  if (!parcel) return res.status(404).send('Not found');
  res.render('parcels/detail', { parcel });
});

router.post('/new', async (req, res) => {
  const body = req.body || {};
  const pnr = body.pnr || parcelPnr();
  const createdBy = req.session.userId;

  const pricePerBox = parseFloat(body.price_per_box) || 0;
  const numBoxes = parseInt(body.num_boxes, 10) || 1;
  const loading = parseFloat(body.loading_charges) || 0;
  const unloading = parseFloat(body.unloading_charges) || 0;

  const rateFare = numBoxes * pricePerBox + loading + unloading;
  let netFare = parseFloat(body.net_fare);
  if (!Number.isFinite(netFare) || netFare < 0) {
    netFare = rateFare;
  }
  if (netFare > rateFare) {
    netFare = rateFare;
  }
  const commission = rateFare - netFare;

  db.prepare(`
    INSERT INTO parcel_bookings (
      pnr, sender_name, sender_phone, sender_address,
      receiver_name, receiver_phone, receiver_address,
      delivery_address, delivery_contact,
      destination, num_boxes, price_per_box, loading_charges, unloading_charges,
      rate_fare, net_fare, commission, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    pnr,
    body.sender_name || '',
    body.sender_phone || '',
    body.sender_address || null,
    body.receiver_name || '',
    body.receiver_phone || '',
    body.receiver_address || null,
    body.delivery_address || null,
    body.delivery_contact || null,
    body.destination || '',
    numBoxes,
    pricePerBox,
    loading,
    unloading,
    rateFare,
    netFare,
    commission,
    createdBy
  );

  const parcel = db.prepare('SELECT * FROM parcel_bookings WHERE pnr = ?').get(pnr);
  try {
    await pdfService.parcelPartB(parcel);
  } catch (e) {
    console.error('Parcel PDF error:', e);
  }

  req.session.flash = { type: 'success', message: `Parcel created. PNR: ${pnr}` };
  // Redirect to parcels list and highlight the created PNR so user can notify immediately
  res.redirect('/parcels?pnr=' + encodeURIComponent(pnr));
});

router.get('/:id/part-b', (req, res) => {
  const parcel = db.prepare('SELECT * FROM parcel_bookings WHERE id = ?').get(req.params.id);
  if (!parcel) return res.status(404).send('Not found');
  const filepath = path.join(pdfService.outputDir, `parcel-${parcel.pnr}-partB.pdf`);
  if (!fs.existsSync(filepath)) {
    return res.status(404).send('Part B not generated.');
  }
  res.sendFile(path.resolve(filepath));
});

router.post('/:id/assign-bus', async (req, res) => {
  const id = req.params.id;
  const { bus_assigned, bus_number, driver_name, driver_phone, lr_number, dep_hour, dep_minute, dep_period } = req.body || {};

  // Convert AM/PM to 24hr format
  let bus_departure_time = null;
  if (dep_hour && dep_minute && dep_period) {
    let hour = parseInt(dep_hour);
    if (dep_period === 'PM' && hour !== 12) hour += 12;
    if (dep_period === 'AM' && hour === 12) hour = 0;
    bus_departure_time = `${String(hour).padStart(2,'0')}:${dep_minute}`;
  }

  db.prepare(`
    UPDATE parcel_bookings SET bus_assigned = ?, bus_departure_time = ?, bus_number = ?, driver_name = ?, driver_phone = ?, lr_number = ? WHERE id = ?
  `).run(bus_assigned || null, bus_departure_time || null, bus_number || null, driver_name || null, driver_phone || null, lr_number || null, id);

  const parcel = db.prepare('SELECT * FROM parcel_bookings WHERE id = ?').get(id);
  if (parcel && (bus_assigned || bus_departure_time)) {
    try {
      await pdfService.parcelPartB(parcel);
    } catch (e) {}
  }

  req.session.flash = { type: 'success', message: 'Bus assigned and parties notified.' };
  res.redirect('/parcels');
});

router.post('/:id/mark-part-b-returned', (req, res) => {
  db.prepare('UPDATE parcel_bookings SET part_b_returned = 1 WHERE id = ?').run(req.params.id);
  req.session.flash = { type: 'success', message: 'Part B marked returned.' };
  res.redirect(req.headers.referer || '/parcels');
});

router.post('/:id/update-status', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!isFinite(id) || id <= 0) throw new Error('Invalid parcel id');
    let st = parseInt(req.body.status, 10);
    if (!isFinite(st) || (st !== 1 && st !== 2)) st = 1;
    db.prepare('UPDATE parcel_bookings SET status = ? WHERE id = ?').run(st, id);
    req.session.flash = { type: 'success', message: 'Parcel status updated.' };
  } catch (e) {
    console.error('Update status error:', e && e.message);
    req.session.flash = { type: 'error', message: 'Failed to update parcel status.' };
  }
  res.redirect(req.headers.referer || '/parcels');
});

// Backwards-compatible endpoint: accept POST /parcels/update-status with id in body
router.post('/update-status', (req, res) => {
  try {
    const id = parseInt(req.body.id, 10);
    if (!isFinite(id) || id <= 0) throw new Error('Invalid parcel id');
    let st = parseInt(req.body.status, 10);
    if (!isFinite(st) || (st !== 1 && st !== 2)) st = 1;
    db.prepare('UPDATE parcel_bookings SET status = ? WHERE id = ?').run(st, id);
    req.session.flash = { type: 'success', message: 'Parcel status updated.' };
  } catch (e) {
    console.error('Update status error (body):', e && e.message);
    req.session.flash = { type: 'error', message: 'Failed to update parcel status.' };
  }
  res.redirect(req.headers.referer || '/parcels');
});

router.post('/:id/update-delivery', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!isFinite(id) || id <= 0) throw new Error('Invalid parcel id');
    const addr = (req.body.delivery_address || '').trim() || null;
    let contact = (req.body.delivery_contact || '').replace(/\D/g, '');
    if (contact === '') contact = null;
    db.prepare('UPDATE parcel_bookings SET delivery_address = ?, delivery_contact = ? WHERE id = ?').run(addr, contact, id);
    req.session.flash = { type: 'success', message: 'Delivery details updated.' };
  } catch (e) {
    console.error('Update delivery error:', e && e.message);
    req.session.flash = { type: 'error', message: 'Failed to update delivery details.' };
  }
  res.redirect(req.headers.referer || ('/parcels/' + req.params.id));
});

// Edit net fare for parcel
router.get('/:id/edit-net', (req, res) => {
  const parcel = db.prepare('SELECT * FROM parcel_bookings WHERE id = ?').get(req.params.id);
  if (!parcel) return res.status(404).send('Not found');
  const rateFare = parcel.rate_fare || (parcel.num_boxes * parcel.price_per_box + parcel.loading_charges + parcel.unloading_charges) || 0;
  const netFare = parcel.net_fare || rateFare;
  const commission = rateFare - netFare;
  res.render('parcels/edit_net', { parcel, rateFare, netFare, commission });
});

router.post('/:id/edit-net', (req, res) => {
  const id = req.params.id;
  const parcel = db.prepare('SELECT * FROM parcel_bookings WHERE id = ?').get(id);
  if (!parcel) return res.redirect('/parcels');

  const rateFare = parcel.rate_fare || (parcel.num_boxes * parcel.price_per_box + parcel.loading_charges + parcel.unloading_charges) || 0;
  let netFare = parseFloat(req.body.net_fare);
  if (!Number.isFinite(netFare) || netFare < 0) {
    netFare = rateFare;
  }
  if (netFare > rateFare) {
    netFare = rateFare;
  }
  const commission = rateFare - netFare;

  db.prepare(`
    UPDATE parcel_bookings
    SET net_fare = ?, commission = ?
    WHERE id = ?
  `).run(netFare, commission, id);

  req.session.flash = { type: 'success', message: 'Parcel net fare updated.' };
  res.redirect('/parcels');
});

module.exports = router;

