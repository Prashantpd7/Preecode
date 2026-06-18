const mongoose = require('mongoose');

/**
 * AiSecurityAudit Schema
 * 
 * Stores audit logs for AI-generated code security events.
 */
const aiSecurityAuditSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  prompt: {
    type: String,
    default: ''
  },
  generatedCode: {
    type: String,
    default: ''
  },
  securityIssues: [{
    issue: String,
    severity: String,
    description: String,
    lineNumber: Number,
    recommendation: String
  }],
  securityScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  policyAction: {
    type: String,
    enum: ['Block', 'Warn', 'Allow'],
    default: 'Allow'
  },
  armorIQStatus: {
    type: String,
    default: 'Disconnected'
  }
});

// Create indexes
aiSecurityAuditSchema.index({ userId: 1, timestamp: -1 });
aiSecurityAuditSchema.index({ riskLevel: 1 });
aiSecurityAuditSchema.index({ policyAction: 1 });

module.exports = mongoose.model('AiSecurityAudit', aiSecurityAuditSchema);
