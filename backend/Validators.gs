// ============================================================
// Validators.gs – Input validation & sanitisation
// ============================================================

/** Check required fields */
function validateRequired(obj, keys) {
  for (const key of keys) {
    if (obj[key] === undefined || obj[key] === null || String(obj[key]).trim() === '') {
      return { valid: false, missing: key };
    }
  }
  return { valid: true };
}

/** Enum check */
function validateEnum(value, allowed, fieldName) {
  if (!allowed.includes(value)) {
    return { valid: false, error: fieldName + ' must be one of: ' + allowed.join(', ') };
  }
  return { valid: true };
}

/** Validate attendance status */
function validateStatus(status) {
  return validateEnum(status, STATUS_ENUM, 'Status');
}

/** Email format check */
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/** Trim & strip script tags */
function sanitize(str) {
  if (typeof str !== 'string') return String(str || '');
  return str.trim().replace(/<script[^>]*>.*?<\/script>/gi, '');
}