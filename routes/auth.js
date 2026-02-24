const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.render('login', { error: 'Username and password required' });
  }
  const emp = db.prepare('SELECT id, name, username, password_hash, role FROM employees WHERE username = ? AND active = 1').get(username);
  if (!emp || !bcrypt.compareSync(password, emp.password_hash)) {
    return res.render('login', { error: 'Invalid username or password' });
  }
  req.session.userId = emp.id;
  req.session.user = { id: emp.id, name: emp.name, username: emp.username, role: emp.role };
  res.redirect('/');
});

router.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
