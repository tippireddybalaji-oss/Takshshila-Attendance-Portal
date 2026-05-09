// ============================================================
// app.js – Multi-Role SPA Controller with Firebase Auth
// Flow: Splash → Role Select → Login (Phone/Google/Email) → Dashboard
// ============================================================

const App = (() => {
  let selectedRole = '';
  let courses = [];
  let bulkStudents = [];

  // ── Initialisation ─────────────────────────────────────────
  function init() {
    FireAuth.init();
    applySavedTheme();
    if (Auth.isLoggedIn()) {
      hideSplash();
      showDashboard();
      return;
    }
    setTimeout(() => {
      hideSplash();
      showView('role-view');
    }, 2200);
  }

  function hideSplash() {
    var splash = document.getElementById('splash-view');
    if (splash) splash.classList.add('hidden');
  }

  // ── View Management ────────────────────────────────────────
  function hideAll() {
    ['splash-view', 'role-view', 'login-view', 'app-view', 'student-view', 'admin-view'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  function showView(id) {
    hideAll();
    var el = document.getElementById(id);
    if (el) el.style.display = '';
  }

  // ── Role Selection ─────────────────────────────────────────
  function selectRole(role) {
    selectedRole = role;
    showView('login-view');

    var badge = document.getElementById('login-role-badge');
    if (role === 'student') {
      badge.innerHTML = '🎓 Student';
    } else if (role === 'admin') {
      badge.innerHTML = '🛡️ Admin';
    } else {
      badge.innerHTML = '👨‍🏫 Faculty';
    }

    // Show email tab student fields if student role selected
    var studentFields = document.getElementById('login-student-fields');
    var facultyFields = document.getElementById('login-faculty-fields');
    if (studentFields && facultyFields) {
      if (role === 'student') {
        studentFields.style.display = '';
        facultyFields.style.display = 'none';
      } else {
        studentFields.style.display = 'none';
        facultyFields.style.display = '';
      }
    }

    // Default to phone tab
    switchAuthTab('phone');
  }

  function showRoleSelect() {
    showView('role-view');
  }

  // ── Auth Tab Switching ─────────────────────────────────────
  function switchAuthTab(method) {
    // Toggle tab buttons
    document.querySelectorAll('.auth-tab').forEach(function(t) { t.classList.remove('active'); });
    var activeTab = document.querySelector('.auth-tab[data-method="' + method + '"]');
    if (activeTab) activeTab.classList.add('active');

    // Toggle panels
    ['auth-phone', 'auth-google', 'auth-email'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    var panel = document.getElementById('auth-' + method);
    if (panel) panel.style.display = '';
  }

  // ── Phone OTP: Send ────────────────────────────────────────
  async function handleSendOTP() {
    var phoneInput = document.getElementById('phone-number');
    var phone = phoneInput.value.trim().replace(/\s/g, '');
    if (!phone || phone.length < 10) {
      UI.showToast('Enter a valid 10-digit mobile number', 'error');
      return;
    }

    var fullPhone = '+91' + phone;
    var btn = document.getElementById('send-otp-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Sending...';

    var result = await FireAuth.sendOTP(fullPhone, 'recaptcha-container');

    if (result.success) {
      UI.showToast('OTP sent to ' + fullPhone, 'success');
      document.getElementById('phone-step-1').style.display = 'none';
      document.getElementById('phone-step-2').style.display = '';
      document.getElementById('otp-phone-display').textContent = fullPhone;
      document.getElementById('otp-code').focus();
    } else {
      UI.showToast(result.error || 'Failed to send OTP', 'error');
    }

    btn.disabled = false;
    btn.innerHTML = 'Send OTP';
  }

  // ── Phone OTP: Verify ──────────────────────────────────────
  async function handleVerifyOTP() {
    var code = document.getElementById('otp-code').value.trim();
    if (!code || code.length !== 6) {
      UI.showToast('Enter the 6-digit OTP', 'error');
      return;
    }

    var btn = document.getElementById('verify-otp-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Verifying...';

    var result = await FireAuth.verifyOTP(code);

    if (result.success) {
      // Phone verified! Now find user in sheets
      await lookupAndLogin(null, result.phone);
    } else {
      UI.showToast(result.error || 'Invalid OTP', 'error');
    }

    btn.disabled = false;
    btn.innerHTML = 'Verify & Sign In';
  }

  function resetPhoneAuth() {
    document.getElementById('phone-step-1').style.display = '';
    document.getElementById('phone-step-2').style.display = 'none';
    document.getElementById('otp-code').value = '';
    document.getElementById('phone-number').value = '';
  }

  // ── Google Sign-In ─────────────────────────────────────────
  async function handleGoogleSignIn() {
    var btn = document.getElementById('google-signin-btn');
    btn.disabled = true;

    var result = await FireAuth.signInWithGoogle();

    if (result.success) {
      await lookupAndLogin(result.email, null);
    } else {
      UI.showToast(result.error || 'Google sign-in failed', 'error');
    }

    btn.disabled = false;
  }

  // ── Email/Password Login (fallback) ────────────────────────
  async function handleEmailLogin() {
    var rememberMe = document.getElementById('remember-me').checked;
    var btn = document.getElementById('email-login-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Signing in...';

    try {
      var result;
      if (selectedRole === 'student') {
        var sid  = document.getElementById('login-student-id').value.trim();
        var pass = document.getElementById('login-student-pass').value.trim();
        if (!sid || !pass) { UI.showToast('Fill all fields', 'error'); return; }
        result = await API.loginStudent(sid, pass);
      } else if (selectedRole === 'admin') {
        var email = document.getElementById('login-email').value.trim();
        var pass2 = document.getElementById('login-password').value.trim();
        if (!email || !pass2) { UI.showToast('Fill all fields', 'error'); return; }
        result = await API.loginAdmin(email, pass2);
      } else {
        var email2 = document.getElementById('login-email').value.trim();
        var pass3  = document.getElementById('login-password').value.trim();
        if (!email2 || !pass3) { UI.showToast('Fill all fields', 'error'); return; }
        result = await API.login(email2, pass3);
      }

      if (result.success) {
        Auth.saveSession(result, rememberMe);
        UI.showToast('Welcome!', 'success');
        showDashboard();
      } else {
        UI.showToast(result.error || 'Login failed', 'error');
      }
    } catch (err) {
      UI.showToast('Connection error', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = 'Sign In';
    }
  }

  // ── Lookup user in sheets after Firebase auth ──────────────
  async function lookupAndLogin(email, phone) {
    UI.showToast('Verifying your account...', 'info');
    var rememberMe = document.getElementById('remember-me').checked;

    try {
      var result = await API.findUser(email || '', phone || '');

      if (result.success) {
        // Build a session-like object
        var sessionData = {
          token: 'firebase_' + Date.now(),
          role: result.role,
          courses: result.courses || [],
          dashboardStats: result.dashboardStats || null,
          attendanceData: result.attendanceData || null
        };

        if (result.role === 'student') {
          sessionData.student = result.user;
        } else {
          sessionData.faculty = result.user;
        }

        Auth.saveSession(sessionData, rememberMe);
        UI.showToast('Welcome, ' + result.user.name + '!', 'success');
        showDashboard();
      } else {
        UI.showToast(result.error || 'Account not found in system', 'error');
        await FireAuth.signOut();
      }
    } catch (err) {
      console.error('Lookup error:', err);
      UI.showToast('Failed to verify account. Check your connection.', 'error');
      await FireAuth.signOut();
    }
  }

  // ── Show Dashboard (based on role) ─────────────────────────
  function showDashboard() {
    var role = Auth.getRole();
    if (role === 'student') showStudentDashboard();
    else if (role === 'admin') showAdminDashboard();
    else showFacultyDashboard();
  }

  // ── Student Dashboard ──────────────────────────────────────
  async function showStudentDashboard() {
    showView('student-view');
    var user = Auth.getUser();
    if (user) {
      document.getElementById('student-name').textContent = user.name || user.id;
      document.getElementById('student-greeting-text').textContent = 'Hi, ' + (user.name || user.id);
      document.getElementById('student-info').textContent =
        (user.department || '') + ' | Year ' + (user.year || '') + ' | Section ' + (user.section || '');
      var settingsInfo = document.getElementById('settings-user-info');
      if (settingsInfo) settingsInfo.textContent = 'Signed in as ' + (user.name || user.id);
      renderIDCard(user);
      initProfileSection('student');
    }
    // Show home panel by default
    navigateStudent('home');

    var cached = Auth.getCachedDashboard();
    if (cached && cached.subjects) renderStudentData(cached);

    try {
      var data = await API.getMyAttendance(user.id);
      if (data.success) renderStudentData(data);
    } catch (e) { console.error(e); }
  }

  function renderStudentData(data) {
    var subjects = data.subjects || [];
    var totalClasses = 0, totalPresent = 0;
    subjects.forEach(function(s) { totalClasses += s.totalClasses; totalPresent += s.present; });
    var overall = totalClasses > 0 ? Math.round((totalPresent / totalClasses) * 100) : 0;

    document.getElementById('student-stats').innerHTML =
      UI.statCard('Total Subjects', subjects.length, 'Enrolled') +
      UI.statCard('Total Classes', totalClasses, 'All subjects') +
      UI.statCard('Present', totalPresent, 'Classes attended') +
      UI.statCard('Overall %', overall + '%', overall >= 75 ? 'On track' : 'Needs attention');

    // Populate Home quick stats
    var homeStats = document.getElementById('home-quick-stats');
    if (homeStats) {
      homeStats.innerHTML =
        UI.statCard('Overall Attendance', overall + '%', overall >= 75 ? 'Good standing' : 'Needs improvement') +
        UI.statCard('Subjects', subjects.length, 'Currently enrolled') +
        UI.statCard('Classes Attended', totalPresent + '/' + totalClasses, 'This semester');
    }

    var html = '';
    subjects.forEach(function(s) { html += UI.subjectCard(s); });
    document.getElementById('student-subjects').innerHTML = html || '<p style="color:var(--text-muted)">No attendance records found</p>';
  }

  // ── Student Panel Navigation ───────────────────────────────
  function navigateStudent(panel) {
    // Toggle settings: if already in settings, go home
    if (panel === 'settings') {
      var settingsView = document.getElementById('student-settings');
      if (settingsView && settingsView.classList.contains('active')) {
        panel = 'home';
      }
    }

    // Toggle view panels
    document.querySelectorAll('#student-view .view').forEach(function(el) { el.classList.remove('active'); });
    var target = document.getElementById('student-' + panel);
    if (target) target.classList.add('active');

    // Toggle tab active states
    document.querySelectorAll('#student-view .nav-tab[data-sview]').forEach(function(el) { el.classList.remove('active'); });
    var tab = document.querySelector('.nav-tab[data-sview="' + panel + '"]');
    if (tab) tab.classList.add('active');

    // Gear icon spin + light-up
    var gear = document.querySelector('#student-view .btn-icon');
    if (gear) {
      gear.classList.remove('spin-in', 'spin-out', 'active');
      if (panel === 'settings') {
        gear.classList.add('spin-in', 'active');
      } else {
        gear.classList.add('spin-out');
      }
    }

    // Render panel content on first visit
    if (panel === 'fees') renderFees();
    if (panel === 'circulars') renderCirculars();
    if (panel === 'timetable') renderTimetable();
  }

  // ── Fees Renderer (sample data) ────────────────────────────
  function renderFees() {
    var fees = [
      { desc: 'Tuition Fee – Sem 2', amount: '₹45,000', due: '2026-01-15', paid: true },
      { desc: 'Examination Fee', amount: '₹2,500', due: '2026-03-01', paid: true },
      { desc: 'Library Fee', amount: '₹1,000', due: '2026-01-15', paid: true },
      { desc: 'Lab Fee', amount: '₹3,000', due: '2026-01-15', paid: true },
      { desc: 'Tuition Fee – Sem 3', amount: '₹45,000', due: '2026-07-15', paid: false },
      { desc: 'Hostel Fee – Sem 3', amount: '₹18,000', due: '2026-07-15', paid: false }
    ];

    var totalPaid = fees.filter(function(f) { return f.paid; }).length;
    var totalPending = fees.length - totalPaid;

    document.getElementById('fees-summary').innerHTML =
      UI.statCard('Total Fees', fees.length, 'Fee items') +
      UI.statCard('Paid', totalPaid, 'Cleared') +
      UI.statCard('Pending', totalPending, totalPending > 0 ? 'Due soon' : 'All clear');

    var html = '';
    fees.forEach(function(f) {
      var statusHtml = f.paid
        ? '<span class="status status-present">Paid</span>'
        : '<span class="status status-absent">Pending</span>';
      html += '<tr><td>' + f.desc + '</td><td><strong>' + f.amount + '</strong></td><td>' + f.due + '</td><td>' + statusHtml + '</td></tr>';
    });
    document.getElementById('fees-body').innerHTML = html;

    // Payment History
    var history = [
      { date: '2026-01-12', desc: 'Tuition Fee – Sem 2', amount: '₹45,000', method: 'UPI', receipt: 'TU-2026-001' },
      { date: '2026-01-12', desc: 'Library Fee', amount: '₹1,000', method: 'UPI', receipt: 'TU-2026-002' },
      { date: '2026-01-12', desc: 'Lab Fee', amount: '₹3,000', method: 'UPI', receipt: 'TU-2026-003' },
      { date: '2026-02-28', desc: 'Examination Fee', amount: '₹2,500', method: 'Net Banking', receipt: 'TU-2026-004' }
    ];
    var hHtml = '';
    history.forEach(function(h) {
      hHtml += '<tr><td>' + h.date + '</td><td>' + h.desc + '</td><td><strong>' + h.amount + '</strong></td><td>' + h.method + '</td><td style="color:var(--accent);font-weight:500">' + h.receipt + '</td></tr>';
    });
    document.getElementById('fees-history-body').innerHTML = hHtml;
  }

  // ── Fee Tab Switching ──────────────────────────────────────
  function switchFeeTab(tab) {
    document.querySelectorAll('[data-fee]').forEach(function(t) { t.classList.remove('active'); });
    var activeTab = document.querySelector('[data-fee="' + tab + '"]');
    if (activeTab) activeTab.classList.add('active');

    document.getElementById('fee-breakdown-panel').style.display = (tab === 'breakdown') ? '' : 'none';
    document.getElementById('fee-history-panel').style.display = (tab === 'history') ? '' : 'none';
  }

  // ── Circulars Renderer (sample data) ───────────────────────
  function renderCirculars() {
    var circulars = [
      { title: 'Student Meeting Hours', body: 'Vice Chancellor Office (4:30 PM – 5:00 PM). All students are welcome.', date: '27-04-2026' },
      { title: 'Feedback II', body: 'Dear Students, Feedback link 2 will be open from 17.04.2026 to 23.04.2026. Students fill out the feedback form within the date.', date: '17-04-2026' },
      { title: 'Minimum Attendance Requirement for Hall Ticket', body: 'Students who have below 75% attendance will not be eligible to receive their hall ticket for the upcoming examinations. All students are advised to regularly monitor their attendance.', date: '09-04-2026' },
      { title: 'Holiday Notice – Tamil New Year', body: 'The university will remain closed on 14th April 2026 on account of Tamil New Year. Classes will resume on 15th April.', date: '10-04-2026' },
      { title: 'Sports Day Registration', body: 'Registration for Annual Sports Day 2026 is now open. Interested students can register at the Physical Education department before 30th April.', date: '05-04-2026' }
    ];

    var html = '';
    circulars.forEach(function(c) {
      html += '<div class="circular-card">' +
        '<div class="circular-title">' + c.title + '</div>' +
        '<div class="circular-body">' + c.body + '</div>' +
        '<div class="circular-date">' + c.date + '</div>' +
        '</div>';
    });
    document.getElementById('circulars-list').innerHTML = html;
  }

  // ── Timetable Renderer (sample data) ───────────────────────
  function renderTimetable() {
    var schedule = [
      { time: '9:00 – 9:50',  slots: ['Maths', 'English', 'Physics', 'Maths', 'Chemistry', '–'] },
      { time: '10:00 – 10:50', slots: ['English', 'Maths', 'Chemistry', 'Physics', 'English', '–'] },
      { time: '11:00 – 11:50', slots: ['Physics', 'Chemistry', 'Maths', 'English', 'Physics Lab', '–'] },
      { time: '12:00 – 12:30', slots: ['Lunch', 'Lunch', 'Lunch', 'Lunch', 'Lunch', '–'] },
      { time: '12:30 – 1:20',  slots: ['Chemistry', 'Physics Lab', 'English', 'Chemistry', 'Maths', '–'] },
      { time: '1:30 – 2:20',   slots: ['Lab', 'Lab', 'Tutorial', 'Lab', 'Tutorial', '–'] },
      { time: '2:30 – 3:20',   slots: ['Tutorial', '–', 'Sports', 'Tutorial', '–', '–'] }
    ];

    var html = '';
    schedule.forEach(function(row) {
      html += '<tr><td><strong>' + row.time + '</strong></td>';
      row.slots.forEach(function(s) {
        var cls = (s === '–' || s === 'Lunch') ? 'tt-empty' : 'tt-subject';
        html += '<td class="' + cls + '">' + s + '</td>';
      });
      html += '</tr>';
    });
    document.getElementById('timetable-body').innerHTML = html;
  }

  // ── ID Card Renderer ──────────────────────────────────────
  function renderIDCard(user) {
    var name = user.name || '–';
    document.getElementById('id-card-name').textContent = name;
    document.getElementById('id-card-id').textContent = user.id || '–';
    document.getElementById('id-card-dept').textContent = user.department || '–';
    document.getElementById('id-card-year').textContent = user.year || '–';
    document.getElementById('id-card-section').textContent = user.section || '–';
    document.getElementById('id-card-avatar').textContent = name.charAt(0).toUpperCase();
  }

  // ── Theme Switching ───────────────────────────────────────
  let pendingTheme = null;

  // selectTheme: user clicks a theme option — highlight it + enable save button
  function selectTheme(theme) {
    var currentTheme = localStorage.getItem('app-theme') || 'dark';

    // Update active state on theme buttons (visual feedback)
    document.querySelectorAll('.theme-option').forEach(function(el) {
      el.classList.toggle('active', el.dataset.theme === theme);
    });

    // Enable/disable save buttons based on whether it's a new choice
    pendingTheme = theme;
    var changed = theme !== currentTheme;
    document.querySelectorAll('.theme-save-btn').forEach(function(btn) {
      btn.disabled = !changed;
    });
  }

  // saveTheme: user clicks Save — apply the theme
  function saveTheme() {
    if (!pendingTheme) return;
    setTheme(pendingTheme);
    UI.showToast('Theme saved!', 'success');

    // Disable save buttons after saving
    document.querySelectorAll('.theme-save-btn').forEach(function(btn) {
      btn.disabled = true;
    });
    pendingTheme = null;
  }

  // setTheme: actually apply (internal, also kept for backwards compat)
  function setTheme(theme) {
    document.body.className = '';
    if (theme !== 'light') document.body.classList.add('theme-' + theme);
    localStorage.setItem('app-theme', theme);
  }

  function applySavedTheme() {
    var saved = localStorage.getItem('app-theme') || 'dark';
    document.body.className = '';
    if (saved !== 'light') {
      document.body.classList.add('theme-' + saved);
    }
    // Sync active class on all theme buttons
    document.querySelectorAll('.theme-option').forEach(function(el) {
      el.classList.toggle('active', el.dataset.theme === saved);
    });
  }

  // ── Profile / Avatar ──────────────────────────────────────
  function handleAvatarUpload(input, role) {
    var file = input.files && input.files[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      UI.showToast('Please select an image file', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      UI.showToast('Image must be under 2 MB', 'error');
      return;
    }

    var reader = new FileReader();
    reader.onload = function(e) {
      var dataUrl = e.target.result;

      // Save to localStorage
      var user = Auth.getUser();
      var key = 'profile-pic-' + (user ? user.id : role);
      localStorage.setItem(key, dataUrl);

      // Update all avatar elements for this role
      var img = document.getElementById(role + '-profile-pic');
      if (img) { img.src = dataUrl; img.style.display = ''; }
      var placeholder = document.getElementById(role + '-avatar-placeholder');
      if (placeholder) placeholder.style.display = 'none';

      // Also update header badge avatar if exists
      updateHeaderAvatar(role, dataUrl);

      UI.showToast('Profile picture updated!', 'success');
    };
    reader.readAsDataURL(file);
  }

  function updateHeaderAvatar(role, dataUrl) {
    // Find the user-badge in the active view and add a small avatar
    var badgeId = role === 'student' ? 'student-name' : role === 'admin' ? 'admin-user-name' : 'user-name';
    var badge = document.getElementById(badgeId);
    if (badge) {
      var parent = badge.parentElement;
      var existing = parent.querySelector('.header-avatar');
      if (existing) {
        existing.src = dataUrl;
      } else {
        var img = document.createElement('img');
        img.className = 'header-avatar';
        img.src = dataUrl;
        img.style.cssText = 'width:24px;height:24px;border-radius:50%;object-fit:cover;margin-right:6px';
        parent.insertBefore(img, badge);
      }
    }
  }

  function initProfileSection(role) {
    var user = Auth.getUser();
    if (!user) return;

    // Set name, ID, department
    var nameEl = document.getElementById('profile-' + role + '-name');
    var idEl = document.getElementById('profile-' + role + '-id');
    var deptEl = document.getElementById('profile-' + role + '-dept');
    if (nameEl) nameEl.textContent = user.name || role.charAt(0).toUpperCase() + role.slice(1);
    if (idEl) idEl.textContent = 'ID: ' + (user.id || 'N/A');
    if (deptEl) deptEl.textContent = 'Department: ' + (user.department || 'N/A');

    // Set avatar initial
    var initialEl = document.getElementById(role + '-avatar-initial');
    if (initialEl && user.name) initialEl.textContent = user.name.charAt(0).toUpperCase();

    // Load saved profile pic
    var key = 'profile-pic-' + user.id;
    var savedPic = localStorage.getItem(key);
    var img = document.getElementById(role + '-profile-pic');
    var placeholder = document.getElementById(role + '-avatar-placeholder');

    if (savedPic && img) {
      img.src = savedPic;
      img.style.display = '';
      if (placeholder) placeholder.style.display = 'none';
      updateHeaderAvatar(role, savedPic);
    } else {
      if (img) img.style.display = 'none';
      if (placeholder) placeholder.style.display = 'flex';
    }
  }

  // ── Admin Dashboard ────────────────────────────────────────
  async function showAdminDashboard() {
    showView('admin-view');
    var user = Auth.getUser();
    if (user) {
      document.getElementById('admin-name').textContent = user.name || 'Admin';
      var info = document.getElementById('admin-settings-info');
      if (info) info.textContent = 'Signed in as ' + (user.name || 'Admin');
      initProfileSection('admin');
    }
    navigateAdmin('admin-overview');
    UI.showLoading('admin-stats');

    try {
      var data = await API.getAdminOverview();
      if (data.success) {
        document.getElementById('admin-stats').innerHTML =
          UI.statCard('Faculty', data.totalFaculty, 'Registered') +
          UI.statCard('Students', data.totalStudents, 'Enrolled') +
          UI.statCard('Subjects', data.totalSubjects, 'Active') +
          UI.statCard('Records', data.totalRecords, 'Total entries');

        document.getElementById('admin-activity').innerHTML =
          '<div class="stats-grid" style="margin-top:12px">' +
          UI.statCard('Today Marked', data.todayRecords, 'Entries today') +
          UI.statCard('Today Present', data.todayPresent, 'Students present') +
          UI.statCard('Today Absent', data.todayAbsent, 'Need follow-up') +
          '</div>';
      }
    } catch (e) { UI.showToast('Failed to load admin data', 'error'); }

    // Load pending count for badge
    loadPendingCount();
  }

  // ── Admin Navigation ──────────────────────────────────────
  function navigateAdmin(viewName) {
    // Hide all admin views
    document.querySelectorAll('#admin-view .view').forEach(function(el) {
      el.classList.remove('active');
    });
    // Show target
    var target = document.getElementById('view-' + viewName);
    if (target) target.classList.add('active');

    // Update tab active state
    document.querySelectorAll('#admin-view .nav-tab').forEach(function(tab) {
      tab.classList.toggle('active', tab.dataset.view === viewName);
    });

    // Load data for the view
    if (viewName === 'admin-requests') loadEditRequests();
    if (viewName === 'admin-honor') loadHonorScores();
  }

  // ── Pending Count Badge ─────────────────────────────────────
  async function loadPendingCount() {
    try {
      var result = await API.getEditRequests('Pending');
      if (result.success) {
        var badge = document.getElementById('pending-badge');
        if (badge) {
          var count = result.total || 0;
          badge.textContent = count;
          badge.style.display = count > 0 ? 'inline-flex' : 'none';
        }
      }
    } catch (e) { /* silent */ }
  }

  // ── Load Edit Requests (Admin) ─────────────────────────────
  async function loadEditRequests() {
    var filter = document.getElementById('admin-req-filter');
    var filterVal = filter ? filter.value : 'Pending';
    UI.showLoading('admin-requests-body');
    try {
      var result = await API.getEditRequests(filterVal);
      if (result.success) {
        var data = result.data || [];
        var html = '';
        if (data.length === 0) {
          html = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:24px">No ' + filterVal.toLowerCase() + ' requests</td></tr>';
        } else {
          data.forEach(function(r) {
            var recordInfo = r.record ? (r.record.date + ' | ' + r.record.studentID) : ('Row #' + r.rowIndex);
            var statusBadge = '<span class="badge badge-req-' + r.status.toLowerCase() + '">' + r.status + '</span>';
            var actions = '';
            if (r.status === 'Pending') {
              actions = '<button class="btn btn-sm" style="background:#22c55e;color:#fff;border:none;margin-right:4px" onclick="App.handleApproveRequest(\'' + r.requestID + '\')">Approve</button>' +
                        '<button class="btn btn-sm" style="background:#ef4444;color:#fff;border:none" onclick="App.handleDenyRequest(\'' + r.requestID + '\')">Deny</button>';
            } else {
              actions = '<span style="color:var(--text-muted);font-size:0.8rem">' + (r.reviewedBy || '-') + '</span>';
            }
            html += '<tr>' +
              '<td>' + r.facultyName + '</td>' +
              '<td style="font-size:0.82rem">' + recordInfo + '</td>' +
              '<td><span style="text-decoration:line-through;color:var(--text-muted)">' + r.oldStatus + '</span> → <strong>' + r.newStatus + '</strong></td>' +
              '<td style="max-width:200px;font-size:0.82rem">' + r.reason + '</td>' +
              '<td style="font-size:0.8rem">' + (r.timestamp ? new Date(r.timestamp).toLocaleDateString() : '-') + '</td>' +
              '<td>' + actions + '</td>' +
            '</tr>';
          });
        }
        document.getElementById('admin-requests-body').innerHTML = html;
      }
    } catch (e) { UI.showToast('Failed to load edit requests', 'error'); }
  }

  // ── Approve Request (Admin) ────────────────────────────────
  async function handleApproveRequest(requestID) {
    if (!confirm('Approve this edit request? The attendance record will be updated.')) return;
    try {
      var result = await API.approveEditRequest(requestID);
      if (result.success) {
        UI.showToast('Request approved', 'success');
        loadEditRequests();
        loadPendingCount();
      } else {
        UI.showToast(result.error || 'Failed to approve', 'error');
      }
    } catch (e) { UI.showToast('Failed to approve request', 'error'); }
  }

  // ── Deny Request (Admin) ──────────────────────────────────
  async function handleDenyRequest(requestID) {
    var reason = prompt('Enter reason for denying this request:');
    if (reason === null) return;
    if (!reason.trim()) {
      UI.showToast('Please provide a reason for denial', 'error');
      return;
    }
    try {
      var result = await API.denyEditRequest(requestID, reason.trim());
      if (result.success) {
        UI.showToast('Request denied', 'info');
        loadEditRequests();
        loadPendingCount();
      } else {
        UI.showToast(result.error || 'Failed to deny', 'error');
      }
    } catch (e) { UI.showToast('Failed to deny request', 'error'); }
  }

  // ── Load Honor Scores (Admin) ──────────────────────────────
  async function loadHonorScores() {
    UI.showLoading('admin-honor-body');
    try {
      var result = await API.getHonorScores();
      if (result.success) {
        var data = result.data || [];
        var html = '';
        if (data.length === 0) {
          html = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px">No honor score data yet</td></tr>';
        } else {
          data.forEach(function(h) {
            var scoreClass = h.score >= 75 ? 'honor-high' : h.score >= 50 ? 'honor-mid' : h.score >= 25 ? 'honor-low' : 'honor-critical';
            html += '<tr>' +
              '<td>' + h.facultyID + '</td>' +
              '<td>' + h.facultyName + '</td>' +
              '<td><span class="honor-badge ' + scoreClass + '">' + h.score + '</span></td>' +
              '<td>' + h.totalEdits + '</td>' +
              '<td style="font-size:0.8rem">' + (h.lastUpdated ? new Date(h.lastUpdated).toLocaleDateString() : '-') + '</td>' +
            '</tr>';
          });
        }
        document.getElementById('admin-honor-body').innerHTML = html;
      }
    } catch (e) { UI.showToast('Failed to load honor scores', 'error'); }
  }

  // ── Init Edit Request Tab (set date limits + course dropdown) ──
  function initEditReqTab() {
    // Set date picker limits: min = 7 days ago, max = today
    var dateInput = document.getElementById('editreq-date');
    if (dateInput) {
      var today = new Date();
      var sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateInput.max = today.toISOString().split('T')[0];
      dateInput.min = sevenDaysAgo.toISOString().split('T')[0];
      dateInput.value = today.toISOString().split('T')[0];
    }
    // Populate course dropdown (reuse existing courses array)
    var sel = document.getElementById('editreq-course');
    if (sel && courses && courses.length > 0) {
      sel.innerHTML = '<option value="">All Courses</option>';
      courses.forEach(function(c) {
        var label = c.courseCode + (c.courseName ? ' - ' + c.courseName : '');
        sel.innerHTML += '<option value="' + c.courseCode + '">' + label + '</option>';
      });
    }
  }

  // ── Load Records by Date + Course (Student Picker) ─────────
  async function loadEditRecords() {
    var dateVal = document.getElementById('editreq-date').value;
    var courseVal = document.getElementById('editreq-course').value;
    var user = Auth.getUser();

    if (!dateVal) {
      UI.showToast('Please select a date', 'error');
      return;
    }

    var container = document.getElementById('editreq-records-container');
    container.style.display = 'block';
    UI.showLoading('editreq-records-body');

    // Hide the edit form when browsing new records
    document.getElementById('editreq-form-section').style.display = 'none';

    try {
      var result = await API.getRecordsByDateCourse(dateVal, courseVal, user ? user.id : '');
      if (result.success) {
        var data = result.data || [];
        var html = '';
        if (data.length === 0) {
          html = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:20px">No records found for this date/course</td></tr>';
        } else {
          data.forEach(function(r) {
            var statusColor = r.status === 'Present' ? '#22c55e' : r.status === 'Absent' ? '#ef4444' : r.status === 'Late' ? '#f59e0b' : '#6366f1';
            html += '<tr>' +
              '<td style="font-size:0.82rem">' + r.studentID + '</td>' +
              '<td>' + r.studentName + '</td>' +
              '<td><span style="color:' + statusColor + ';font-weight:600">' + r.status + '</span></td>' +
              '<td><button class="btn btn-sm btn-secondary" onclick="App.selectEditRecord(' + r.rowIndex + ', \'' + r.studentID + '\', \'' + r.studentName.replace(/'/g, "\\'") + '\', \'' + r.status + '\')">Edit</button></td>' +
            '</tr>';
          });
        }
        document.getElementById('editreq-records-body').innerHTML = html;
      } else {
        UI.showToast(result.error || 'Failed to load records', 'error');
        document.getElementById('editreq-records-body').innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">' + (result.error || 'Error') + '</td></tr>';
      }
    } catch (e) {
      UI.showToast('Failed to load records', 'error');
    }
  }

  // ── Select a Record for Edit Request ──────────────────────
  function selectEditRecord(rowIndex, studentID, studentName, currentStatus) {
    document.getElementById('editreq-row').value = rowIndex;
    document.getElementById('editreq-selected-info').textContent =
      'Editing: ' + studentName + ' (' + studentID + ') — Current status: ' + currentStatus;
    document.getElementById('editreq-form-section').style.display = 'block';

    // Scroll to the form
    document.getElementById('editreq-form-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ── Submit Edit Request (Faculty) ──────────────────────────
  async function handleSubmitEditRequest() {
    var rowIndex = document.getElementById('editreq-row').value;
    var newStatus = document.getElementById('editreq-status').value;
    var reason = document.getElementById('editreq-reason').value;

    if (!rowIndex || !newStatus) {
      UI.showToast('Please select a student record first', 'error');
      return;
    }
    if (!reason || reason.trim().length < 20) {
      UI.showToast('Reason must be at least 20 characters', 'error');
      return;
    }

    try {
      var result = await API.submitEditRequest({ rowIndex: rowIndex, newStatus: newStatus, reason: reason.trim() });
      if (result.success) {
        UI.showToast('Edit request submitted for admin approval', 'success');
        document.getElementById('editreq-row').value = '';
        document.getElementById('editreq-reason').value = '';
        document.getElementById('editreq-form-section').style.display = 'none';
        loadMyEditRequests();
        loadEditRecords(); // Refresh the list
      } else {
        UI.showToast(result.error || 'Failed to submit request', 'error');
      }
    } catch (e) { UI.showToast('Failed to submit request', 'error'); }
  }

  // ── Load My Edit Requests (Faculty) ────────────────────────
  async function loadMyEditRequests() {
    var user = Auth.getUser();
    if (!user) return;
    try {
      var result = await API.getMyEditRequests(user.id);
      if (result.success) {
        var data = result.data || [];
        var html = '';
        if (data.length === 0) {
          html = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:16px">No requests yet</td></tr>';
        } else {
          data.forEach(function(r) {
            var statusCls = r.status === 'Approved' ? 'badge-req-approved' : r.status === 'Denied' ? 'badge-req-denied' : 'badge-req-pending';
            var studentInfo = r.record && r.record.studentID ? r.record.studentID : 'Row #' + r.rowIndex;
            html += '<tr>' +
              '<td style="font-size:0.82rem">' + studentInfo + '</td>' +
              '<td><span style="text-decoration:line-through;color:var(--text-muted)">' + r.oldStatus + '</span> → ' + r.newStatus + '</td>' +
              '<td style="max-width:180px;font-size:0.82rem">' + r.reason + '</td>' +
              '<td><span class="badge ' + statusCls + '">' + r.status + '</span></td>' +
              '<td style="font-size:0.8rem">' + (r.timestamp ? new Date(r.timestamp).toLocaleDateString() : '-') + '</td>' +
            '</tr>';
          });
        }
        document.getElementById('my-requests-body').innerHTML = html;
      }
    } catch (e) { /* silent */ }
  }

  // ── Faculty Dashboard ──────────────────────────────────────
  async function showFacultyDashboard() {
    showView('app-view');
    var user = Auth.getUser();
    if (user) {
      document.getElementById('user-name').textContent = user.name || 'Faculty';
      var fInfo = document.getElementById('faculty-settings-info');
      if (fInfo) fInfo.textContent = 'Signed in as ' + (user.name || 'Faculty');
      initProfileSection('faculty');
    }

    courses = Auth.getCachedCourses();
    populateCourseDropdowns();

    var cached = Auth.getCachedDashboard();
    if (cached && cached.success !== false) renderDashboard(cached);
    else await loadFreshDashboard();
  }

  async function loadFreshDashboard() {
    var user = Auth.getUser();
    if (!user) return;
    UI.showLoading('dashboard-stats');
    try {
      var data = await API.getDashboardStats(user.id);
      if (data.success) renderDashboard(data);
    } catch (e) { UI.showToast('Failed to load dashboard', 'error'); }
  }

  function renderDashboard(data) {
    document.getElementById('dashboard-stats').innerHTML =
      UI.statCard('Total Courses', data.totalCourses, 'Assigned to you') +
      UI.statCard('Total Students', data.totalStudents, 'Across all courses') +
      UI.statCard('Marked Today', data.todayMarked, data.todayPresent + ' present') +
      UI.statCard('Absent Today', data.todayAbsent, 'Need follow-up');

    var cs = data.courseStats || [];
    if (!cs.length) {
      document.getElementById('dashboard-courses').innerHTML = '<p style="color:var(--text-muted);padding:16px">No courses assigned</p>';
      return;
    }
    var html = '<div class="table-wrapper"><table><thead><tr><th>Code</th><th>Name</th><th>Today</th></tr></thead><tbody>';
    cs.forEach(function(c) {
      html += '<tr><td><strong>' + c.courseCode + '</strong></td><td>' + c.courseName + '</td>' +
        '<td>📋 ' + c.todayPresent + '/' + c.totalStudents + '</td></tr>';
    });
    html += '</tbody></table></div>';
    document.getElementById('dashboard-courses').innerHTML = html;
  }

  // ── Navigation ─────────────────────────────────────────────
  function navigate(view) {
    // Toggle settings: if already in settings, go to dashboard
    if (view === 'settings') {
      var settingsView = document.getElementById('view-settings');
      if (settingsView && settingsView.classList.contains('active')) {
        view = 'dashboard';
      }
    }

    document.querySelectorAll('#app-view .view').forEach(function(el) { el.classList.remove('active'); });
    document.querySelectorAll('#app-view .nav-tab').forEach(function(el) { el.classList.remove('active'); });
    var target = document.getElementById('view-' + view);
    if (target) target.classList.add('active');
    var tab = document.querySelector('.nav-tab[data-view="' + view + '"]');
    if (tab) tab.classList.add('active');

    // Gear icon spin + light-up
    var gear = document.querySelector('#app-view .btn-icon');
    if (gear) {
      gear.classList.remove('spin-in', 'spin-out', 'active');
      if (view === 'settings') {
        gear.classList.add('spin-in', 'active');
      } else {
        gear.classList.add('spin-out');
      }
    }

    if (view === 'dashboard') loadFreshDashboard();
    if (view === 'records') fetchRecords();
    if (view === 'editreq') { initEditReqTab(); loadMyEditRequests(); }
  }

  function populateCourseDropdowns() {
    if (!courses.length) return;
    var opts = UI.courseOptions(courses);
    ['mark-course', 'bulk-course', 'report-course'].forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = opts;
    });
    var filter = document.getElementById('records-course-filter');
    if (filter) {
      var html = '<option value="">All Courses</option>';
      courses.forEach(function(c) { html += '<option value="' + c.courseCode + '">' + c.courseCode + '</option>'; });
      filter.innerHTML = html;
    }
  }

  // ── Mark Single ────────────────────────────────────────────
  async function handleMarkSingle() {
    var courseCode = document.getElementById('mark-course').value;
    var studentID = document.getElementById('mark-student').value.trim();
    var status    = document.getElementById('mark-status').value;
    if (!courseCode || !studentID) { UI.showToast('Select course and enter Student ID', 'error'); return; }
    var btn = document.getElementById('mark-btn');
    btn.disabled = true;
    try {
      var result = await API.markAttendance({ courseCode, studentID, status });
      if (result.success) {
        UI.showToast('Attendance marked: ' + status, 'success');
        Auth.invalidateDashboardCache();
        document.getElementById('mark-student').value = '';
      } else { UI.showToast(result.error || 'Failed', 'error'); }
    } catch (e) { UI.showToast('Network error', 'error'); }
    btn.disabled = false;
  }

  // ── Bulk Attendance ────────────────────────────────────────
  async function loadBulkStudents() {
    var courseCode = document.getElementById('bulk-course').value;
    if (!courseCode) { UI.showToast('Select a course', 'error'); return; }
    UI.showLoading('bulk-list');
    try {
      var result = await API.getStudentsByCourse(courseCode);
      if (result.success) {
        bulkStudents = result.data || [];
        var html = '';
        bulkStudents.forEach(function(s, i) { html += UI.bulkRow(s, i); });
        document.getElementById('bulk-list').innerHTML = html || '<p style="color:var(--text-muted)">No students</p>';
      }
    } catch (e) { UI.showToast('Failed to load students', 'error'); }
  }

  function setBulkStatus(btn) {
    btn.parentElement.querySelectorAll('.status-btn').forEach(function(b) { b.className = 'status-btn'; });
    var status = btn.dataset.status;
    var cls = status === 'Present' ? 'active-present' : status === 'Absent' ? 'active-absent' : status === 'O.D' ? 'active-od' : 'active-late';
    btn.classList.add(cls);
  }

  async function handleBulkSubmit() {
    var courseCode = document.getElementById('bulk-course').value;
    if (!courseCode || !bulkStudents.length) return;
    var records = [];
    document.querySelectorAll('.bulk-row').forEach(function(row) {
      var id = row.dataset.id;
      var activeBtn = row.querySelector('.status-btn[class*="active-"]');
      records.push({ studentID: id, status: activeBtn ? activeBtn.dataset.status : 'Present' });
    });
    var btn = document.getElementById('bulk-submit-btn');
    btn.disabled = true; btn.innerHTML = '<div class="spinner"></div> Submitting...';
    try {
      var result = await API.markBulkAttendance(courseCode, records);
      if (result.success) { UI.showToast('Saved! (' + records.length + ' records)', 'success'); Auth.invalidateDashboardCache(); }
      else UI.showToast(result.error || 'Failed', 'error');
    } catch (e) { UI.showToast('Network error', 'error'); }
    btn.disabled = false; btn.innerHTML = '🚀 Submit All';
  }

  // ── Records ────────────────────────────────────────────────
  async function fetchRecords() {
    var courseCode = document.getElementById('records-course-filter').value;
    var date = document.getElementById('records-date-filter').value;
    var user = Auth.getUser();
    UI.showLoading('records-body');
    try {
      var params = {};
      if (courseCode) params.courseCode = courseCode;
      if (date) params.date = date;
      if (user && user.id) params.facultyID = user.id;
      var result = await API.getAttendance(params);
      if (result.success) {
        var rows = result.data || [];
        document.getElementById('records-count').textContent = rows.length + ' records';
        if (!rows.length) { document.getElementById('records-body').innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">No records</td></tr>'; return; }
        var html = '';
        rows.forEach(function(r) {
          html += '<tr><td>' + (r.date || r[0] || '') + '</td><td>' + (r.course || r[1] || '') + '</td><td>' + (r.studentID || r[2] || '') + '</td><td>' + (r.facultyID || r[3] || '') + '</td><td>' + UI.statusBadge(r.status || r[4] || '') + '</td></tr>';
        });
        document.getElementById('records-body').innerHTML = html;
      }
    } catch (e) { UI.showToast('Failed to load records', 'error'); }
  }

  // ── Reports ────────────────────────────────────────────────
  async function generateReport() {
    var courseCode = document.getElementById('report-course').value;
    var startDate = document.getElementById('report-start').value;
    var endDate   = document.getElementById('report-end').value;
    if (!courseCode) { UI.showToast('Select a course', 'error'); return; }
    UI.showLoading('report-body');
    try {
      var result = await API.getCourseReport(courseCode, startDate, endDate);
      if (result.success) {
        var report = result.report || [];
        document.getElementById('report-summary').innerHTML =
          UI.statCard('Students', report.length, 'In this course') +
          UI.statCard('Classes', (result.dates || []).length, 'Total sessions');
        var html = '';
        report.forEach(function(r) {
          html += '<tr><td>' + r.studentID + '</td><td>' + r.name + '</td><td>' + r.totalClasses + '</td><td>' + r.present + '</td><td>' + r.absent + '</td><td>' + UI.pctBadge(r.percentage) + '</td></tr>';
        });
        document.getElementById('report-body').innerHTML = html || '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">No data</td></tr>';
      }
    } catch (e) { UI.showToast('Failed to generate report', 'error'); }
  }

  // ── Logout ─────────────────────────────────────────────────
  async function handleLogout() {
    await FireAuth.signOut();
    await Auth.logout();
    showView('role-view');
    UI.showToast('Logged out', 'info');
  }

  // ── Boot ───────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', init);

  return {
    selectRole, showRoleSelect, switchAuthTab,
    handleSendOTP, handleVerifyOTP, resetPhoneAuth,
    handleGoogleSignIn, handleEmailLogin,
    navigate, navigateStudent, navigateAdmin, handleLogout,
    handleMarkSingle, loadBulkStudents, setBulkStatus,
    handleBulkSubmit, fetchRecords, generateReport,
    setTheme, selectTheme, saveTheme, switchFeeTab,
    handleAvatarUpload,
    handleSubmitEditRequest, loadEditRequests, loadEditRecords, loadHonorScores,
    handleApproveRequest, handleDenyRequest, selectEditRecord
  };
})();
