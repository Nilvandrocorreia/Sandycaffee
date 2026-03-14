requireAuth();
initSidebar('categories');

let editingId = null;
let categoriesData = [];

async function loadCategories() {
  try {
    categoriesData = await api('GET', '/api/categories');
    renderGrid();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderGrid() {
  const grid = document.getElementById('categoryGrid');
  if (categoriesData.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📂</div><p>No categories yet</p></div>';
    return;
  }
  grid.innerHTML = categoriesData.map(c => `
    <div class="category-card">
      <div class="cat-emoji">${c.emoji}</div>
      <div class="cat-name">${c.name}</div>
      <div class="cat-swatch" style="background:${c.colour}"></div>
      ${c.sends_to_kitchen ? '<div style="font-size:0.75rem;color:#e67e22;font-weight:600;">🍳 Kitchen</div>' : ''}
      <div class="cat-actions">
        <button class="btn btn-sm btn-secondary" onclick="editCategory(${c.id})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteCategory(${c.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

function openModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Add Category';
  document.getElementById('fName').value = '';
  document.getElementById('fEmoji').value = '';
  document.getElementById('fColour').value = '#FF8C00';
  document.getElementById('fKitchen').checked = false;
  document.getElementById('modalAlert').style.display = 'none';
  document.getElementById('modalOverlay').classList.add('open');
}

function editCategory(id) {
  const c = categoriesData.find(x => x.id === id);
  if (!c) return;
  editingId = id;
  document.getElementById('modalTitle').textContent = 'Edit Category';
  document.getElementById('fName').value = c.name;
  document.getElementById('fEmoji').value = c.emoji;
  document.getElementById('fColour').value = c.colour;
  document.getElementById('fKitchen').checked = !!c.sends_to_kitchen;
  document.getElementById('modalAlert').style.display = 'none';
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  editingId = null;
}

async function saveCategory() {
  const alertEl = document.getElementById('modalAlert');
  alertEl.style.display = 'none';
  const body = {
    name: document.getElementById('fName').value.trim(),
    emoji: document.getElementById('fEmoji').value.trim() || '🍽️',
    colour: document.getElementById('fColour').value,
    sends_to_kitchen: document.getElementById('fKitchen').checked ? 1 : 0
  };
  if (!body.name) { alertEl.textContent = 'Name is required'; alertEl.style.display = 'block'; alertEl.className = 'alert alert-danger'; return; }
  try {
    if (editingId) {
      await api('PUT', `/api/categories/${editingId}`, body);
      showToast('Category updated', 'success');
    } else {
      await api('POST', '/api/categories', body);
      showToast('Category created', 'success');
    }
    closeModal();
    loadCategories();
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
    alertEl.className = 'alert alert-danger';
  }
}

async function deleteCategory(id) {
  if (!confirm('Delete this category?')) return;
  try {
    await api('DELETE', `/api/categories/${id}`);
    showToast('Category deleted', 'success');
    loadCategories();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

loadCategories();
