// ============================================================
// Code.gs – Main Router & Entry Point (Multi-Role)
// ============================================================

function doGet(e) {
  try {
    const params = e.parameter || {};
    const action = params.action || 'getData';

    // ── If a `payload` query-param exists, route to mutation handler
    if (params.payload) {
      var body;
      try { body = JSON.parse(params.payload); } catch (pe) {
        return jsonResponse_({ success: false, error: 'Invalid payload JSON' });
      }
      return doPostBody_(body);
    }

    var result;

    switch (action) {
      case 'getData':
        var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEETS.ATTENDANCE);
        var data  = sheet.getDataRange().getValues();
        result = { success: true, data: data };
        break;

      // ── Auth ──
      case 'validateSession':
        result = validateToken(params.token);
        break;

      // ── Attendance ──
      case 'getAttendance':
        result = getAttendanceRecords(params);
        break;

      // ── Students ──
      case 'getStudents':
        result = getStudents(params);
        break;
      case 'getStudentsByCourse':
        result = getStudentsByCourse(params.courseCode);
        break;

      // ── Courses / Subjects ──
      case 'getCourses':
        result = getCourses(params);
        break;
      case 'getCoursesByFaculty':
        result = getCoursesByFaculty(params.facultyID);
        break;

      // ── Reports ──
      case 'getAttendancePercentage':
        result = getAttendancePercentage(params.studentID, params.courseCode);
        break;
      case 'getCourseReport':
        result = getCourseReport(params.courseCode, params.startDate, params.endDate);
        break;
      case 'getDashboardStats':
        result = getDashboardStats(params.facultyID);
        break;

      // ── Student self-service ──
      case 'getMyAttendance':
        result = getStudentOwnAttendance(params.studentID);
        break;

      // ── Firebase Auth – find user by email or phone ──
      case 'findUser':
        result = findUserByIdentifier(params.email, params.phone);
        break;

      // ── Admin ──
      case 'getAdminOverview':
        result = getAdminOverview();
        break;

      // ── Edit Requests ──
      case 'getEditRequests':
        result = getEditRequests(params.filter || 'Pending');
        break;
      case 'getMyEditRequests':
        result = getMyEditRequests(params.facultyID);
        break;
      case 'getRecordsByDateCourse':
        result = getRecordsByDateCourse(params.date, params.course, params.facultyID);
        break;

      // ── Honor Scores ──
      case 'getHonorScores':
        result = getHonorScores();
        break;
      case 'getHonorScore':
        result = getHonorScore(params.facultyID);
        break;

      // ── Summary rebuild ──
      case 'rebuildSummaries':
        rebuildAttendanceSummaries();
        result = { success: true, message: 'Summaries rebuilt' };
        break;

      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }

    return jsonResponse_(result);
  } catch (err) {
    logAudit('ERROR', 'SYSTEM', err.message);
    return jsonResponse_({ success: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    return doPostBody_(body);
  } catch (err) {
    logAudit('ERROR', 'SYSTEM', err.message);
    return jsonResponse_({ success: false, error: err.message });
  }
}

function doPostBody_(body) {
  try {
    const action = body.action || 'markAttendance';
    var result;

    switch (action) {
      // ── Auth (multi-role) ──
      case 'login':
        return jsonResponse_(login(body.email, body.password));

      case 'loginStudent':
        return jsonResponse_(loginStudent(body.studentID, body.password));

      case 'loginAdmin':
        return jsonResponse_(loginAdmin(body.email, body.password));

      case 'logout':
        return jsonResponse_(logout(body.token));

      // ── Attendance ──
      case 'markBulkAttendance': {
        if (!body.token) return jsonResponse_({ success: false, error: 'Authentication required' });
        var s = validateToken(body.token);
        if (!s || !s.valid) return jsonResponse_({ success: false, error: 'Unauthorized' });
        if (s.role === 'student') return jsonResponse_({ success: false, error: 'Students cannot mark attendance' });
        result = markBulkAttendance(body.courseCode, body.records, s.facultyID);
        break;
      }

      case 'updateAttendance': {
        if (!body.token) return jsonResponse_({ success: false, error: 'Authentication required' });
        var s2 = validateToken(body.token);
        if (!s2 || !s2.valid) return jsonResponse_({ success: false, error: 'Unauthorized' });
        if (s2.role === 'student') return jsonResponse_({ success: false, error: 'Students cannot update attendance' });
        // Faculty must submit edit requests; only admin can directly update
        if (s2.role === 'faculty') return jsonResponse_({ success: false, error: 'Faculty must submit edit requests for admin approval' });
        result = updateAttendanceRecord(body.rowIndex, body.newStatus, s2.adminID || 'Admin');
        break;
      }

      // ── Edit Requests ──
      case 'submitEditRequest': {
        if (!body.token) return jsonResponse_({ success: false, error: 'Authentication required' });
        var s3 = validateToken(body.token);
        if (!s3 || !s3.valid) return jsonResponse_({ success: false, error: 'Unauthorized' });
        result = submitEditRequest(s3.facultyID, s3.facultyName || s3.facultyID, body.rowIndex, body.newStatus, body.reason);
        break;
      }

      case 'approveEditRequest': {
        if (!body.token) return jsonResponse_({ success: false, error: 'Authentication required' });
        var s4 = validateToken(body.token);
        if (!s4 || !s4.valid) return jsonResponse_({ success: false, error: 'Unauthorized' });
        if (s4.role !== 'admin') return jsonResponse_({ success: false, error: 'Only admins can approve edit requests' });
        result = approveEditRequest(body.requestID, s4.adminID || s4.email || 'Admin');
        break;
      }

      case 'denyEditRequest': {
        if (!body.token) return jsonResponse_({ success: false, error: 'Authentication required' });
        var s5 = validateToken(body.token);
        if (!s5 || !s5.valid) return jsonResponse_({ success: false, error: 'Unauthorized' });
        if (s5.role !== 'admin') return jsonResponse_({ success: false, error: 'Only admins can deny edit requests' });
        result = denyEditRequest(body.requestID, s5.adminID || s5.email || 'Admin', body.denyReason);
        break;
      }

      case 'addStudent':
        result = addStudent(body.student);
        break;

      case 'deleteStudent':
        result = deleteStudent(body.studentID);
        break;

      case 'markAttendance': {
        var facultyID = '';
        if (body.token) {
          var session = validateToken(body.token);
          if (session && session.valid) facultyID = session.facultyID;
        }
        result = markAttendance(
          body.course || body.courseCode,
          body.studentID,
          body.status || 'Present',
          facultyID
        );
        rebuildAttendanceSummaries();
        break;
      }

      default:
        result = { success: false, error: 'Unknown action: ' + action };
    }

    return jsonResponse_(result);
  } catch (err) {
    logAudit('ERROR', 'SYSTEM', err.message);
    return jsonResponse_({ success: false, error: err.message });
  }
}

function jsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
