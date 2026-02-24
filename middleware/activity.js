const db = require('../config/database');

// Logs each request after response finishes. Body and query are truncated to 1000 chars.
module.exports = function activityLogger(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    try {
      const user = req.session && req.session.user;
      const userId = user ? user.id : null;
      const username = user ? user.username : null;
      const method = req.method;
      const path = req.originalUrl || req.url;
      const query = JSON.stringify(req.query || {}) || null;
      let body = null;
      try { body = JSON.stringify(req.body || {}); } catch (e){ body = null; }
      if (body && body.length > 1000) body = body.slice(0,1000) + '...';
      const ip = req.ip || req.connection && req.connection.remoteAddress;
      const ua = req.get('User-Agent') || null;
      const status = res.statusCode || null;
      const insert = db.prepare(`INSERT INTO activity_logs (user_id, username, method, path, query, body, ip, user_agent, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      insert.run(userId, username, method, path, query, body, ip, ua, status);
    } catch (e) {
      console.error('Activity log error:', e && e.message);
    }
  });
  next();
};