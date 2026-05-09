// ============================================================
// Config.gs – Central configuration
// Matches YOUR existing Google Sheet tabs exactly.
// ============================================================

// ── Sheet (Tab) Names ────────────────────────────────────────
const SHEETS = {
  STUDENTS:          'Student_Master',
  FACULTY:           'Faculty_Master',
  ADMIN:             'Admin_Master',
  SUBJECTS:          'Subjects_Master',
  ATTENDANCE:        'Attendance_Records',
  STUDENT_SUBJ_MAP:  'Studnet_Subject_Map',
  SUMMARY_SUBJECT:   'Attendance_Summary_Subject',
  SUMMARY_OVERALL:   'Attendance_Summary_Overall',
  RESPONSES:         'Attendance_Responses',
  AUDIT_LOG:         'Audit_Log',
  EDIT_REQUESTS:     'Edit_Requests',
  HONOR_SCORES:      'Honor_Scores'
};

// ── Column Maps (1-indexed, matching your headers) ──────────

// Student_Master: Student_ID | Student_Name | Department | Year | Section | Phone
const COL_STUDENT = { ID: 1, NAME: 2, DEPT: 3, YEAR: 4, SECTION: 5, PHONE: 6 };

// Faculty_Master: Faculty_ID | Faculty_Name | Department | Email | Phone
const COL_FACULTY = { ID: 1, NAME: 2, DEPT: 3, EMAIL: 4, PHONE: 5 };

// Subjects_Master: Course_Code | Course_Name | Department | Year | Faculty_ID
const COL_SUBJECT = { CODE: 1, NAME: 2, DEPT: 3, YEAR: 4, FACULTY_ID: 5 };

// Admin_Master: Admin_ID | Admin_Name | Department | Email | Phone
const COL_ADMIN = { ID: 1, NAME: 2, DEPT: 3, EMAIL: 4, PHONE: 5 };

// Attendance_Records: Date | Course | StudentID | FacultyID | Status
const COL_ATTEND  = { DATE: 1, COURSE: 2, STUDENT_ID: 3, FACULTY_ID: 4, STATUS: 5 };

// Edit_Requests: Request_ID | Faculty_ID | Faculty_Name | Row_Index | Old_Status | New_Status | Reason | Status | Timestamp | Reviewed_By | Review_Time
const COL_EDIT_REQ = { ID: 1, FACULTY_ID: 2, FACULTY_NAME: 3, ROW_INDEX: 4, OLD_STATUS: 5, NEW_STATUS: 6, REASON: 7, STATUS: 8, TIMESTAMP: 9, REVIEWED_BY: 10, REVIEW_TIME: 11 };

// Honor_Scores: Faculty_ID | Faculty_Name | Score | Total_Edits | Last_Updated
const COL_HONOR = { FACULTY_ID: 1, FACULTY_NAME: 2, SCORE: 3, TOTAL_EDITS: 4, LAST_UPDATED: 5 };

// ── Enums ────────────────────────────────────────────────────
const STATUS_ENUM = ['Present', 'Absent', 'Late', 'O.D'];
const ROLE_ENUM   = ['student', 'faculty', 'admin'];
const EDIT_REQ_STATUS = ['Pending', 'Approved', 'Denied'];


// ── Defaults ─────────────────────────────────────────────────
const DEFAULTS = {
  SESSION_TIMEOUT_SEC:  7200,     // 2 hours
  MAX_BULK_SIZE:        60,
  ATTENDANCE_LOCK_HRS:  24
};

// ── Helper: get a sheet handle ───────────────────────────────
function getSheet_(name) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sheet) throw new Error('Sheet "' + name + '" not found – please create it.');
  return sheet;
}

// ── Helper: ensure Audit_Log tab exists ──────────────────────
function ensureAuditSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEETS.AUDIT_LOG);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.AUDIT_LOG);
    sheet.appendRow(['Timestamp', 'Action', 'UserID', 'Details']);
  }
  return sheet;
}
