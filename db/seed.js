const db = require('../config/database');
const bcrypt = require('bcrypt');
const schema = require('./schema');

schema.init();

const defaultPassword = 'admin123';
const hash = bcrypt.hashSync(defaultPassword, 10);

const insert = db.prepare(`
  INSERT OR IGNORE INTO employees (name, username, password_hash, role)
  VALUES (?, ?, ?, ?)
`);

insert.run('Admin', 'admin', hash, 'admin');
insert.run('Staff One', 'staff1', hash, 'staff');
insert.run('Staff Two', 'staff2', hash, 'staff');

console.log('Database initialized. Default logins: admin/admin123, staff1/admin123, staff2/admin123');
