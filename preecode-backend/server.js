// Load environment variables first
require('dotenv').config();
console.log("FRONTEND_URL:", process.env.FRONTEND_URL);

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const passport = require('./config/passport');
const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const practiceRoutes = require('./routes/practiceRoutes');
const aiRoutes = require('./routes/aiRoutes');
const earlyAccessRoutes = require('./routes/earlyAccessRoutes');

const errorHandler = require('./middleware/errorMiddleware');

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION — shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

const app = express();

// Request logger for debugging in production
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} from ${req.ip} origin=${req.headers.origin || 'none'}`);
  next();
});

/* ================= SECURITY ================= */

app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

app.use(limiter);

/* ================= CORS ================= */

// CORS: allow only configured frontend origins (echo back origin when matched)
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
  'http://localhost:3000',
  'http://localhost:5001',
  'http://127.0.0.1:5500',
  'http://localhost:5500'
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // allow requests with no origin (like server-to-server, curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    console.warn('Blocked CORS request from origin:', origin);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'X-JSON-Response'],
};

// Enable CORS for all routes with the options and handle preflight
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Root route to avoid confusing "Not Found" when someone lands on the service root
app.get('/', (req, res) => {
  res.send('Preecode backend running');
});

/* ================= MIDDLEWARE ================= */

app.use(express.json({ limit: '50kb' }));
app.use(passport.initialize());

/* ================= ROUTES ================= */

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    environment: process.env.NODE_ENV,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/early-access', earlyAccessRoutes);

/* ================= ERROR HANDLER ================= */

app.use(errorHandler);

/* ================= SERVER START ================= */

const startServer = async () => {
  await connectDB();

  const PORT = process.env.PORT || 5001;

  const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION — shutting down...');
    console.error(err.name, err.message);
    server.close(() => process.exit(1));
  });
};

startServer();