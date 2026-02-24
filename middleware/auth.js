function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/login');
}

function optionalUser(req, res, next) {
  res.locals.user = req.session?.user || null;
  next();
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  res.status(403).send('Forbidden');
}

module.exports = { requireAuth, optionalUser, requireAdmin };
