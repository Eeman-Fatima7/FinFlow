const path = require('path');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const runMigrations = require('./db/migrate');

const app = express();

const resolveAllowedOrigins = () => {
  const configured = String(process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured.length > 0) return configured;

  return [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
};

const allowedOrigins = resolveAllowedOrigins();

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('CORS blocked for this origin'));
  },
  credentials: true,
};

app.use(cors(corsOptions));

const authLimiterWindowMs = Math.min(Math.max(Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, 60 * 1000), 60 * 60 * 1000);
const authLimiterMax = Math.min(Math.max(Number(process.env.AUTH_RATE_LIMIT_MAX) || 20, 5), 200);

const authLimiter = rateLimit({
  windowMs: authLimiterWindowMs,
  max: authLimiterMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth requests. Please try again later.' },
});

app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);
app.use('/auth/forgot-password', authLimiter);
app.use('/auth/reset-password', authLimiter);
app.use('/auth/password', authLimiter);
app.use('/auth/me', authLimiter);

app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Finance Advisor API is running ✓' });
});

// Routes
app.use('/auth',         require('./routes/auth'));
app.use('/transactions', require('./routes/transactions'));
app.use('/dashboard',    require('./routes/dashboard'));
app.use('/budgets',      require('./routes/budgets'));
app.use('/goals',        require('./routes/goals'));
app.use('/categories',   require('./routes/categories'));
app.use('/suggestions',  require('./routes/suggestions'));
app.use('/ai',           require('./routes/ai'));
app.use('/support',      require('./routes/support'));
app.use('/forecast',     require('./routes/forecast'));
app.use('/anomalies',    require('./routes/anomalies'));
app.use('/stocks',       require('./routes/stocks'));
app.use('/onboarding',   require('./routes/onboarding'));
app.use('/admin',        require('./routes/admin'));

app.use((err, req, res, next) => {
  if (err && err.message === 'CORS blocked for this origin') {
    return res.status(403).json({ error: 'Origin not allowed by CORS policy' });
  }

  return next(err);
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await runMigrations();
  } catch (err) {
    console.error('Database bootstrap failed:', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
};

startServer();