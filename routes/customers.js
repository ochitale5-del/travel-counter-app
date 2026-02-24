const express = require('express');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) {
    return res.json([]);
  }
  const list = db.prepare(`
    SELECT id, name, phone, email, age, address
    FROM customers
    WHERE phone LIKE ? OR name LIKE ? OR email LIKE ?
    ORDER BY name
    LIMIT 20
  `).all(`%${q}%`, `%${q}%`, `%${q}%`);
  res.json(list);
});

router.get('/by-phone/:phone', (req, res) => {
  const phone = (req.params.phone || '').replace(/\D/g, '');
  if (!phone) return res.json(null);
  const c = db.prepare('SELECT id, name, phone, email, age, address FROM customers WHERE phone LIKE ?').get(`%${phone}%`);
  res.json(c || null);
});

module.exports = router;
