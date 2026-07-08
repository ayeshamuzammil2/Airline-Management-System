const API = '/api';

function toast(message, type = 'success') {
  let stack = document.getElementById('toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toast-stack';
    document.body.appendChild(stack);
  }
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'error' : ''}`;
  el.innerHTML = `<i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check'}"></i><p>${message}</p>`;
  stack.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s ease, transform .3s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateX(30px)';
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

function getSession() {
  try { return JSON.parse(localStorage.getItem('sky_session')); } catch { return null; }
}
function setSession(role, user) { localStorage.setItem('sky_session', JSON.stringify({ role, user })); }
function clearSession() { localStorage.removeItem('sky_session'); }

function requireRole(expectedRole) {
  const session = getSession();
  if (!session || session.role !== expectedRole) {
    window.location.href = 'login.html';
    return null;
  }
  return session;
}

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function formatTime(d) {
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
function formatMoney(n) {
  return 'PKR ' + Number(n).toLocaleString();
}
function durationBetween(dep, arr) {
  const ms = new Date(arr) - new Date(dep);
  const h = Math.floor(ms / 3600000);
  const m = Math.round((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}
function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}
