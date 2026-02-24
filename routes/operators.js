const express = require('express');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const byOperator = db.prepare(`
    SELECT operator_name,
           SUM(CASE WHEN settled = 0 THEN amount ELSE 0 END) AS pending,
           SUM(CASE WHEN settled = 1 THEN amount ELSE 0 END) AS settled_total,
           SUM(amount) AS total
    FROM operator_settlements
    GROUP BY operator_name
    ORDER BY pending DESC, operator_name
  `).all();

  const details = db.prepare(`
    SELECT * FROM operator_settlements
    ORDER BY operator_name, created_at DESC
  `).all();

  res.render('operators/list', { byOperator, details });
});

router.post('/:id/settle', (req, res) => {
  const id = req.params.id;
  const row = db.prepare('SELECT * FROM operator_settlements WHERE id = ?').get(id);
  if (!row) return res.redirect('/operators');
  db.prepare('UPDATE operator_settlements SET settled = 1, settled_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  if (row.booking_type === 'passenger') {
    db.prepare('UPDATE passenger_bookings SET part_b_returned = 1 WHERE id = ?').run(row.booking_id);
  }
  req.session.flash = { type: 'success', message: 'Settlement marked as settled.' };
  res.redirect('/operators');
});

module.exports = router;
