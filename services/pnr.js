const db = require('../config/database');

function generatePNR() {
  const row = db.prepare(`
    UPDATE pnr_counter SET last_pnr = last_pnr + 1 WHERE id = 1 RETURNING last_pnr
  `).get();
  return String(row.last_pnr);
}

function passengerPnr() {
  return generatePNR();
}

function parcelPnr() {
  return generatePNR();
}

module.exports = { passengerPnr, parcelPnr };