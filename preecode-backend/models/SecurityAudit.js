const mongoose = require('mongoose');

/**
 * SecurityAudit Schema
 * 
 * Stores audit logs for security analysis events.
 * Used to track security scans, policy evaluations, and other security-related actions.
 */
const securityAuditSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true,
  },
  action: {
    type: String,
    required: true,
    enum: [
      'security_scan',
      'policy_check',
      'audit_log',
      'code_review_security',
      'vulnerability_scan',
      'dependency_scan',
    ],
    index: true,
  },
  resource: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
    enum: ['completed', 'failed', 'pending'],
    default: 'completed',
  },
  fileName: {
    type: String,
    default: '',
  },
  language: {
    type: String,
    default: '',
  },
  securityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: null,
  },
  issueCount: {
    type: Number,
    default: 0,
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low',
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  ip: {
    type: String,
    default: '',
  },
  userAgent: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Index for common queries
securityAuditSchema.index({ userId: 1, createdAt: -1 });
securityAuditSchema.index({ action: 1, createdAt: -1 });
securityAuditSchema.index({ severity: 1, createdAt: -1 });

module.exports = mongoose.model('SecurityAudit', securityAuditSchema);
