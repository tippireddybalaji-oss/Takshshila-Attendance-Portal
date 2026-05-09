// ============================================================
// api.js – API client (Multi-Role)
// ============================================================

const API = (() => {
  const BASE_URL = 'https://script.google.com/macros/s/AKfycbzQtf7vOFm5TjmxJ500Bgk9EBWNdVXVJYIIYlmHRjd8ZXMmg3xo3XBZtz5X8_fWwKRl/exec';

  async function request(action, params = {}) {
    const url = new URL(BASE_URL);
    url.searchParams.set('action', action);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error('Network error: ' + res.status);
    return res.json();
  }

  async function mutate(action, data) {
    const payload = JSON.stringify({ action, ...data });
    const url = BASE_URL + '?action=' + action + '&payload=' + encodeURIComponent(payload);
    const res = await fetch(url);
    if (!res.ok) throw new Error('Network error: ' + res.status);
    return res.json();
  }

  return {
    // ── Auth ──
    login:        (email, password) => mutate('login', { email, password }),
    loginStudent: (studentID, password) => mutate('loginStudent', { studentID, password }),
    loginAdmin:   (email, password) => mutate('loginAdmin', { email, password }),
    logout:       () => mutate('logout', { token: Auth.getToken() }),
    validate:     () => request('validateSession', { token: Auth.getToken() }),

    // ── Faculty data ──
    getCoursesByFaculty: (facultyID) => request('getCoursesByFaculty', { facultyID }),
    getDashboardStats:   (facultyID) => request('getDashboardStats', { facultyID }),
    getStudentsByCourse: (courseCode) => request('getStudentsByCourse', { courseCode }),
    getAttendance:       (params)    => request('getAttendance', params),
    getCourseReport:     (courseCode, startDate, endDate) => request('getCourseReport', { courseCode, startDate, endDate }),

    // ── Mutations ──
    markAttendance:     (data) => mutate('markAttendance', { ...data, token: Auth.getToken() }),
    markBulkAttendance: (courseCode, records) => mutate('markBulkAttendance', { courseCode, records, token: Auth.getToken() }),

    // ── Student self-service ──
    getMyAttendance: (studentID) => request('getMyAttendance', { studentID }),

    // ── Admin ──
    getAdminOverview: () => request('getAdminOverview'),

    // ── Edit Requests ──
    submitEditRequest:  (data) => mutate('submitEditRequest', { ...data, token: Auth.getToken() }),
    getMyEditRequests:  (facultyID) => request('getMyEditRequests', { facultyID }),
    getEditRequests:    (filter) => request('getEditRequests', { filter }),
    approveEditRequest: (requestID) => mutate('approveEditRequest', { requestID, token: Auth.getToken() }),
    denyEditRequest:    (requestID, denyReason) => mutate('denyEditRequest', { requestID, denyReason, token: Auth.getToken() }),
    getRecordsByDateCourse: (date, course, facultyID) => request('getRecordsByDateCourse', { date, course, facultyID }),

    // ── Honor Scores ──
    getHonorScores: () => request('getHonorScores'),
    getHonorScore:  (facultyID) => request('getHonorScore', { facultyID }),

    // ── Firebase Auth – user lookup ──
    findUser: (email, phone) => request('findUser', { email, phone }),
  };
})();
