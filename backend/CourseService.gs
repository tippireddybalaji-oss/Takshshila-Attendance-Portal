// ============================================================
// CourseService.gs – Course / Subject CRUD
// Subjects_Master: Course_Code | Course_Name | Department | Year | Faculty_ID
// ============================================================

/**
 * Returns all courses, optionally filtered.
 */
function getCourses(params) {
  const sheet = getSheet_(SHEETS.SUBJECTS);
  const data  = sheet.getDataRange().getValues();
  const results = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const course = {
      courseCode:  String(row[COL_SUBJECT.CODE - 1]).trim(),
      courseName: String(row[COL_SUBJECT.NAME - 1]).trim(),
      department: String(row[COL_SUBJECT.DEPT - 1]).trim(),
      year:       String(row[COL_SUBJECT.YEAR - 1]).trim(),
      facultyID:  String(row[COL_SUBJECT.FACULTY_ID - 1]).trim()
    };

    if (params.department && course.department !== params.department) continue;
    if (params.facultyID && course.facultyID !== String(params.facultyID)) continue;

    results.push(course);
  }

  return { success: true, data: results, total: results.length };
}

/**
 * Returns courses assigned to a faculty.
 */
function getCoursesByFaculty(facultyID) {
  if (!facultyID) return { success: false, error: 'Faculty ID is required' };
  return getCourses({ facultyID: String(facultyID) });
}
