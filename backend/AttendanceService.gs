// ============================================================
// AttendanceService.gs – Mark, query, update attendance
// Matches Attendance_Records: Date | Course | StudentID | FacultyID | Status
// ============================================================

/**
 * Checks if attendance is already marked for a student+course+date.
 */
function isDuplicate_(records, studentID, course, dateStr) {
  // Extract just the code part for comparison (handles "U24CEB472 - OS" format)
  var courseCodeOnly = course.indexOf(' - ') > 0
    ? course.substring(0, course.indexOf(' - ')).trim()
    : course;

  for (let i = 1; i < records.length; i++) {
    const r = records[i];
    const existingDate = new Date(r[COL_ATTEND.DATE - 1]).toDateString();
    var existingCourse = String(r[COL_ATTEND.COURSE - 1]).trim();
    var existingCode = existingCourse.indexOf(' - ') > 0
      ? existingCourse.substring(0, existingCourse.indexOf(' - ')).trim()
      : existingCourse;

    if (String(r[COL_ATTEND.STUDENT_ID - 1]).trim() === studentID &&
        existingCode === courseCodeOnly &&
        existingDate === dateStr) {
      return true;
    }
  }
  return false;
}

/**
 * Marks a single attendance record.
 */
function markAttendance(courseCode, studentID, status, facultyID) {
  // ── Validate ──
  const req = validateRequired({ courseCode, studentID, status }, ['courseCode', 'studentID', 'status']);
  if (!req.valid) return { success: false, error: 'Missing field: ' + req.missing };

  const sv = validateStatus(status);
  if (!sv.valid) return { success: false, error: sv.error };

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Validate student exists
  const students = ss.getSheetByName(SHEETS.STUDENTS).getDataRange().getValues();
  let studentExists = false;
  for (let i = 1; i < students.length; i++) {
    if (String(students[i][0]).trim() === String(studentID).trim()) {
      studentExists = true;
      break;
    }
  }
  if (!studentExists) return { success: false, error: 'Invalid Student ID' };

  // Validate course exists & get faculty + course name
  const subjects = ss.getSheetByName(SHEETS.SUBJECTS).getDataRange().getValues();
  let courseExists = false;
  let resolvedFaculty = facultyID || '';
  let courseName = '';
  for (let i = 1; i < subjects.length; i++) {
    if (String(subjects[i][0]).trim() === String(courseCode).trim()) {
      courseExists = true;
      courseName = String(subjects[i][COL_SUBJECT.NAME - 1]).trim();
      if (!resolvedFaculty) resolvedFaculty = String(subjects[i][COL_SUBJECT.FACULTY_ID - 1]);
      break;
    }
  }
  if (!courseExists) return { success: false, error: 'Invalid Course Code' };

  // Build display name: "U24CEB472 - Operating System (OS)"
  var courseDisplay = courseName ? (courseCode + ' - ' + courseName) : courseCode;

  // Duplicate check (match on code part only)
  const recordSheet = ss.getSheetByName(SHEETS.ATTENDANCE);
  const records = recordSheet.getDataRange().getValues();
  const today = new Date();
  const todayStr = today.toDateString();

  if (isDuplicate_(records, String(studentID).trim(), String(courseCode).trim(), todayStr)) {
    return { success: false, error: 'Attendance already marked today for this student' };
  }

  // ── Insert with full course name ──
  recordSheet.appendRow([
    today,
    courseDisplay,
    studentID,
    resolvedFaculty,
    status
  ]);

  logAudit('MARK_ATTENDANCE', resolvedFaculty, studentID + ' → ' + status + ' for ' + courseCode);
  return { success: true, message: 'Attendance recorded' };
}

/**
 * Marks attendance in bulk for a class.
 * @param {string} courseCode
 * @param {Array<{studentID, status}>} records
 * @param {string} facultyID
 */
function markBulkAttendance(courseCode, records, facultyID) {
  if (!courseCode) return { success: false, error: 'Course code is required' };
  if (!Array.isArray(records) || records.length === 0) {
    return { success: false, error: 'Records array is required' };
  }
  if (records.length > DEFAULTS.MAX_BULK_SIZE) {
    return { success: false, error: 'Maximum ' + DEFAULTS.MAX_BULK_SIZE + ' records per batch' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const recordSheet = ss.getSheetByName(SHEETS.ATTENDANCE);
  const existing    = recordSheet.getDataRange().getValues();
  const today       = new Date();
  const todayStr    = today.toDateString();

  // Resolve faculty + course name from Subjects_Master
  let resolvedFaculty = facultyID || '';
  let courseName = '';
  var subjects = ss.getSheetByName(SHEETS.SUBJECTS).getDataRange().getValues();
  for (let i = 1; i < subjects.length; i++) {
    if (String(subjects[i][0]).trim() === String(courseCode).trim()) {
      courseName = String(subjects[i][COL_SUBJECT.NAME - 1]).trim();
      if (!resolvedFaculty) resolvedFaculty = String(subjects[i][COL_SUBJECT.FACULTY_ID - 1]);
      break;
    }
  }

  // Build display name: "U24CEB472 - Operating System (OS)"
  var courseDisplay = courseName ? (courseCode + ' - ' + courseName) : courseCode;

  const rows   = [];
  const errors = [];

  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    const sv = validateStatus(r.status || 'Present');
    if (!sv.valid) { errors.push('Row ' + (i+1) + ': ' + sv.error); continue; }
    if (!r.studentID) { errors.push('Row ' + (i+1) + ': Missing studentID'); continue; }

    if (isDuplicate_(existing, String(r.studentID).trim(), String(courseCode).trim(), todayStr)) {
      errors.push('Row ' + (i+1) + ': ' + r.studentID + ' already marked');
      continue;
    }

    rows.push([today, courseDisplay, r.studentID, resolvedFaculty, r.status || 'Present']);
  }

  // Batch write
  if (rows.length > 0) {
    const startRow = recordSheet.getLastRow() + 1;
    recordSheet.getRange(startRow, 1, rows.length, 5).setValues(rows);
  }

  // Rebuild summaries after bulk insert
  rebuildAttendanceSummaries();

  logAudit('BULK_ATTENDANCE', resolvedFaculty, rows.length + ' records for ' + courseCode);

  return {
    success:  true,
    inserted: rows.length,
    skipped:  errors.length,
    errors:   errors,
    message:  rows.length + ' records inserted' + (errors.length ? ', ' + errors.length + ' skipped' : '')
  };
}

/**
 * Updates an attendance record's status.
 */
function updateAttendanceRecord(rowIndex, newStatus, userID) {
  if (!rowIndex || !newStatus) {
    return { success: false, error: 'Row index and new status are required' };
  }
  const sv = validateStatus(newStatus);
  if (!sv.valid) return { success: false, error: sv.error };

  const sheet = getSheet_(SHEETS.ATTENDANCE);
  const row = parseInt(rowIndex);

  // Lock check
  const timestamp = sheet.getRange(row, COL_ATTEND.DATE).getValue();
  const hoursDiff = (Date.now() - new Date(timestamp).getTime()) / (1000 * 60 * 60);
  if (hoursDiff > DEFAULTS.ATTENDANCE_LOCK_HRS) {
    return { success: false, error: 'Cannot modify attendance older than ' + DEFAULTS.ATTENDANCE_LOCK_HRS + ' hours' };
  }

  sheet.getRange(row, COL_ATTEND.STATUS).setValue(newStatus);
  logAudit('UPDATE_ATTENDANCE', userID, 'Row ' + row + ' → ' + newStatus);

  // Rebuild summaries
  rebuildAttendanceSummaries();

  return { success: true, message: 'Attendance updated' };
}

/**
 * Retrieves attendance with optional filters.
 */
function getAttendanceRecords(params) {
  const sheet = getSheet_(SHEETS.ATTENDANCE);
  const data  = sheet.getDataRange().getValues();
  const results = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const dateStr = formatDate_(row[COL_ATTEND.DATE - 1]);

    const record = {
      rowIndex:   i + 1,
      date:       dateStr,
      courseCode:  String(row[COL_ATTEND.COURSE - 1]),
      studentID:  String(row[COL_ATTEND.STUDENT_ID - 1]),
      facultyID:  String(row[COL_ATTEND.FACULTY_ID - 1]),
      status:     String(row[COL_ATTEND.STATUS - 1])
    };

    if (params.courseCode && record.courseCode !== params.courseCode) continue;
    if (params.studentID && record.studentID !== params.studentID) continue;
    if (params.date && dateStr !== params.date) continue;
    if (params.startDate && dateStr < params.startDate) continue;
    if (params.endDate && dateStr > params.endDate) continue;
    if (params.facultyID && record.facultyID !== params.facultyID) continue;

    results.push(record);
  }

  return { success: true, data: results, total: results.length };
}

// ── Helper ──────────────────────────────────────────────────

function formatDate_(d) {
  if (!d) return '';
  try {
    return Utilities.formatDate(new Date(d), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch (e) {
    return String(d).substring(0, 10);
  }
}
