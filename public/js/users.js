requireAuth();
const user = getUser();
if (user.role !== 'administrator') window.location.href = '/dashboard.html';
initSidebar('users');

let editingId = null;
let usersData = [];

async function loadUsers() {
  try {
    usersData = await api('GET', '/api/users');
    renderTable();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderTable() {
  const tbody = document.getElementById('userTableBody');
  if (usersData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">👥</div><p>No users found</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = usersData.map(u => `
    <tr>
      <td><strong>${u.name}</strong></td>
      <td>${u.email}</td>
      <td><span class="badge badge-${roleColour(u.role)}">${u.role}</span></td>
      <td><span class="badge badge-${u.active ? 'success' : 'danger'}">${u.active ? 'Active' : 'Inactive'}</span></td>
      <td>${formatDate(u.created_at)}</td>
      <td>
        <button class="btn btn-sm btn-secondary" onclick="editUser(${u.id})">Edit</button>
        ${u.active ? `<button class="btn btn-sm btn-danger" onclick="deactivateUser(${u.id})">Deactivate</button>` : ''}
      </td>
    </tr>
  `).join('');
}

function roleColour(role) {
  return { administrator: 'danger', cashier: 'info', kitchen: 'warning' }[role] || 'secondary';
}

function openModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Add User';
  document.getElementById('userForm').reset();
  document.getElementById('fPassword').placeholder = '';
  document.getElementById('fPassword').required = true;
  document.getElementById('passwordLabel').textContent = 'Password *';
  document.getElementById('activeGroup').style.display = 'none';
  document.getElementById('modalAlert').style.display = 'none';
  document.getElementById('modalOverlay').classList.add('open');
}

function editUser(id) {
  const u = usersData.find(x => x.id === id);
  if (!u) return;
  editingId = id;
  document.getElementById('modalTitle').textContent = 'Edit User';
  document.getElementById('fName').value = u.name;
  document.getElementById('fEmail').value = u.email;
  document.getElementById('fRole').value = u.role;
  document.getElementById('fPassword').value = '';
  document.getElementById('fPassword').placeholder = 'Leave blank to keep current';
  document.getElementById('fPassword').required = false;
  document.getElementById('passwordLabel').textContent = 'Password';
  document.getElementById('fActive').checked = !!u.active;
  document.getElementById('activeGroup').style.display = '';
  document.getElementById('modalAlert').style.display = 'none';
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  editingId = null;
}

async function saveUser() {
  const alertEl = document.getElementById('modalAlert');
  alertEl.style.display = 'none';
  const body = {
    name: document.getElementById('fName').value.trim(),
    email: document.getElementById('fEmail').value.trim(),
    role: document.getElementById('fRole').value,
    active: document.getElementById('fActive') ? (document.getElementById('fActive').checked ? 1 : 0) : 1
  };
  const pw = document.getElementById('fPassword').value;
  if (pw) body.password = pw;
  if (!editingId && !pw) { alertEl.textContent = 'Password is required for new users'; alertEl.style.display = 'block'; alertEl.className = 'alert alert-danger'; return; }

  try {
    if (editingId) {
      await api('PUT', `/api/users/${editingId}`, body);
      showToast('User updated', 'success');
    } else {
      await api('POST', '/api/users', body);
      showToast('User created', 'success');
    }
    closeModal();
    loadUsers();
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
    alertEl.className = 'alert alert-danger';
  }
}

async function deactivateUser(id) {
  if (!confirm('Deactivate this user?')) return;
  try {
    await api('DELETE', `/api/users/${id}`);
    showToast('User deactivated', 'success');
    loadUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

loadUsers();
