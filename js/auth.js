// ============================================================
// auth.js – Multi-role session with Remember Me
// ============================================================

const Auth = (() => {
  const TOKEN_KEY       = 'att_token';
  const USER_KEY        = 'att_user';
  const ROLE_KEY        = 'att_role';
  const COURSES_KEY     = 'att_courses';
  const DASHBOARD_KEY   = 'att_dashboard';
  const LOGIN_TIME_KEY  = 'att_login_time';
  const REMEMBER_KEY    = 'att_remember';
  const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;

  function _store() {
    return localStorage.getItem(REMEMBER_KEY) === 'true' ? localStorage : sessionStorage;
  }

  function isLoggedIn() {
    var store = _store();
    if (!store.getItem(TOKEN_KEY)) {
      // Also check the other store in case remember changed
      var other = store === localStorage ? sessionStorage : localStorage;
      if (!other.getItem(TOKEN_KEY)) return false;
    }
    var loginTime = Number(_store().getItem(LOGIN_TIME_KEY) || localStorage.getItem(LOGIN_TIME_KEY) || 0);
    if (loginTime && Date.now() - loginTime > SESSION_TIMEOUT_MS) {
      clearSession();
      return false;
    }
    return true;
  }

  function getRole() {
    return _store().getItem(ROLE_KEY) || localStorage.getItem(ROLE_KEY) || '';
  }

  function getUser() {
    try {
      return JSON.parse(_store().getItem(USER_KEY) || localStorage.getItem(USER_KEY));
    } catch { return null; }
  }

  // Legacy alias
  function getFaculty() { return getUser(); }

  function getToken() {
    return _store().getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || '';
  }

  function getCachedCourses() {
    try {
      return JSON.parse(_store().getItem(COURSES_KEY) || localStorage.getItem(COURSES_KEY) || '[]');
    } catch { return []; }
  }

  function getCachedDashboard() {
    try {
      return JSON.parse(_store().getItem(DASHBOARD_KEY) || localStorage.getItem(DASHBOARD_KEY));
    } catch { return null; }
  }

  /**
   * Saves session data after a successful login.
   */
  function saveSession(result, rememberMe) {
    // Set remember preference first
    localStorage.setItem(REMEMBER_KEY, rememberMe ? 'true' : 'false');
    var store = rememberMe ? localStorage : sessionStorage;

    store.setItem(TOKEN_KEY, result.token);
    store.setItem(ROLE_KEY, result.role);
    store.setItem(LOGIN_TIME_KEY, String(Date.now()));

    // Store user info (faculty or student)
    var user = result.faculty || result.student || {};
    store.setItem(USER_KEY, JSON.stringify(user));

    if (result.courses) store.setItem(COURSES_KEY, JSON.stringify(result.courses));
    if (result.dashboardStats) store.setItem(DASHBOARD_KEY, JSON.stringify(result.dashboardStats));
    if (result.attendanceData) store.setItem(DASHBOARD_KEY, JSON.stringify(result.attendanceData));
  }

  async function logout() {
    try { await API.logout(); } catch (e) { /* ignore */ }
    clearSession();
  }

  function clearSession() {
    [localStorage, sessionStorage].forEach(function(s) {
      s.removeItem(TOKEN_KEY);
      s.removeItem(USER_KEY);
      s.removeItem(ROLE_KEY);
      s.removeItem(COURSES_KEY);
      s.removeItem(DASHBOARD_KEY);
      s.removeItem(LOGIN_TIME_KEY);
    });
  }

  async function validateSession() {
    if (!isLoggedIn()) return false;
    var loginTime = Number(_store().getItem(LOGIN_TIME_KEY) || localStorage.getItem(LOGIN_TIME_KEY) || 0);
    if (Date.now() - loginTime < 30 * 60 * 1000) return true;
    var result = await API.validate();
    if (!result.valid) { clearSession(); return false; }
    return true;
  }

  function invalidateDashboardCache() {
    _store().removeItem(DASHBOARD_KEY);
    localStorage.removeItem(DASHBOARD_KEY);
  }

  return {
    isLoggedIn, getRole, getUser, getFaculty, getToken,
    getCachedCourses, getCachedDashboard,
    saveSession, logout, validateSession, invalidateDashboardCache
  };
})();
