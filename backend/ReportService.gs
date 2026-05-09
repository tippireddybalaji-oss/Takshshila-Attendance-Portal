// ============================================================
// ReportService.gs – Analytics, summaries & dashboard stats
// Uses Attendance_Records + summary rebuild from user's code
// ============================================================

/**
 * Returns attendance percentage for a student in a course.
 */
function getAttendancePercentage(studentID, courseCode) {
  if (!studentID || !courseCode) {
    return { success: false, error: 'Student ID and course code are required' };
  }

  const sheet = getSheet_(SHEETS.ATTENDANCE);
  const data  = sheet.getDataRange().getValues();

  let total = 0, present = 0;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][COL_ATTEND.STUDENT_ID - 1]).trim() === String(studentID).trim() &&
        String(data[i][COL_ATTEND.COURSE - 1]).trim() === String(courseCode).trim()) {
      total++;
      const status = String(data[i][COL_ATTEND.STATUS - 1]).trim();
      if (status === 'Present' || status === 'Late' || status === 'O.D') present++;
    }
  }

  return {
    success:      true,
    studentID,
    courseCode,
    totalClasses: total,
    present,
    absent:       total - present,
    percentage:   total > 0 ? Math.round((present / total) * 100) : 0
  };
}

/**
 * Full class report for a course.
 */
function getCourseReport(courseCode, startDate, endDate) {
  if (!courseCode) return { success: false, error: 'Course code is required' };

  // Get students for this course
  const studentsResult = getStudentsByCourse(courseCode);
  if (!studentsResult.success) return studentsResult;
  const students = studentsResult.data;

  const attSheet = getSheet_(SHEETS.ATTENDANCE);
  const attData  = attSheet.getDataRange().getValues();

  const attMap  = {};
  const allDates = new Set();

  for (let i = 1; i < attData.length; i++) {
    const cc   = String(attData[i][COL_ATTEND.COURSE - 1]).trim();
    if (cc !== courseCode) continue;

    const date = formatDate_(attData[i][COL_ATTEND.DATE - 1]);
    if (startDate && date < startDate) continue;
    if (endDate && date > endDate) continue;

    const sid    = String(attData[i][COL_ATTEND.STUDENT_ID - 1]).trim();
    const status = String(attData[i][COL_ATTEND.STATUS - 1]).trim();

    if (!attMap[sid]) attMap[sid] = [];
    attMap[sid].push({ date, status });
    allDates.add(date);
  }

  const sortedDates = Array.from(allDates).sort();

  const report = students.map(function(s) {
    const sid     = String(s.studentID).trim();
    const records = attMap[sid] || [];
    const total   = records.length;
    const present = records.filter(function(r) { return r.status === 'Present' || r.status === 'Late' || r.status === 'O.D'; }).length;

    return {
      studentID:    sid,
      name:         s.name,
      records:      records,
      totalClasses: total,
      present:      present,
      absent:       total - present,
      percentage:   total > 0 ? Math.round((present / total) * 100) : 0
    };
  });

  return {
    success:       true,
    courseCode,
    dates:         sortedDates,
    report,
    totalStudents: report.length
  };
}

/**
 * Dashboard stats for a faculty member.
 */
function getDashboardStats(facultyID) {
  if (!facultyID) return { success: false, error: 'Faculty ID is required' };

  const coursesResult = getCoursesByFaculty(facultyID);
  if (!coursesResult.success) return coursesResult;
  const courses = coursesResult.data;

  const today    = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const attSheet = getSheet_(SHEETS.ATTENDANCE);
  const attData  = attSheet.getDataRange().getValues();

  let totalStudents  = 0;
  let todayMarked    = 0;
  let todayPresent   = 0;
  const courseStats   = [];

  for (const course of courses) {
    const studentsResult = getStudentsByCourse(course.courseCode);
    const students = studentsResult.success ? studentsResult.data : [];
    totalStudents += students.length;

    let cToday = 0, cPresent = 0;

    for (let i = 1; i < attData.length; i++) {
      const cc   = String(attData[i][COL_ATTEND.COURSE - 1]).trim();
      const date = formatDate_(attData[i][COL_ATTEND.DATE - 1]);

      if (cc === course.courseCode && date === today) {
        cToday++;
        const status = String(attData[i][COL_ATTEND.STATUS - 1]).trim();
        if (status === 'Present' || status === 'Late' || status === 'O.D') cPresent++;
      }
    }

    todayMarked  += cToday;
    todayPresent += cPresent;

    courseStats.push({
      courseCode:     course.courseCode,
      courseName:    course.courseName,
      totalStudents: students.length,
      todayMarked:   cToday,
      todayPresent:  cPresent,
      markedToday:   cToday > 0
    });
  }

  return {
    success:      true,
    totalCourses: courses.length,
    totalStudents,
    todayMarked,
    todayPresent,
    todayAbsent:  todayMarked - todayPresent,
    courseStats
  };
}

/**
 * Rebuilds Attendance_Summary_Subject and Attendance_Summary_Overall.
 * (Production-ready version of the user's existing rebuildAttendanceSummaries)
 */
function rebuildAttendanceSummaries() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const recordsSheet = ss.getSheetByName(SHEETS.ATTENDANCE);
  const subjectSheet = ss.getSheetByName(SHEETS.SUMMARY_SUBJECT);
  const overallSheet = ss.getSheetByName(SHEETS.SUMMARY_OVERALL);

  if (!recordsSheet || !subjectSheet || !overallSheet) return;

  const data = recordsSheet.getDataRange().getValues();
  if (data.length <= 1) return;

  // ── Build course name lookup from Subjects_Master ─────────
  var courseNameMap = {};
  try {
    var subjectsSheet = ss.getSheetByName(SHEETS.SUBJECTS);
    if (subjectsSheet) {
      var subjectsData = subjectsSheet.getDataRange().getValues();
      for (var s = 1; s < subjectsData.length; s++) {
        var code = String(subjectsData[s][COL_SUBJECT.CODE - 1]).trim();
        var name = String(subjectsData[s][COL_SUBJECT.NAME - 1]).trim();
        if (code) {
          courseNameMap[code] = code + ' - ' + name;
        }
      }
    }
  } catch (e) { /* If lookup fails, fall back to raw course code */ }

  const subjectMap = {};
  const overallMap = {};

  for (let i = 1; i < data.length; i++) {
    const studentID = String(data[i][COL_ATTEND.STUDENT_ID - 1]).trim();
    var rawCourse   = String(data[i][COL_ATTEND.COURSE - 1]).trim();
    const status    = String(data[i][COL_ATTEND.STATUS - 1]).trim();

    // Normalize: extract just the code part (before " - ") for grouping
    var courseCode = rawCourse.indexOf(' - ') > 0
      ? rawCourse.substring(0, rawCourse.indexOf(' - ')).trim()
      : rawCourse;

    // Use the full "Code - Name" display from lookup, or fall back to raw
    var courseDisplay = courseNameMap[courseCode] || rawCourse;

    const subKey = studentID + '___' + courseCode;

    if (!subjectMap[subKey]) subjectMap[subKey] = { total: 0, present: 0, display: courseDisplay };
    if (!overallMap[studentID]) overallMap[studentID] = { total: 0, present: 0 };

    subjectMap[subKey].total++;
    overallMap[studentID].total++;

    if (status === 'Present' || status === 'Late' || status === 'O.D') {
      subjectMap[subKey].present++;
      overallMap[studentID].present++;
    }
  }

  // Build subject summary
  const subjectRows = [['Student_ID', 'Course', 'Total', 'Present', '%']];
  for (var key in subjectMap) {
    var parts = key.split('___');
    var obj = subjectMap[key];
    subjectRows.push([parts[0], obj.display, obj.total, obj.present, Math.round((obj.present / obj.total) * 100)]);
  }

  // Build overall summary
  const overallRows = [['Student_ID', 'Total', 'Present', '%']];
  for (var sid in overallMap) {
    var o = overallMap[sid];
    overallRows.push([sid, o.total, o.present, Math.round((o.present / o.total) * 100)]);
  }

  subjectSheet.clear();
  overallSheet.clear();
  subjectSheet.getRange(1, 1, subjectRows.length, 5).setValues(subjectRows);
  overallSheet.getRange(1, 1, overallRows.length, 4).setValues(overallRows);
}

/**
 * Main controller – can be triggered manually or by time trigger.
 */
function runFullAttendanceUpdate() {
  rebuildAttendanceSummaries();
}

/**
 * Returns a student's own attendance across all subjects.
 */
function getStudentOwnAttendance(studentID) {
  if (!studentID) return { success: false, error: 'Student ID is required' };

  var attSheet = getSheet_(SHEETS.ATTENDANCE);
  var attData  = attSheet.getDataRange().getValues();

  // Build course name lookup
  var courseNameMap = {};
  try {
    var subjectsSheet = getSheet_(SHEETS.SUBJECTS);
    var subjectsData = subjectsSheet.getDataRange().getValues();
    for (var s = 1; s < subjectsData.length; s++) {
      var code = String(subjectsData[s][COL_SUBJECT.CODE - 1]).trim();
      var name = String(subjectsData[s][COL_SUBJECT.NAME - 1]).trim();
      if (code) courseNameMap[code] = name;
    }
  } catch (e) { /* fallback */ }

  var subjectMap = {};

  for (var i = 1; i < attData.length; i++) {
    var sid = String(attData[i][COL_ATTEND.STUDENT_ID - 1]).trim();
    if (sid !== String(studentID).trim()) continue;

    var rawCourse = String(attData[i][COL_ATTEND.COURSE - 1]).trim();
    var status    = String(attData[i][COL_ATTEND.STATUS - 1]).trim();

    var courseCode = rawCourse.indexOf(' - ') > 0
      ? rawCourse.substring(0, rawCourse.indexOf(' - ')).trim()
      : rawCourse;

    if (!subjectMap[courseCode]) {
      subjectMap[courseCode] = { total: 0, present: 0, courseName: courseNameMap[courseCode] || courseCode };
    }

    subjectMap[courseCode].total++;
    if (status === 'Present' || status === 'Late' || status === 'O.D') {
      subjectMap[courseCode].present++;
    }
  }

  var subjects = [];
  for (var code in subjectMap) {
    var obj = subjectMap[code];
    subjects.push({
      courseCode:    code,
      courseName:   obj.courseName,
      totalClasses: obj.total,
      present:      obj.present,
      absent:       obj.total - obj.present,
      percentage:   obj.total > 0 ? Math.round((obj.present / obj.total) * 100) : 0
    });
  }

  return { success: true, studentID: studentID, subjects: subjects, totalSubjects: subjects.length };
}

/**
 * Admin overview – counts of all faculty, students, subjects, today's activity.
 */
function getAdminOverview() {
  var facSheet = getSheet_(SHEETS.FACULTY);
  var stuSheet = getSheet_(SHEETS.STUDENTS);
  var subSheet = getSheet_(SHEETS.SUBJECTS);
  var attSheet = getSheet_(SHEETS.ATTENDANCE);

  var totalFaculty  = Math.max(0, facSheet.getLastRow() - 1);
  var totalStudents = Math.max(0, stuSheet.getLastRow() - 1);
  var totalSubjects = Math.max(0, subSheet.getLastRow() - 1);

  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var attData = attSheet.getDataRange().getValues();

  var todayRecords = 0;
  var todayPresent = 0;

  for (var i = 1; i < attData.length; i++) {
    var date = formatDate_(attData[i][COL_ATTEND.DATE - 1]);
    if (date === today) {
      todayRecords++;
      var st = String(attData[i][COL_ATTEND.STATUS - 1]).trim();
      if (st === 'Present' || st === 'Late' || st === 'O.D') todayPresent++;
    }
  }

  return {
    success:       true,
    totalFaculty:  totalFaculty,
    totalStudents: totalStudents,
    totalSubjects: totalSubjects,
    totalRecords:  Math.max(0, attSheet.getLastRow() - 1),
    todayRecords:  todayRecords,
    todayPresent:  todayPresent,
    todayAbsent:   todayRecords - todayPresent
  };
}
