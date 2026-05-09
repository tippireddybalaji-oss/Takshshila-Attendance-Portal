// ============================================================
// firebase-auth.js – Firebase Auth (Phone OTP + Google Sign-In)
// ============================================================

const FireAuth = (() => {
  const firebaseConfig = {
    apiKey: "AIzaSyDmJ_cOyEnA90ctc9FU_jHnsZedN1J5Mtc",
    authDomain: "takshashila-attendance.firebaseapp.com",
    projectId: "takshashila-attendance",
    storageBucket: "takshashila-attendance.firebasestorage.app",
    messagingSenderId: "497461417214",
    appId: "1:497461417214:web:018ad55c4b477d182981af"
  };

  let app = null;
  let auth = null;
  let confirmationResult = null;
  let recaptchaVerifier = null;

  function init() {
    if (app) return;
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    auth.useDeviceLanguage();
  }

  function setupRecaptcha(buttonId) {
    if (recaptchaVerifier) {
      recaptchaVerifier.clear();
      recaptchaVerifier = null;
    }
    recaptchaVerifier = new firebase.auth.RecaptchaVerifier(buttonId, {
      size: 'invisible',
      callback: function() { /* solved */ }
    });
    return recaptchaVerifier;
  }

  /**
   * Send OTP to phone number.
   * @param {string} phone – e.g. "+919876543210"
   * @param {string} buttonId – element ID for reCAPTCHA
   */
  async function sendOTP(phone, buttonId) {
    init();
    if (!phone.startsWith('+')) phone = '+91' + phone;

    var verifier = setupRecaptcha(buttonId);
    try {
      confirmationResult = await auth.signInWithPhoneNumber(phone, verifier);
      return { success: true };
    } catch (err) {
      console.error('OTP send error:', err);
      if (recaptchaVerifier) { recaptchaVerifier.clear(); recaptchaVerifier = null; }
      var msg = 'Failed to send OTP';
      if (err.code === 'auth/invalid-phone-number') msg = 'Invalid phone number format';
      if (err.code === 'auth/too-many-requests') msg = 'Too many attempts. Try again later.';
      if (err.code === 'auth/quota-exceeded') msg = 'SMS quota exceeded. Try Google Sign-In instead.';
      return { success: false, error: msg };
    }
  }

  /**
   * Verify OTP code.
   * @param {string} code – 6-digit OTP
   */
  async function verifyOTP(code) {
    if (!confirmationResult) return { success: false, error: 'No OTP was sent' };
    try {
      var result = await confirmationResult.confirm(code);
      return {
        success: true,
        user: result.user,
        phone: result.user.phoneNumber,
        uid: result.user.uid
      };
    } catch (err) {
      console.error('OTP verify error:', err);
      var msg = 'Invalid OTP code';
      if (err.code === 'auth/code-expired') msg = 'OTP expired. Please resend.';
      return { success: false, error: msg };
    }
  }

  /**
   * Google Sign-In popup.
   */
  async function signInWithGoogle() {
    init();
    var provider = new firebase.auth.GoogleAuthProvider();
    try {
      var result = await auth.signInWithPopup(provider);
      return {
        success: true,
        user: result.user,
        email: result.user.email,
        name: result.user.displayName,
        uid: result.user.uid
      };
    } catch (err) {
      console.error('Google sign-in error:', err);
      var msg = 'Google sign-in failed';
      if (err.code === 'auth/popup-closed-by-user') msg = 'Sign-in popup was closed';
      if (err.code === 'auth/popup-blocked') msg = 'Popup blocked. Please allow popups.';
      return { success: false, error: msg };
    }
  }

  /**
   * Sign out from Firebase.
   */
  async function signOut() {
    if (auth) {
      try { await auth.signOut(); } catch (e) { /* ignore */ }
    }
  }

  /**
   * Get current Firebase user.
   */
  function getCurrentUser() {
    return auth ? auth.currentUser : null;
  }

  return { init, sendOTP, verifyOTP, signInWithGoogle, signOut, getCurrentUser };
})();
