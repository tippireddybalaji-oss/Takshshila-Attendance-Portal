# Takshashila Attendance Portal
## End-to-End Documentation

---

### 1. Project Overview
The Takshashila Attendance Portal is a comprehensive web-based application designed to manage student attendance, track faculty records, and provide administrative oversight. The project utilizes a serverless architecture with a Vanilla JS/HTML/CSS frontend, Firebase for secure authentication, and Google Apps Script (acting as the backend API) interfacing with Google Sheets as the database.

### 2. Architecture & Technology Stack
*   **Frontend:** HTML5, Vanilla CSS3 (Custom Design System with multiple themes), Vanilla JavaScript.
*   **Backend API:** Google Apps Script (`.gs` files).
*   **Database:** Google Sheets (Tables for Students, Faculty, Courses, Attendance Records, and Edit Requests).
*   **Authentication:** Firebase Authentication (Google Sign-In & Phone Number OTP).
*   **Storage (Temporary/Local):** `localStorage` for session management and user avatars.

### 3. Core Features & Roles

#### 3.1 Student Portal
*   **Dashboard:** View overall attendance percentage and recent classes.
*   **Reports:** Check subject-wise attendance breakdowns.
*   **Profile:** Manage personal details and upload an avatar.

#### 3.2 Faculty Portal
*   **Dashboard:** Quick overview of assigned courses.
*   **Mark Attendance:** Interface to mark students present/absent for specific dates and courses.
*   **Edit Requests:** Faculty cannot directly alter past attendance. They must submit an "Edit Request" for past records (limited to a 7-day window and 5 active requests).
*   **Honor Score:** A gamified trust system. Excessive edit requests negatively impact the faculty's Honor Score.
*   **Profile:** Manage themes and visual preferences.

#### 3.3 Admin Portal
*   **System Overview:** Bird's-eye view of total students, faculties, and overall system health.
*   **Request Management:** Review, approve, or reject attendance edit requests submitted by faculty.
*   **Audit Logging:** Track critical system changes and actions.
*   **User Management:** Oversee student and faculty records.

### 4. Database Schema (Google Sheets)
The Google Sheets database consists of the following key sheets:
1.  **Users:** Stores basic user credentials and role mappings.
2.  **Students:** Student profiles, IDs, and assigned branches.
3.  **Faculty:** Faculty details and calculated Honor Scores.
4.  **Courses:** Course mappings linking students and faculties to subjects.
5.  **Attendance_Records:** The core ledger storing every attendance interaction (Date, Course, Student, Status).
6.  **Edit_Requests:** Logs all modification requests from faculty (Status: Pending, Approved, Rejected).
7.  **Audit_Logs:** Tracks system-wide administrative actions for security.

### 5. Authentication Flow
1.  **Login Interface:** Users access the portal via Firebase UI.
2.  **Verification:** Firebase handles the initial Google OAuth or Mobile OTP verification.
3.  **Role Resolution:** Once Firebase authenticates the user, the app calls the Google Apps Script backend (`Auth.gs`) to resolve the user's role (Admin, Faculty, or Student) based on their registered email/phone in the database.
4.  **Session:** The role and user data are cached securely in `sessionStorage` and `localStorage` to persist state across refreshes.

### 6. Deployment Guidelines

#### 6.1 Backend (Google Apps Script)
1.  Open the Google Apps Script editor.
2.  Click **Deploy** > **New Deployment**.
3.  Select **Web App**.
4.  Execute as: **Me**.
5.  Who has access: **Anyone**.
6.  Copy the generated Web App URL and paste it into `js/api.js` (`const SCRIPT_URL = '...'`).

#### 6.2 Frontend (Netlify / Vercel)
1.  Push the project repository to GitHub.
2.  Connect the repository to Netlify or Vercel.
3.  Deploy the main branch. (No build step is required for Vanilla JS).

#### 6.3 Firebase Authentication (Crucial Post-Deployment Step)
**Important:** For Google Sign-In and Phone OTP to work on your live Netlify domain, you **must** whitelist your new domain:
1.  Go to the [Firebase Console](https://console.firebase.google.com/).
2.  Navigate to **Authentication** > **Settings** > **Authorized domains**.
3.  Click **Add Domain** and enter your Netlify domain (e.g., `your-app.netlify.app`).

### 7. Recent Enhancements
*   **UI/UX Overhaul:** Implemented an application-driven orange accent palette. Removed legacy "cream" styling for a modern, sleek interface.
*   **Toast Notifications:** Redesigned to slide in from the bottom-right with glassmorphism effects and clean typography (emojis removed).
*   **Profile System:** Added persistent local avatar uploads and a reactive "Save Theme" workflow.

---
*Documentation auto-generated for the Takshashila Attendance Portal.*
