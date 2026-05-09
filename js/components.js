// ============================================================
// components.js – Reusable UI component generators
// ============================================================

const UI = (() => {

  // ── Toast Notifications ───────────────────────────────────

  function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<span>' + message + '</span>';
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ── Loading States ────────────────────────────────────────

  function showLoading(containerId) {
    const el = document.getElementById(containerId);
    if (el) {
      el.innerHTML = '<div class="loading-overlay"><div class="spinner"></div><span>Loading...</span></div>';
    }
  }

  // ── Empty State ───────────────────────────────────────────

  function showEmpty(containerId, message, icon = '📋') {
    const el = document.getElementById(containerId);
    if (el) {
      el.innerHTML = '<div class="empty-state"><div class="icon">' + icon + '</div><p>' + message + '</p></div>';
    }
  }

  // ── Stat Card ─────────────────────────────────────────────

  function statCard(label, value, subtitle) {
    return '<div class="stat-card">' +
      '<div class="stat-label">' + label + '</div>' +
      '<div class="stat-value">' + value + '</div>' +
      (subtitle ? '<div class="stat-subtitle">' + subtitle + '</div>' : '') +
    '</div>';
  }

  // ── Status Badge ──────────────────────────────────────────

  function statusBadge(status) {
    const s = (status || '').trim();
    const cls = s === 'Present' ? 'badge-present' : s === 'Late' ? 'badge-late' : s === 'O.D' ? 'badge-od' : 'badge-absent';
    return '<span class="badge ' + cls + '">' + s + '</span>';
  }

  // ── Percentage Badge ──────────────────────────────────────

  function pctBadge(pct) {
    const cls = pct >= 75 ? 'pct-high' : pct >= 50 ? 'pct-mid' : 'pct-low';
    return '<span class="badge-percentage ' + cls + '">' + pct + '%</span>';
  }

  // ── Bulk Attendance Row ───────────────────────────────────

  function bulkRow(student, index) {
    return '<div class="bulk-row" data-index="' + index + '" data-id="' + student.studentID + '">' +
      '<div class="bulk-student-id">' + student.studentID + '</div>' +
      '<div class="bulk-student-name">' + student.name + '</div>' +
      '<div class="status-toggle">' +
        '<button type="button" class="status-btn active-present" data-status="Present" onclick="App.setBulkStatus(this)">P</button>' +
        '<button type="button" class="status-btn" data-status="Absent" onclick="App.setBulkStatus(this)">A</button>' +
        '<button type="button" class="status-btn" data-status="Late" onclick="App.setBulkStatus(this)">L</button>' +
        '<button type="button" class="status-btn" data-status="O.D" onclick="App.setBulkStatus(this)">OD</button>' +
      '</div>' +
    '</div>';
  }

  // ── Modal ─────────────────────────────────────────────────

  function showModal(title, bodyHTML, footerHTML) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modal-overlay';
    overlay.onclick = function(e) { if (e.target === overlay) closeModal(); };

    overlay.innerHTML =
      '<div class="card modal-content">' +
        '<div class="card-header"><h3>' + title + '</h3>' +
          '<button class="btn-icon" onclick="UI.closeModal()">✕</button>' +
        '</div>' +
        '<div id="modal-body">' + bodyHTML + '</div>' +
        (footerHTML ? '<div style="margin-top:16px;display:flex;gap:8px;justify-content:flex-end">' + footerHTML + '</div>' : '') +
      '</div>';

    document.body.appendChild(overlay);
  }

  function closeModal() {
    const m = document.getElementById('modal-overlay');
    if (m) m.remove();
  }

  // ── Course Select Dropdown ────────────────────────────────

  function courseOptions(courses, selected) {
    let html = '<option value="">Select Course</option>';
    courses.forEach(function(c) {
      const sel = c.courseCode === selected ? ' selected' : '';
      html += '<option value="' + c.courseCode + '"' + sel + '>' + c.courseCode + ' – ' + c.courseName + '</option>';
    });
    return html;
  }

  // ── Student Subject Attendance Card ────────────────────────

  function subjectCard(subject) {
    var pctClass = subject.percentage >= 75 ? 'high' : subject.percentage >= 50 ? 'mid' : 'low';
    return '<div class="subject-card">' +
      '<div class="subject-name">' + subject.courseName + '</div>' +
      '<div class="subject-code">' + subject.courseCode + '</div>' +
      '<div style="display:flex;justify-content:space-between;margin-top:10px;font-size:0.82rem;color:var(--text-secondary)">' +
        '<span>' + subject.present + '/' + subject.totalClasses + ' classes</span>' +
        '<span style="font-weight:700;color:var(--text-primary)">' + subject.percentage + '%</span>' +
      '</div>' +
      '<div class="progress-bar"><div class="progress-fill ' + pctClass + '" style="width:' + subject.percentage + '%"></div></div>' +
    '</div>';
  }

  return {
    showToast, showLoading, showEmpty,
    statCard, statusBadge, pctBadge, bulkRow, subjectCard,
    showModal, closeModal, courseOptions
  };
})();
