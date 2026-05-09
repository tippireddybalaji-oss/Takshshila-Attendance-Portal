// ============================================================
// StudentService.gs – Student CRUD
// Student_Master: Student_ID | Student_Name | Department | Year | Section
// ============================================================

/**
 * Returns all students, optionally filtered.
 */
function getStudents(params) {
  const sheet = getSheet_(SHEETS.STUDENTS);
  const data  = sheet.getDataRange().getValues();
  const results = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const student = {
      studentID:  String(row[COL_STUDENT.ID - 1]).trim(),
      name:       String(row[COL_STUDENT.NAME - 1]).trim(),
      department: String(row[COL_STUDENT.DEPT - 1]).trim(),
      year:       String(row[COL_STUDENT.YEAR - 1]).trim(),
      section:    String(row[COL_STUDENT.SECTION - 1]).trim()
    };

    if (params.department && student.department !== params.department) continue;
    if (params.year && student.year !== String(params.year)) continue;
    if (params.section && student.section !== params.section) continue;
    if (params.search) {
      const q = params.search.toLowerCase();
      if (!student.studentID.toLowerCase().includes(q) &&
          !student.name.toLowerCase().includes(q)) continue;
    }

    results.push(student);
  }

  return { success: true, data: results, total: results.length };
}

/**
 * Returns students enrolled in a course (matched by department + year from Subjects_Master).
 */
function getStudentsByCourse(courseCode) {
  if (!courseCode) return { success: false, error: 'Course code is required' };

  const subjSheet = getSheet_(SHEETS.SUBJECTS);
  const subjData  = subjSheet.getDataRange().getValues();
  let courseMeta  = null;

  for (let i = 1; i < subjData.length; i++) {
    if (String(subjData[i][COL_SUBJECT.CODE - 1]).trim() === courseCode) {
      courseMeta = {
        department: String(subjData[i][COL_SUBJECT.DEPT - 1]).trim(),
        year:       String(subjData[i][COL_SUBJECT.YEAR - 1]).trim()
      };
      break;
    }
  }

  if (!courseMeta) return { success: false, error: 'Course not found' };

  return getStudents({
    department: courseMeta.department,
    year:       courseMeta.year
  });
}

/**
 * Adds a new student.
 */
function addStudent(student) {
  const req = validateRequired(student, ['studentID', 'name', 'department', 'year', 'section']);
  if (!req.valid) return { success: false, error: 'Missing field: ' + req.missing };

  const sheet = getSheet_(SHEETS.STUDENTS);
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(student.studentID).trim()) {
      return { success: false, error: 'Student ID already exists' };
    }
  }

  sheet.appendRow([
    sanitize(student.studentID),
    sanitize(student.name),
    sanitize(student.department),
    student.year,
    sanitize(student.section)
  ]);

  logAudit('ADD_STUDENT', 'ADMIN', 'Added ' + student.studentID);
  return { success: true, message: 'Student added' };
}

/**
 * Deletes a student row.
 */
function deleteStudent(studentID) {
  if (!studentID) return { success: false, error: 'Student ID is required' };

  const sheet = getSheet_(SHEETS.STUDENTS);
  const data  = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === String(studentID).trim()) {
      sheet.deleteRow(i + 1);
      logAudit('DELETE_STUDENT', 'ADMIN', 'Deleted ' + studentID);
      return { success: true, message: 'Student removed' };
    }
  }
  return { success: false, error: 'Student not found' };
}
