/* Main Application Router & Entry Point — Amazon Client System */
import { initUnifiedDashboard } from './unifiedDashboard.js';

const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 Hour (60 minutes) Inactivity Expiry

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast-msg';
  const icon = type === 'success' ? '✅' : type === 'warning' ? '⚠️' : '⚡';
  toast.innerHTML = `<span>${icon}</span> ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function resetActivityTimer() {
  if (sessionStorage.getItem('acs_logged_in') === 'true') {
    sessionStorage.setItem('acs_last_activity', Date.now().toString());
  }
}

function checkAuthAndActivity() {
  const isLoggedIn = sessionStorage.getItem('acs_logged_in') === 'true';
  const lastActivity = parseInt(sessionStorage.getItem('acs_last_activity') || '0', 10);
  const now = Date.now();

  if (!isLoggedIn || !lastActivity || (now - lastActivity > INACTIVITY_TIMEOUT_MS)) {
    sessionStorage.clear();
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

function startApplication() {
  // 1. Strict Auth Guard: Redirect to login.html if not logged in or idle > 1 hr
  if (!checkAuthAndActivity()) return;

  // 2. Refresh activity timestamp on user interactions
  ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, resetActivityTimer, { passive: true });
  });

  // 3. Periodic idle checker every 15 seconds
  setInterval(() => {
    checkAuthAndActivity();
  }, 15000);

  const appRoot = document.getElementById('appContainer');
  if (appRoot) {
    initUnifiedDashboard(appRoot, showToast);
    showToast('Amazon Client System — Authenticated Portal Active', 'success');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApplication);
} else {
  startApplication();
}
