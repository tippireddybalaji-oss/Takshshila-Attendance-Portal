// ============================================================
// EditRequestService.gs – Edit Request & Honor Score System
// Faculty must request edit access; Admin approves/denies.
// ============================================================

/**
 * Ensures the Edit_Requests sheet exists with proper headers.
 */
function ensureEditRequestSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.EDIT_REQUESTS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.EDIT_REQUESTS);
    sheet.appendRow([
      'Request_ID', 'Faculty_ID', 'Faculty_Name', 'Row_Index',
      'Old_Status', 'New_Status', 'Reason', 'Status',
      'Timestamp', 'Reviewed_By', 'Review_Time'
    ]);
  }
  return sheet;
}

/**
 * Ensures the Honor_Scores sheet exists with proper headers.
 */
function ensureHonorSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.HONOR_SCORES);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.HONOR_SCORES);
    sheet.appendRow(['Faculty_ID', 'Faculty_Name', 'Score', 'Total_Edits', 'Last_Updated']);
  }
  return sheet;
}

// ── Submit Edit Request (Faculty) ───────────────────────────

/**
 * Faculty submits a request to edit an attendance record.
 * @param {string} facultyID
 * @param {string} facultyName
 * @param {number} rowIndex - Row in Attendance_Records to edit
 * @param {string} newStatus - Desired new status
 * @param {string} reason - Reason for the edit (min 20 chars)
 */
function submitEditRequest(facultyID, facultyName, rowIndex, newStatus, reason) {
  if (!facultyID || !rowIndex || !newStatus || !reason) {
    return { success: false, error: 'All fields are required' };
  }

  reason = sanitize(reason).trim();
  if (reason.length < 20) {
    return { success: false, error: 'Reason must be at least 20 characters' };
  }

  var sv = validateStatus(newStatus);
  if (!sv.valid) return { success: false, error: sv.error };

  // Get current status from the attendance record
  var attSheet = getSheet_(SHEETS.ATTENDANCE);
  var row = parseInt(rowIndex);
  if (row < 2) return { success: false, error: 'Invalid row index' };

  var lastRow = attSheet.getLastRow();
  if (row > lastRow) return { success: false, error: 'Record not found' };

  var oldStatus = String(attSheet.getRange(row, COL_ATTEND.STATUS).getValue()).trim();

  if (oldStatus === newStatus) {
    return { success: false, error: 'New status is the same as current status' };
  }

  // ── 7-day recency check ──
  var recordDateVal = attSheet.getRange(row, COL_ATTEND.DATE).getValue();
  var recordDate = new Date(recordDateVal);
  var now = new Date();
  var sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  if (recordDate < sevenDaysAgo) {
    return { success: false, error: 'You can only request edits for records from the last 7 days' };
  }

  // ── Max 5 pending/approved requests per faculty ──
  var reqSheet = ensureEditRequestSheet_();
  var reqData = reqSheet.getDataRange().getValues();
  var activeCount = 0;
  for (var i = 1; i < reqData.length; i++) {
    if (String(reqData[i][COL_EDIT_REQ.FACULTY_ID - 1]).trim() === facultyID) {
      var reqStatus = String(reqData[i][COL_EDIT_REQ.STATUS - 1]).trim();
      // Duplicate pending check on same row
      if (String(reqData[i][COL_EDIT_REQ.ROW_INDEX - 1]).trim() === String(rowIndex) && reqStatus === 'Pending') {
        return { success: false, error: 'A pending request already exists for this record' };
      }
      // Count active (pending + approved) requests
      if (reqStatus === 'Pending' || reqStatus === 'Approved') {
        activeCount++;
      }
    }
  }
  if (activeCount >= 5) {
    return { success: false, error: 'You have reached the maximum of 5 edit requests. Wait for existing ones to be resolved.' };
  }

  // Generate request ID
  var requestID = 'REQ_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

  reqSheet.appendRow([
    requestID,
    facultyID,
    facultyName || facultyID,
    rowIndex,
    oldStatus,
    newStatus,
    reason,
    'Pending',
    new Date().toISOString(),
    '',
    ''
  ]);

  // Initialize honor score if not exists
  initHonorScore_(facultyID, facultyName);

  logAudit('EDIT_REQUEST', facultyID, 'Row ' + rowIndex + ': ' + oldStatus + ' → ' + newStatus);

  return { success: true, message: 'Edit request submitted for admin approval', requestID: requestID };
}

// ── Get Edit Requests ───────────────────────────────────────

/**
 * Returns edit requests, optionally filtered by status.
 * Used by admin to view pending/all requests.
 */
function getEditRequests(filter) {
  var sheet = ensureEditRequestSheet_();
  var data = sheet.getDataRange().getValues();
  var results = [];

  // Also fetch record details for context
  var attSheet = getSheet_(SHEETS.ATTENDANCE);
  var attData = attSheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var status = String(row[COL_EDIT_REQ.STATUS - 1]).trim();

    if (filter && filter !== 'all' && status !== filter) continue;

    var rowIdx = parseInt(row[COL_EDIT_REQ.ROW_INDEX - 1]);
    var recordInfo = {};
    if (rowIdx >= 2 && rowIdx <= attData.length) {
      var attRow = attData[rowIdx - 1];
      recordInfo = {
        date: formatDate_(attRow[COL_ATTEND.DATE - 1]),
        course: String(attRow[COL_ATTEND.COURSE - 1]).trim(),
        studentID: String(attRow[COL_ATTEND.STUDENT_ID - 1]).trim()
      };
    }

    results.push({
      requestID:   String(row[COL_EDIT_REQ.ID - 1]).trim(),
      facultyID:   String(row[COL_EDIT_REQ.FACULTY_ID - 1]).trim(),
      facultyName: String(row[COL_EDIT_REQ.FACULTY_NAME - 1]).trim(),
      rowIndex:    rowIdx,
      oldStatus:   String(row[COL_EDIT_REQ.OLD_STATUS - 1]).trim(),
      newStatus:   String(row[COL_EDIT_REQ.NEW_STATUS - 1]).trim(),
      reason:      String(row[COL_EDIT_REQ.REASON - 1]).trim(),
      status:      status,
      timestamp:   String(row[COL_EDIT_REQ.TIMESTAMP - 1]).trim(),
      reviewedBy:  String(row[COL_EDIT_REQ.REVIEWED_BY - 1]).trim(),
      reviewTime:  String(row[COL_EDIT_REQ.REVIEW_TIME - 1]).trim(),
      record:      recordInfo
    });
  }

  // Most recent first
  results.reverse();

  return { success: true, data: results, total: results.length };
}

/**
 * Faculty views their own requests.
 */
function getMyEditRequests(facultyID) {
  if (!facultyID) return { success: false, error: 'Faculty ID is required' };

  var all = getEditRequests('all');
  if (!all.success) return all;

  var mine = all.data.filter(function(r) { return r.facultyID === facultyID; });
  return { success: true, data: mine, total: mine.length };
}

// ── Approve / Deny (Admin) ──────────────────────────────────

/**
 * Admin approves an edit request.
 * Applies the attendance change and deducts honor score.
 */
function approveEditRequest(requestID, adminID) {
  if (!requestID) return { success: false, error: 'Request ID is required' };

  var sheet = ensureEditRequestSheet_();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COL_EDIT_REQ.ID - 1]).trim() === requestID) {
      var currentStatus = String(data[i][COL_EDIT_REQ.STATUS - 1]).trim();
      if (currentStatus !== 'Pending') {
        return { success: false, error: 'Request has already been ' + currentStatus.toLowerCase() };
      }

      var rowIndex  = parseInt(data[i][COL_EDIT_REQ.ROW_INDEX - 1]);
      var newStatus = String(data[i][COL_EDIT_REQ.NEW_STATUS - 1]).trim();
      var facultyID = String(data[i][COL_EDIT_REQ.FACULTY_ID - 1]).trim();

      // Apply the actual attendance change
      var attSheet = getSheet_(SHEETS.ATTENDANCE);
      attSheet.getRange(rowIndex, COL_ATTEND.STATUS).setValue(newStatus);

      // Update request status
      var sheetRow = i + 1;
      sheet.getRange(sheetRow, COL_EDIT_REQ.STATUS).setValue('Approved');
      sheet.getRange(sheetRow, COL_EDIT_REQ.REVIEWED_BY).setValue(adminID || 'Admin');
      sheet.getRange(sheetRow, COL_EDIT_REQ.REVIEW_TIME).setValue(new Date().toISOString());

      // Deduct honor score
      deductHonorScore_(facultyID);

      // Rebuild attendance summaries
      rebuildAttendanceSummaries();

      logAudit('APPROVE_EDIT', adminID, 'Approved ' + requestID + ' for faculty ' + facultyID);

      return { success: true, message: 'Edit request approved. Attendance updated.' };
    }
  }

  return { success: false, error: 'Request not found' };
}

/**
 * Admin denies an edit request.
 */
function denyEditRequest(requestID, adminID, denyReason) {
  if (!requestID) return { success: false, error: 'Request ID is required' };

  var sheet = ensureEditRequestSheet_();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COL_EDIT_REQ.ID - 1]).trim() === requestID) {
      var currentStatus = String(data[i][COL_EDIT_REQ.STATUS - 1]).trim();
      if (currentStatus !== 'Pending') {
        return { success: false, error: 'Request has already been ' + currentStatus.toLowerCase() };
      }

      var sheetRow = i + 1;
      sheet.getRange(sheetRow, COL_EDIT_REQ.STATUS).setValue('Denied');
      sheet.getRange(sheetRow, COL_EDIT_REQ.REVIEWED_BY).setValue(adminID || 'Admin');
      sheet.getRange(sheetRow, COL_EDIT_REQ.REVIEW_TIME).setValue(new Date().toISOString());

      var facultyID = String(data[i][COL_EDIT_REQ.FACULTY_ID - 1]).trim();
      logAudit('DENY_EDIT', adminID, 'Denied ' + requestID + ' for faculty ' + facultyID + (denyReason ? ': ' + denyReason : ''));

      return { success: true, message: 'Edit request denied.' };
    }
  }

  return { success: false, error: 'Request not found' };
}

// ── Honor Score System ──────────────────────────────────────

/**
 * Initializes honor score for a faculty if it doesn't exist.
 */
function initHonorScore_(facultyID, facultyName) {
  var sheet = ensureHonorSheet_();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COL_HONOR.FACULTY_ID - 1]).trim() === facultyID) {
      return; // Already exists
    }
  }

  sheet.appendRow([facultyID, facultyName || facultyID, 100, 0, new Date().toISOString()]);
}

/**
 * Deducts honor score based on sliding scale.
 * Monthly edits 1-5:   -1 per edit
 * Monthly edits 6-15:  -2 per edit
 * Monthly edits 16+:   -5 per edit
 */
function deductHonorScore_(facultyID) {
  var sheet = ensureHonorSheet_();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COL_HONOR.FACULTY_ID - 1]).trim() === facultyID) {
      var currentScore = Number(data[i][COL_HONOR.SCORE - 1]) || 100;
      var totalEdits = Number(data[i][COL_HONOR.TOTAL_EDITS - 1]) || 0;

      // Count monthly edits from Edit_Requests (approved ones this month)
      var monthlyEdits = countMonthlyEdits_(facultyID);

      // Sliding scale deduction
      var deduction = 1;
      if (monthlyEdits > 15) deduction = 5;
      else if (monthlyEdits > 5) deduction = 2;

      var newScore = Math.max(0, currentScore - deduction);
      var newTotal = totalEdits + 1;
      var sheetRow = i + 1;

      sheet.getRange(sheetRow, COL_HONOR.SCORE).setValue(newScore);
      sheet.getRange(sheetRow, COL_HONOR.TOTAL_EDITS).setValue(newTotal);
      sheet.getRange(sheetRow, COL_HONOR.LAST_UPDATED).setValue(new Date().toISOString());

      return;
    }
  }

  // If not found, create and deduct
  sheet.appendRow([facultyID, facultyID, 99, 1, new Date().toISOString()]);
}

/**
 * Counts how many edits a faculty has had approved this month.
 */
function countMonthlyEdits_(facultyID) {
  var reqSheet = ensureEditRequestSheet_();
  var data = reqSheet.getDataRange().getValues();

  var now = new Date();
  var monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  var count = 0;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COL_EDIT_REQ.FACULTY_ID - 1]).trim() === facultyID &&
        String(data[i][COL_EDIT_REQ.STATUS - 1]).trim() === 'Approved') {
      var ts = new Date(data[i][COL_EDIT_REQ.TIMESTAMP - 1]);
      if (ts >= monthStart) count++;
    }
  }

  return count;
}

/**
 * Returns all honor scores (admin view).
 */
function getHonorScores() {
  var sheet = ensureHonorSheet_();
  var data = sheet.getDataRange().getValues();
  var results = [];

  for (var i = 1; i < data.length; i++) {
    results.push({
      facultyID:   String(data[i][COL_HONOR.FACULTY_ID - 1]).trim(),
      facultyName: String(data[i][COL_HONOR.FACULTY_NAME - 1]).trim(),
      score:       Number(data[i][COL_HONOR.SCORE - 1]),
      totalEdits:  Number(data[i][COL_HONOR.TOTAL_EDITS - 1]),
      lastUpdated: String(data[i][COL_HONOR.LAST_UPDATED - 1]).trim()
    });
  }

  // Sort by score ascending (worst first)
  results.sort(function(a, b) { return a.score - b.score; });

  return { success: true, data: results, total: results.length };
}

/**
 * Returns a single faculty's honor score.
 */
function getHonorScore(facultyID) {
  if (!facultyID) return { success: false, error: 'Faculty ID is required' };

  var sheet = ensureHonorSheet_();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COL_HONOR.FACULTY_ID - 1]).trim() === facultyID) {
      return {
        success: true,
        score:      Number(data[i][COL_HONOR.SCORE - 1]),
        totalEdits: Number(data[i][COL_HONOR.TOTAL_EDITS - 1]),
        lastUpdated: String(data[i][COL_HONOR.LAST_UPDATED - 1]).trim()
      };
    }
  }

  // No record = perfect score
  return { success: true, score: 100, totalEdits: 0, lastUpdated: '' };
}

// ── Lookup Records by Date + Course (for student picker) ────

/**
 * Returns attendance records for a specific date + course.
 * Used by faculty to browse and select records to edit.
 * Only returns records from the last 7 days.
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @param {string} course - Course code or course name
 * @param {string} facultyID - Faculty ID to filter by
 */
function getRecordsByDateCourse(dateStr, course, facultyID) {
  if (!dateStr) return { success: false, error: 'Date is required' };

  var targetDate = new Date(dateStr);
  var now = new Date();
  var sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  if (targetDate < sevenDaysAgo) {
    return { success: false, error: 'You can only browse records from the last 7 days' };
  }

  var attSheet = getSheet_(SHEETS.ATTENDANCE);
  var data = attSheet.getDataRange().getValues();
  var results = [];

  // Also get student names for display
  var stuSheet = getSheet_(SHEETS.STUDENTS);
  var stuData = stuSheet.getDataRange().getValues();
  var stuMap = {};
  for (var s = 1; s < stuData.length; s++) {
    stuMap[String(stuData[s][COL_STUDENT.ID - 1]).trim()] = String(stuData[s][COL_STUDENT.NAME - 1]).trim();
  }

  for (var i = 1; i < data.length; i++) {
    var recDate = formatDate_(data[i][COL_ATTEND.DATE - 1]);
    var recCourse = String(data[i][COL_ATTEND.COURSE - 1]).trim();
    var recFaculty = String(data[i][COL_ATTEND.FACULTY_ID - 1]).trim();
    var recStudent = String(data[i][COL_ATTEND.STUDENT_ID - 1]).trim();
    var recStatus = String(data[i][COL_ATTEND.STATUS - 1]).trim();

    // Match date
    if (recDate !== dateStr) continue;

    // Match course (partial match – course code or full name)
    if (course && recCourse.indexOf(course) === -1) continue;

    // Optionally filter by faculty
    if (facultyID && recFaculty !== facultyID) continue;

    results.push({
      rowIndex: i + 1,  // 1-indexed sheet row
      date: recDate,
      course: recCourse,
      studentID: recStudent,
      studentName: stuMap[recStudent] || recStudent,
      facultyID: recFaculty,
      status: recStatus
    });
  }

  return { success: true, data: results, total: results.length };
}
