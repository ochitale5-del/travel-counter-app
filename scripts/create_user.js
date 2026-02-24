#!/usr/bin/env node
const db = require('../config/database');
const bcrypt = require('bcrypt');

function usage() {
  console.log('Usage: node scripts/create_user.js --name "Full Name" --username user --password pass [--role admin|staff]');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) usage();

const opts = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--name') opts.name = args[++i];
  else if (a === '--username') opts.username = args[++i];
  else if (a === '--password') opts.password = args[++i];
  else if (a === '--role') opts.role = args[++i];
}

if (!opts.name || !opts.username || !opts.password) usage();
opts.role = opts.role || 'staff';

(async () => {
  try {
    const existing = db.prepare('SELECT id FROM employees WHERE username = ?').get(opts.username);
    if (existing) {
      console.error('A user with that username already exists.');
      process.exit(1);
    }

    const hash = await bcrypt.hash(opts.password, 10);
    const stmt = db.prepare('INSERT INTO employees (name, username, password_hash, role) VALUES (?, ?, ?, ?)');
    const info = stmt.run(opts.name, opts.username, hash, opts.role);
    console.log('Created user', { id: info.lastInsertRowid, username: opts.username, role: opts.role });
    process.exit(0);
  } catch (err) {
    console.error('Error creating user:', err.message || err);
    process.exit(2);
  }
})();
