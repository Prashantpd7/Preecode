console.log("FRONTEND_URL:", process.env.FRONTEND_URL);
require('dotenv').config();

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

app.use(cors({
  origin: process.env.FRONTEND_URL, // Set this in Render
  credentials: true,
}));

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