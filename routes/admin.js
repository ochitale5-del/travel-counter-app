const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireAdmin);

// Convenience: redirect /admin to the users page
router.get('/', (req, res) => {
  res.redirect('/admin/users');
});

router.get('/users', (req, res) => {
  const users = db.prepare('SELECT id, name, username, role, created_at, active FROM employees ORDER BY id').all();
  res.render('admin/users', { users });
});

router.get('/users/new', (req, res) => {
  res.render('admin/new_user', { error: null });
});

router.post('/users/new', (req, res) => {
  const { name, username, password, role } = req.body || {};
  if (!name || !username || !password) {
    return res.render('admin/new_user', { error: 'Name, username and password are required' });
  }
  const hash = bcrypt.hashSync(password, 10);
  try {
    db.prepare('INSERT INTO employees (name, username, password_hash, role) VALUES (?, ?, ?, ?)').run(name, username, hash, role || 'staff');
    req.session.flash = { type: 'success', message: 'User created' };
    res.redirect('/admin/users');
  } catch (e) {
    res.render('admin/new_user', { error: 'Failed to create user: ' + (e.message || e) });
  }
});

router.post('/users/:id/reset-password', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const newPass = (req.body.password || '').trim();
  if (!newPass) {
    req.session.flash = { type: 'error', message: 'Password required' };
    return res.redirect('/admin/users');
  }
  const hash = bcrypt.hashSync(newPass, 10);
  db.prepare('UPDATE employees SET password_hash = ? WHERE id = ?').run(hash, id);
  req.session.flash = { type: 'success', message: 'Password reset' };
  res.redirect('/admin/users');
});

router.post('/users/:id/delete', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.redirect('/admin/users');
  // Prevent admins deleting themselves
  if (req.session.userId === id || (req.session.user && req.session.user.id === id)) {
    req.session.flash = { type: 'error', message: 'You cannot delete your own account' };
    return res.redirect('/admin/users');
  }

  try {
    db.prepare('UPDATE employees SET active = 0 WHERE id = ?').run(id);
    req.session.flash = { type: 'success', message: 'User marked inactive' };
  } catch (e) {
    req.session.flash = { type: 'error', message: 'Failed to mark inactive: ' + (e.message || e) };
  }
  res.redirect('/admin/users');
});

router.post('/users/:id/restore', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!id) return res.redirect('/admin/users');
  try {
    db.prepare('UPDATE employees SET active = 1 WHERE id = ?').run(id);
    req.session.flash = { type: 'success', message: 'User restored' };
  } catch (e) {
    req.session.flash = { type: 'error', message: 'Failed to restore user: ' + (e.message || e) };
  }
  res.redirect('/admin/users');
});

// If someone opens the delete URL in the browser (GET), redirect with a helpful message
router.get('/users/:id/delete', (req, res) => {
  req.session.flash = { type: 'error', message: 'To delete a user, use the Delete button on the Users page.' };
  res.redirect('/admin/users');
});

// If someone opens the restore URL in the browser (GET), redirect with a helpful message
router.get('/users/:id/restore', (req, res) => {
  req.session.flash = { type: 'error', message: 'To restore a user, use the Restore button on the Users page.' };
  res.redirect('/admin/users');
});

router.get('/logs', (req, res) => {
  const logs = db.prepare('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 500').all();
  res.render('admin/logs', { logs });
});

module.exports = router;
