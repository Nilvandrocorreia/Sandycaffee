// auth.js — login form handler + auth utilities

// ─── Login Page ───────────────────────────────────────────────────────────────
if (document.getElementById('loginForm')) {
  // If already logged in, redirect
  const existingToken = localStorage.getItem('token');
  if (existingToken) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    redirectByRole(user.role);
  }

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const alert = document.getElementById('alert');
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    alert.classList.remove('show');
    btn.disabled = true;
    btn.textContent = 'Signing in…';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      redirectByRole(data.user.role);
    } catch (err) {
      alert.textContent = err.message;
      alert.classList.add('show');
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}

function redirectByRole(role) {
  if (role === 'administrator') window.location.href = '/dashboard.html';
  else if (role === 'cashier') window.location.href = '/pos.html';
  else if (role === 'kitchen') window.location.href = '/kitchen.html';
  else window.location.href = '/pos.html';
}

// ─── Auth Utilities (used by all admin pages) ─────────────────────────────────

// Decode JWT payload without verifying signature (client-side expiry check only)
function _decodeToken(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

function requireAuth() {
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = '/login.html'; return null; }

  // Check local expiry — if expired, clear and redirect immediately
  const decoded = _decodeToken(token);
  if (!decoded || decoded.exp * 1000 < Date.now()) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
    return null;
  }
  return token;
}

function getUser() {
  return JSON.parse(localStorage.getItem('user') || '{}');
}

function getToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login.html';
}

// API helper — auto-stores refreshed tokens, redirects to login on 401
async function api(method, url, body) {
  const opts = { method, headers: authHeaders() };
  if (body) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(url, opts);
  } catch (err) {
    throw new Error('Network error — check your connection');
  }

  // Pick up a server-issued refreshed token
  const refreshedToken = res.headers.get('X-Refresh-Token');
  if (refreshedToken) {
    localStorage.setItem('token', refreshedToken);
  }

  // On 401, session is dead — send user back to login
  if (res.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
    return;
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API error');
  return data;
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ─── Sidebar initialisation (called by each admin page) ──────────────────────
function initSidebar(activePage) {
  const user = getUser();

  // Inject sidebar HTML
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  sidebar.innerHTML = `
    <div class="sidebar-logo">
      <h2>☕ Sandycaffee</h2>
      <span>POS System</span>
    </div>
    <ul class="sidebar-nav">
      <li><a href="/dashboard.html" class="${activePage === 'dashboard' ? 'active' : ''}"><span class="nav-icon">🏠</span>Dashboard</a></li>
      <li id="navUsers" style="display:none"><a href="/users.html" class="${activePage === 'users' ? 'active' : ''}"><span class="nav-icon">👥</span>Users</a></li>
      <li><a href="/categories.html" class="${activePage === 'categories' ? 'active' : ''}"><span class="nav-icon">📂</span>Categories</a></li>
      <li><a href="/products.html" class="${activePage === 'products' ? 'active' : ''}"><span class="nav-icon">🛍️</span>Products</a></li>
      <li><a href="/meals.html" class="${activePage === 'meals' ? 'active' : ''}"><span class="nav-icon">🍽️</span>Meals</a></li>
      <li><a href="/tables.html" class="${activePage === 'tables' ? 'active' : ''}"><span class="nav-icon">🪑</span>Tables & QR</a></li>
      <li><a href="/pos.html" class="${activePage === 'pos' ? 'active' : ''}"><span class="nav-icon">💰</span>POS / Till</a></li>
      <li><a href="/kitchen.html" class="${activePage === 'kitchen' ? 'active' : ''}"><span class="nav-icon">👨‍🍳</span>Kitchen</a></li>
      <li><a href="/inventory.html" class="${activePage === 'inventory' ? 'active' : ''}"><span class="nav-icon">📦</span>Inventory</a></li>
      <li><a href="/reports.html" class="${activePage === 'reports' ? 'active' : ''}"><span class="nav-icon">📊</span>Reports</a></li>
      <li><a href="#" onclick="logout();return false;"><span class="nav-icon">🚪</span>Logout</a></li>
    </ul>
    <div class="sidebar-footer">Sandycaffee POS v1.0</div>
  `;

  // Show users link only for admin
  if (user.role === 'administrator') {
    const navUsers = document.getElementById('navUsers');
    if (navUsers) navUsers.style.display = '';
  }

  // Topbar user info
  const userNameEl = document.getElementById('topbarUserName');
  const userAvatarEl = document.getElementById('topbarAvatar');
  if (userNameEl) userNameEl.textContent = user.name || 'User';
  if (userAvatarEl) userAvatarEl.textContent = (user.name || 'U')[0].toUpperCase();
}

// Format currency
function formatCurrency(val) {
  return '£' + (parseFloat(val) || 0).toFixed(2);
}

// Format date
function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}
