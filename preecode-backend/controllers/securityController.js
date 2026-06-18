const { analyzeCode } = require('../services/armorclawService');
const { logSecurityScan, createAuditEntry, evaluatePolicy, reportSecurityEvent } = require('../services/armoriqService');
const SecurityAudit = require('../models/SecurityAudit');
const AiSecurityAudit = require('../models/AiSecurityAudit');

/**
 * POST /api/security/analyze
 * 
 * Full ArmorIQ-integrated Security Analyze workflow (exact 6-step spec):
 *   Step 1: User clicks Security Analyze (handled by extension)
 *   Step 2: Security findings are generated (AI analysis via ArmorClaw)
 *   Step 3: Findings are sent to ArmorIQ (capturePlan + getIntentToken + invoke)
 *   Step 4: ArmorIQ policy evaluation runs (evaluatePolicy via getIntentToken with policy)
 *   Step 5: Audit log entry is created (database + ArmorIQ audit)
 *   Step 6: Response is returned to Preecode
 */
exports.analyzeCode = async (req, res, next) => {
  const { code, fileName, language } = req.body;
  const userId = req.user?._id?.toString();
  const startTime = Date.now();

  try {
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

    // ============================================================================
    // STEP 2: Generate security findings via ArmorClaw AI analysis
    // ============================================================================
    console.log('[Security] Step 2: Generating security findings via ArmorClaw AI...');
    const result = await analyzeCode(code, language || 'auto', {
      fileName: fileName || 'untitled',
      userId,
    });

    const elapsed = Date.now() - startTime;
    console.log(`[Security] Analysis complete — Score: ${result.score}/100, Issues: ${result.totalIssues}, Severity: ${result.severity} (${elapsed}ms)`);

    const context = {
      code,
      language: language || 'auto',
      metadata: { fileName: fileName || 'untitled', userId, score: result.score, issueCount: result.totalIssues },
    };

    // ============================================================================
    // STEP 3: Send findings to ArmorIQ via capturePlan + getIntentToken + invoke
    // ============================================================================
    let armoriqAuditResult = null;
    try {
      console.log('[ArmorIQ] Step 3: Sending findings to ArmorIQ...');
      armoriqAuditResult = await logSecurityScan({
        // The logSecurityScan function internally uses:
        //   1. capturePlan() to capture the security scan intent
        //   2. getIntentToken() to get signed token (with "security-scan-policy")
        //   3. verifyIntentToken() automatically verifies the token
        //   4. invoke() to send the audit record to ArmorIQ backend
        resource: 'code_analysis',
        status: 'completed',
        details: {
          language,
          codeLength: code.length,
          score: result.score,
          issueCount: result.totalIssues,
          severity: result.severity,
          analysisTimeMs: elapsed,
          findings: result.issues.map((i) => ({
            type: i.type,
            severity: i.severity,
            title: i.title,
          })),
        },
        userId,
      });
      console.log('[ArmorIQ] Step 3 complete — Findings sent to ArmorIQ');
    } catch (armoriqError) {
      console.error('[ArmorIQ] Step 3 failed (non-fatal):', armoriqError.message);
    }

    // ============================================================================
    // STEP 4: ArmorIQ policy evaluation runs
    // ============================================================================
    const defaultPolicyResult = { passed: true, policyName: 'no-hardcoded-secrets', message: 'Policy evaluation skipped (see details).', details: {} };
    let policyResult = defaultPolicyResult;
    let policyEvaluated = false;
    try {
      console.log('[ArmorIQ] Policy Check Started — Evaluating ArmorIQ policies...');
      policyResult = await evaluatePolicy('no-hardcoded-secrets', context);
      policyEvaluated = policyResult !== defaultPolicyResult;
      console.log('[ArmorIQ] Policy Result —', JSON.stringify(policyResult));
      console.log('[ArmorIQ] Step 4 complete — Policy evaluation finished');
    } catch (policyError) {
      console.error('[ArmorIQ] Policy evaluation failed (non-fatal):', policyError.message);
    }

    // ============================================================================
    // STEP 5: Audit log entry created (database + ArmorIQ audit)
    // ============================================================================
    let auditLog = null;
    try {
      console.log('[ArmorIQ] Step 5: Creating audit log entries...');

      // 5a. Save to MongoDB SecurityAudit collection
      auditLog = new SecurityAudit({
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
          armoriqAudited: !!armoriqAuditResult,
          armoriqTokenId: armoriqAuditResult?.armoriqTokenId || null,
          policyCheck: policyResult,
        },
        ip: req.ip,
        userAgent: req.headers['user-agent'] || '',
      });
      await auditLog.save();
      console.log('[ArmorIQ] Audit Log Created — Database audit saved:', auditLog._id.toString());

      // 5b. Also create an independent ArmorIQ audit entry
      await createAuditEntry({
        action: 'security_scan',
        resource: 'code_analysis',
        status: 'completed',
        details: {
          databaseAuditId: auditLog._id.toString(),
          score: result.score,
          issueCount: result.totalIssues,
          severity: result.severity,
          analysisTimeMs: elapsed,
          policyPassed: policyResult.passed,
        },
        userId,
      }).catch((e) => console.error('[ArmorIQ] Additional audit entry failed:', e.message));

    } catch (logError) {
      console.error('[SECURITY_CONTROLLER] Failed to save audit log:', logError.message);
      // Don't fail the request if audit logging fails
    }

    // ============================================================================
    // STEP 5b: Report security event if significant issues found
    // ============================================================================
    if (result.totalIssues > 0 && result.score < 70) {
      try {
        const eventResult = await reportSecurityEvent('security_vulnerability_found', {
          score: result.score,
          severity: result.severity,
          issueCount: result.totalIssues,
          issueTypes: result.issues.map((i) => i.type),
          fileName: fileName || 'untitled',
          language: language || 'auto',
          userId,
        });
        console.log('[ArmorIQ] Event Synced — Security vulnerability event:', eventResult.id || 'synced');
      } catch (eventError) {
        console.error('[ArmorIQ] Failed to sync security event:', eventError.message);
      }
    }

    // ============================================================================
    // STEP 6: Response is returned to Preecode
    // ============================================================================
    console.log('[Security] Step 6: Returning response to Preecode extension');
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
      meta: {
        analysisTimeMs: elapsed,
        steps: {
          findingsGenerated: true,
          findingsSentToArmorIQ: !!armoriqAuditResult,
          policyEvaluated,
          auditLogged: !!auditLog,
          armoriqEventSynced: result.totalIssues > 0 && result.score < 70,
        },
        armoriq: {
          tokenId: armoriqAuditResult?.armoriqTokenId || null,
          policyChecked: policyResult.passed,
          policyName: policyResult.policyName,
        },
        databaseAuditId: auditLog?._id?.toString() || null,
      },
    });
  } catch (error) {
    console.error('[SECURITY_CONTROLLER] Analysis error:', error.message);
    const elapsed = Date.now() - startTime;

    // Log failure to ArmorIQ
    try {
      await createAuditEntry({
        action: 'security_scan',
        resource: 'code_analysis',
        status: 'failed',
        details: {
          language,
          codeLength: req.body?.code?.length || 0,
          error: error.message,
          analysisTimeMs: elapsed,
        },
        userId,
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

/**
 * POST /api/security/ai-audit
 * 
 * Saves a security audit log for AI-generated code
 */
exports.createAiAuditLog = async (req, res, next) => {
  try {
    const { timestamp, prompt, generatedCode, securityIssues, securityScore, riskLevel, policyAction, armorIQStatus } = req.body;
    const userId = req.user?._id;

    const audit = new AiSecurityAudit({
      userId,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      prompt: prompt || '',
      generatedCode: generatedCode || '',
      securityIssues: Array.isArray(securityIssues) ? securityIssues : [],
      securityScore: typeof securityScore === 'number' ? securityScore : 100,
      riskLevel: riskLevel || 'low',
      policyAction: policyAction || 'Allow',
      armorIQStatus: armorIQStatus || 'Disconnected'
    });

    await audit.save();

    res.status(201).json({
      success: true,
      data: audit
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/security/ai-audit-logs
 * 
 * Retrieves recent AI security audit logs for the current user
 */
exports.getAiAuditLogs = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const filter = { userId: req.user._id };

    const logs = await AiSecurityAudit.find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .select('-__v');

    res.json({
      success: true,
      data: logs,
      total: logs.length
    });
  } catch (error) {
    next(error);
  }
};
