// ============================================================
// Auth.gs – Multi-role authentication (Faculty, Student, Admin)
// ============================================================

/**
 * Finds a user across all master sheets by email or phone.
 * Used after Firebase auth to identify role + sheet record.
 */
function findUserByIdentifier(email, phone) {
  email = email ? String(email).toLowerCase().trim() : '';
  phone = phone ? String(phone).trim().replace(/\s/g, '') : '';

  if (!email && !phone) {
    return { success: false, error: 'Email or phone is required' };
  }

  // ── Check Admin_Master first ─────────────────────────────
  try {
    var adminSheet = getSheet_(SHEETS.ADMIN);
    var adminData = adminSheet.getDataRange().getValues();
    for (var a = 1; a < adminData.length; a++) {
      var aRow = adminData[a];
      var aEmail = String(aRow[COL_ADMIN.EMAIL - 1] || '').toLowerCase().trim();
      var aPhone = String(aRow[COL_ADMIN.PHONE - 1] || '').trim().replace(/\s/g, '');
      if ((email && aEmail === email) || (phone && aPhone === phone)) {
        return {
          success: true, role: 'admin',
          user: { id: String(aRow[COL_ADMIN.ID - 1]).trim(), name: String(aRow[COL_ADMIN.NAME - 1]).trim(), department: String(aRow[COL_ADMIN.DEPT - 1]).trim(), email: aEmail, phone: aPhone }
        };
      }
    }
  } catch (e) { /* Admin sheet may not exist */ }

  // ── Check Faculty_Master ─────────────────────────────────
  try {
    var facSheet = getSheet_(SHEETS.FACULTY);
    var facData = facSheet.getDataRange().getValues();
    for (var f = 1; f < facData.length; f++) {
      var fRow = facData[f];
      var fEmail = String(fRow[COL_FACULTY.EMAIL - 1] || '').toLowerCase().trim();
      var fPhone = String(fRow[COL_FACULTY.PHONE - 1] || '').trim().replace(/\s/g, '');
      if ((email && fEmail === email) || (phone && fPhone === phone)) {
        var facID = String(fRow[COL_FACULTY.ID - 1]).trim();
        // Bundle courses + dashboard
        var courses = [];
        try { var cr = getCoursesByFaculty(facID); courses = cr.success ? cr.data : []; } catch (e) {}
        var dash = null;
        try { dash = getDashboardStats(facID); } catch (e) {}
        return {
          success: true, role: 'faculty',
          user: { id: facID, name: String(fRow[COL_FACULTY.NAME - 1]).trim(), department: String(fRow[COL_FACULTY.DEPT - 1]).trim(), email: fEmail, phone: fPhone },
          courses: courses, dashboardStats: dash
        };
      }
    }
  } catch (e) { /* Faculty sheet error */ }

  // ── Check Student_Master ─────────────────────────────────
  try {
    var stuSheet = getSheet_(SHEETS.STUDENTS);
    var stuData = stuSheet.getDataRange().getValues();
    for (var s = 1; s < stuData.length; s++) {
      var sRow = stuData[s];
      var sPhone = String(sRow[COL_STUDENT.PHONE - 1] || '').trim().replace(/\s/g, '');
      if (phone && sPhone === phone) {
        var stuID = String(sRow[COL_STUDENT.ID - 1]).trim();
        var attData = null;
        try { attData = getStudentOwnAttendance(stuID); } catch (e) {}
        return {
          success: true, role: 'student',
          user: { id: stuID, name: String(sRow[COL_STUDENT.NAME - 1]).trim(), department: String(sRow[COL_STUDENT.DEPT - 1]).trim(), year: String(sRow[COL_STUDENT.YEAR - 1]).trim(), section: String(sRow[COL_STUDENT.SECTION - 1]).trim(), phone: sPhone },
          attendanceData: attData
        };
      }
    }
  } catch (e) { /* Student sheet error */ }

  return { success: false, error: 'No account found. Please contact your administrator.' };
}

/**
 * Faculty Login – validates email + password (password = Faculty_ID).
 * Returns faculty info + their courses + dashboard stats.
 */
function login(email, password) {
  if (!email || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  email = sanitize(email).toLowerCase();
  password = sanitize(password).trim();

  // ── Rate limiting ────────────────────────────────────────
  var cache = CacheService.getScriptCache();
  var rateLimitKey = 'RATE_' + email;
  var attempts = Number(cache.get(rateLimitKey) || 0);
  if (attempts >= 5) {
    return { success: false, error: 'Too many login attempts. Please wait 1 minute.' };
  }

  // ── Find faculty ─────────────────────────────────────────
  var faculty = findFacultyByEmail_(email);

  if (!faculty || faculty.id !== password) {
    cache.put(rateLimitKey, String(attempts + 1), 60);
    logAudit('LOGIN_FAILED', email, 'Invalid credentials');
    return { success: false, error: 'Invalid email or password' };
  }

  // ── Generate session ─────────────────────────────────────
  var token = generateToken_(email);
  storeSession_(token, {
    facultyID:   faculty.id,
    facultyName: faculty.name,
    email:       email,
    department:  faculty.department,
    role:        'faculty',
    createdAt:   Date.now()
  });

  // ── Bundle courses + dashboard ───────────────────────────
  var courses = [];
  var dashboardStats = null;
  try {
    var courseResult = getCoursesByFaculty(faculty.id);
    courses = courseResult.success ? courseResult.data : [];
  } catch (e) { courses = []; }

  try {
    dashboardStats = getDashboardStats(faculty.id);
  } catch (e) { dashboardStats = null; }

  cache.remove(rateLimitKey);
  logAudit('LOGIN', faculty.id, 'Successful faculty login');

  return {
    success: true,
    token:   token,
    role:    'faculty',
    faculty: {
      id:         faculty.id,
      name:       faculty.name,
      email:      email,
      department: faculty.department
    },
    courses:        courses,
    dashboardStats: dashboardStats
  };
}

/**
 * Student Login – validates Student_ID as both username and password.
 */
function loginStudent(studentID, password) {
  if (!studentID || !password) {
    return { success: false, error: 'Student ID and password are required' };
  }

  studentID = sanitize(studentID).trim();
  password  = sanitize(password).trim();

  // ── Rate limiting ────────────────────────────────────────
  var cache = CacheService.getScriptCache();
  var rateLimitKey = 'RATE_STU_' + studentID;
  var attempts = Number(cache.get(rateLimitKey) || 0);
  if (attempts >= 5) {
    return { success: false, error: 'Too many login attempts. Please wait 1 minute.' };
  }

  // ── Find student ─────────────────────────────────────────
  var student = findStudentByID_(studentID);

  if (!student || student.id !== password) {
    cache.put(rateLimitKey, String(attempts + 1), 60);
    logAudit('LOGIN_FAILED', studentID, 'Invalid student credentials');
    return { success: false, error: 'Invalid Student ID or password' };
  }

  // ── Generate session ─────────────────────────────────────
  var token = generateToken_(studentID);
  storeSession_(token, {
    studentID:   student.id,
    studentName: student.name,
    department:  student.department,
    year:        student.year,
    section:     student.section,
    role:        'student',
    createdAt:   Date.now()
  });

  // ── Bundle student attendance data ───────────────────────
  var attendanceData = null;
  try {
    attendanceData = getStudentOwnAttendance(student.id);
  } catch (e) { attendanceData = null; }

  cache.remove(rateLimitKey);
  logAudit('LOGIN', studentID, 'Successful student login');

  return {
    success: true,
    token:   token,
    role:    'student',
    student: {
      id:         student.id,
      name:       student.name,
      department: student.department,
      year:       student.year,
      section:    student.section
    },
    attendanceData: attendanceData
  };
}

/**
 * Admin Login – validates against Admin_Master sheet.
 * Password = Admin_ID (same pattern as faculty).
 */
function loginAdmin(email, password) {
  if (!email || !password) {
    return { success: false, error: 'Email and password are required' };
  }

  email = sanitize(email).toLowerCase();
  password = sanitize(password).trim();

  // ── Find admin in Admin_Master sheet ──────────────────────
  var admin = findAdminByEmail_(email);
  if (!admin) {
    return { success: false, error: 'This account does not have admin access' };
  }

  if (admin.id !== password) {
    logAudit('LOGIN_FAILED', email, 'Invalid admin credentials');
    return { success: false, error: 'Invalid email or password' };
  }

  var token = generateToken_(email + '_admin');
  storeSession_(token, {
    adminID:     admin.id,
    adminName:   admin.name,
    email:       email,
    department:  admin.department,
    role:        'admin',
    createdAt:   Date.now()
  });

  logAudit('LOGIN', admin.id, 'Successful admin login');

  return {
    success: true,
    token:   token,
    role:    'admin',
    faculty: {
      id:         admin.id,
      name:       admin.name,
      email:      email,
      department: admin.department
    }
  };
}

/**
 * Validates a session token. Returns role info.
 */
function validateToken(token) {
  if (!token) return { valid: false };

  var props = PropertiesService.getScriptProperties();
  var json  = props.getProperty('SESSION_' + token);
  if (!json) return { valid: false };

  var session;
  try { session = JSON.parse(json); } catch (e) {
    props.deleteProperty('SESSION_' + token);
    return { valid: false };
  }

  var timeout = DEFAULTS.SESSION_TIMEOUT_SEC * 1000;
  if (Date.now() - session.createdAt > timeout) {
    props.deleteProperty('SESSION_' + token);
    return { valid: false, error: 'Session expired' };
  }

  return {
    valid:       true,
    role:        session.role || 'faculty',
    facultyID:   session.facultyID || '',
    facultyName: session.facultyName || '',
    studentID:   session.studentID || '',
    studentName: session.studentName || '',
    email:       session.email || '',
    department:  session.department || ''
  };
}

/**
 * Logout – removes session.
 */
function logout(token) {
  if (token) {
    PropertiesService.getScriptProperties().deleteProperty('SESSION_' + token);
  }
  return { success: true };
}

// ── Private Helpers ─────────────────────────────────────────

function findFacultyByEmail_(email) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'FAC_' + email;
  var cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) { /* fall through */ }
  }

  var sheet = getSheet_(SHEETS.FACULTY);
  var data  = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var row      = data[i];
    var rowEmail = String(row[COL_FACULTY.EMAIL - 1]).toLowerCase().trim();
    var facID    = String(row[COL_FACULTY.ID - 1]).trim();
    var facName  = String(row[COL_FACULTY.NAME - 1]).trim();
    var facDept  = String(row[COL_FACULTY.DEPT - 1]).trim();

    if (rowEmail === email) {
      var faculty = { id: facID, name: facName, department: facDept, email: rowEmail };
      cache.put(cacheKey, JSON.stringify(faculty), 600);
      return faculty;
    }
  }
  return null;
}

function findAdminByEmail_(email) {
  var sheet = getSheet_(SHEETS.ADMIN);
  var data  = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var row      = data[i];
    var rowEmail = String(row[COL_ADMIN.EMAIL - 1]).toLowerCase().trim();
    if (rowEmail === email) {
      return {
        id:         String(row[COL_ADMIN.ID - 1]).trim(),
        name:       String(row[COL_ADMIN.NAME - 1]).trim(),
        department: String(row[COL_ADMIN.DEPT - 1]).trim(),
        email:      rowEmail
      };
    }
  }
  return null;
}

function findStudentByID_(studentID) {
  var sheet = getSheet_(SHEETS.STUDENTS);
  var data  = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var id  = String(row[COL_STUDENT.ID - 1]).trim();
    if (id === studentID) {
      return {
        id:         id,
        name:       String(row[COL_STUDENT.NAME - 1]).trim(),
        department: String(row[COL_STUDENT.DEPT - 1]).trim(),
        year:       String(row[COL_STUDENT.YEAR - 1]).trim(),
        section:    String(row[COL_STUDENT.SECTION - 1]).trim()
      };
    }
  }
  return null;
}

function generateToken_(seed) {
  var raw = seed + '_' + Date.now() + '_' + Math.random();
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw)
    .map(function(b) { return ('0' + (b & 0xFF).toString(16)).slice(-2); })
    .join('');
}

function storeSession_(token, data) {
  PropertiesService.getScriptProperties()
    .setProperty('SESSION_' + token, JSON.stringify(data));
}
