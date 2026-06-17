const express = require('express');
const router = express.Router();
const { analyzeCode, getAuditLogs } = require('../controllers/securityController');
const auth = require('../middleware/authMiddleware');

// POST /api/security/analyze - Analyze code for security vulnerabilities
// In production, auth is required. In development, auth is skipped because
// the local backend's JWT_SECRET may differ from the production backend that
// issued the user's token. The controller handles missing req.user gracefully
// via optional chaining (req.user?._id).
// The audit-logs endpoint below always requires auth.
const securityMiddlewares = process.env.NODE_ENV === 'production' ? [auth] : [];
router.post('/analyze', ...securityMiddlewares, analyzeCode);

// GET /api/security/audit-logs - Get recent audit logs
router.get('/audit-logs', auth, getAuditLogs);

module.exports = router;
