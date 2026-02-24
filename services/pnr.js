const db = require('../config/database');

function generatePnr(prefix = 'T') {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pnr;
  let exists = true;
  while (exists) {
    pnr = prefix + Date.now().toString(36).toUpperCase().slice(-6);
    for (let i = 0; i < 3; i++) {
      pnr += chars[Math.floor(Math.random() * chars.length)];
    }
    const row = db.prepare(
      "SELECT 1 FROM passenger_bookings WHERE pnr = ? UNION SELECT 1 FROM parcel_bookings WHERE pnr = ?"
    ).get(pnr, pnr);
    exists = !!row;
  }
  return pnr;
}

function passengerPnr() {
  return generatePnr('P');
}

function parcelPnr() {
  return generatePnr('X');
}

module.exports = { passengerPnr, parcelPnr };
