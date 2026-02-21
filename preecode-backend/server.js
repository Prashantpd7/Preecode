require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });

const express = require('express');
const path = require('path');
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

// Helmet with relaxed CSP for development
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});
app.use(limiter);

// CORS — same origin now, but keep it for any external API calls
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
}));

// Passport
app.use(passport.initialize());

// Body parser
app.use(express.json({ limit: '50kb' }));

// ─────────────────────────────────────────────────────────
// SERVE FRONTEND STATIC FILES FROM BACKEND
// Frontend and backend are in the SAME folder, so __dirname is correct.
// This eliminates the cross-origin port problem entirely.
// Frontend (preecode-Ui) is a sibling folder next to preecode-backend
// Absolute path derived from __dirname so it always resolves correctly
// regardless of where you run `node` from.
const staticPath = path.join(__dirname, '..', 'preecode-Ui');
console.log('✅  Serving frontend from:', staticPath);
app.use(express.static(staticPath));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', frontendURL: process.env.FRONTEND_URL });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/early-access', earlyAccessRoutes);

// Error Middleware
app.use(errorHandler);

const startServer = async () => {
  await connectDB();

  const PORT = process.env.PORT || 5001;
  const server = app.listen(PORT, () => {
    console.log(`✅  Server + Frontend running on http://localhost:${PORT}`);
    console.log(`✅  Open: http://localhost:${PORT}/login.html`);
  });

  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION — shutting down...');
    console.error(err.name, err.message);
    server.close(() => process.exit(1));
  });
};

startServer();