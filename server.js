try { require('dotenv').config(); } catch (e) {}
const express = require('express');
const path = require('path');
const session = require('express-session');
const { init } = require('./db/schema');
const { requireAuth, optionalUser } = require('./middleware/auth');
const activityLogger = require('./middleware/activity');
const { to12Hour, todayDateIST, formatDateTimeIST } = require('./utils/time');
const db = require('./config/database');

const authRoutes = require('./routes/auth');
const indexRoutes = require('./routes/index');
const bookingsRoutes = require('./routes/bookings');
const parcelsRoutes = require('./routes/parcels');
const operatorsRoutes = require('./routes/operators');
const customersRoutes = require('./routes/customers');
const reportsRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');

init();

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.locals.time12 = to12Hour;
app.locals.todayDate = todayDateIST;
app.locals.formatIST = formatDateTimeIST;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'travel-counter-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));
app.use(optionalUser);

// Activity logger (records requests for admin audit)
app.use(activityLogger);

app.use((req, res, next) => {
  const flash = req.session.flash;
  if (flash) {
    delete req.session.flash;
    res.locals.flash = flash;
  }
  next();
});

app.use('/', authRoutes);
app.use('/', indexRoutes);
app.use('/bookings', bookingsRoutes);
app.use('/parcels', parcelsRoutes);
app.use('/operators', operatorsRoutes);
app.use('/customers', customersRoutes);
app.use('/reports', reportsRoutes);
app.use('/admin', adminRoutes);

app.use('/assets', express.static(path.join(__dirname, 'public')));

// Health endpoint for containers/load balancers
app.get('/health', (req, res) => {
  try {
    // simple DB check
    const ok = db.prepare('SELECT 1 AS ok').get();
    res.json({ status: 'ok', db: !!ok, uptime: process.uptime() });
  } catch (e) {
    res.status(500).json({ status: 'error', error: String(e) });
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ratna CT Travels app running at http://localhost:${PORT}`);
});
