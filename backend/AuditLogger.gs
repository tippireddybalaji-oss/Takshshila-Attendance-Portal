// ============================================================
// AuditLogger.gs – Audit trail
// ============================================================

/**
 * Appends an audit entry. Creates the Audit_Log tab if missing.
 */
function logAudit(action, userID, details) {
  try {
    const sheet = ensureAuditSheet_();
    sheet.appendRow([
      new Date().toISOString(),
      action,
      userID || 'SYSTEM',
      sanitize(String(details))
    ]);
  } catch (err) {
    Logger.log('AuditLogger error: ' + err.message);
  }
}
