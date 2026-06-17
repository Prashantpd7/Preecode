const { analyzeCode } = require('../services/armorclawService');
const { logSecurityScan, createAuditEntry } = require('../services/armoriqService');
const SecurityAudit = require('../models/SecurityAudit');

/**
 * POST /api/security/analyze
 * 
 * Analyzes selected code for security vulnerabilities.
 * Uses ArmorClaw service (with AI fallback) for analysis.
 * Logs results via ArmorIQ service and stores in SecurityAudit collection.
 */
exports.analyzeCode = async (req, res, next) => {
  try {
    const { code, fileName, language } = req.body;

    if (!code || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Code is required for security analysis.',
      });
    }

    const maxCodeLength = 50000;
    if (code.length > maxCodeLength) {
      return res.status(400).json({
        success: false,
        message: `Code too long. Maximum ${maxCodeLength} characters allowed.`,
      });
    }

    // Perform security analysis
    const result = await analyzeCode(code, language || 'auto', {
      fileName: fileName || 'untitled',
      userId: req.user?._id?.toString(),
    });

    // Store audit log in database
    try {
      const auditLog = new SecurityAudit({
        userId: req.user?._id,
        action: 'security_scan',
        resource: 'code_analysis',
        status: 'completed',
        fileName: fileName || 'untitled',
        language: language || 'auto',
        securityScore: result.score,
        issueCount: result.totalIssues,
        severity: result.severity,
        details: {
          summary: result.summary,
          issueTypes: result.issues.map((i) => i.type),
          recommendations: result.recommendations,
        },
        ip: req.ip,
        userAgent: req.headers['user-agent'] || '',
      });
      await auditLog.save();

      // Also log via ArmorIQ service
      await logSecurityScan({
        resource: 'code_analysis',
        status: 'completed',
        details: {
          auditId: auditLog._id.toString(),
          language,
          codeLength: code.length,
          score: result.score,
          issueCount: result.totalIssues,
        },
        userId: req.user?._id?.toString(),
      });
    } catch (logError) {
      console.error('[SECURITY_CONTROLLER] Failed to save audit log:', logError.message);
      // Don't fail the request if audit logging fails
    }

    res.json({
      success: true,
      data: {
        score: result.score,
        severity: result.severity,
        summary: result.summary,
        issues: result.issues,
        recommendations: result.recommendations,
        totalIssues: result.totalIssues,
      },
    });
  } catch (error) {
    console.error('[SECURITY_CONTROLLER] Analysis error:', error.message);

    // Log failure
    try {
      await createAuditEntry({
        action: 'security_scan',
        resource: 'code_analysis',
        status: 'failed',
        details: {
          language,
          codeLength: req.body?.code?.length || 0,
          error: error.message,
        },
        userId: req.user?._id?.toString(),
      });
    } catch (logError) {
      // Ignore audit log failures
    }

    next(error);
  }
};

/**
 * GET /api/security/audit-logs
 * 
 * Retrieves recent security audit logs for the current user.
 */
exports.getAuditLogs = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const action = req.query.action;
    const severity = req.query.severity;

    const filter = { userId: req.user._id };
    if (action) filter.action = action;
    if (severity) filter.severity = severity;

    const logs = await SecurityAudit.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('-__v');

    res.json({
      success: true,
      data: logs,
      total: logs.length,
    });
  } catch (error) {
    next(error);
  }
};
