requireAuth();
initSidebar('products');

let editingId = null;
let productsData = [];
let categoriesData = [];

async function loadData() {
  try {
    [productsData, categoriesData] = await Promise.all([
      api('GET', '/api/products'),
      api('GET', '/api/categories')
    ]);
    renderTable();
    populateCategorySelect();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderTable() {
  const tbody = document.getElementById('productTableBody');
  if (productsData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🛍️</div><p>No products yet</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = productsData.map(p => {
    const isLow = p.stock <= p.min_stock;
    const stockBadge = isLow
      ? `<span class="badge badge-danger">${p.stock} <small>LOW</small></span>`
      : `<span class="badge badge-success">${p.stock}</span>`;
    const photo = p.photo
      ? `<img src="${p.photo}" class="img-thumb" alt="${p.name}">`
      : `<div style="width:44px;height:44px;border-radius:6px;background:rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:center;font-size:1.4rem;">${p.category_emoji || '🍽️'}</div>`;
    return `<tr>
      <td>${photo}</td>
      <td><strong>${p.name}</strong></td>
      <td>${p.category_name ? `<span class="badge badge-secondary">${p.category_emoji || ''} ${p.category_name}</span>` : '<span class="text-muted">—</span>'}</td>
      <td>${formatCurrency(p.price)}</td>
      <td>${stockBadge}</td>
      <td><span class="badge badge-${p.active ? 'success' : 'secondary'}">${p.active ? 'Active' : 'Hidden'}</span></td>
      <td style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-sm btn-secondary" onclick="editProduct(${p.id})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

function populateCategorySelect() {
  const sel = document.getElementById('fCategory');
  const current = sel.value;
  sel.innerHTML = '<option value="">— None —</option>' +
    categoriesData.map(c => `<option value="${c.id}">${c.emoji} ${c.name}</option>`).join('');
  if (current) sel.value = current;
}

function openModal() {
  editingId = null;
  document.getElementById('modalTitle').textContent = 'Add Product';
  document.getElementById('fName').value = '';
  document.getElementById('fPrice').value = '';
  document.getElementById('fCategory').value = '';
  document.getElementById('fStock').value = '0';
  document.getElementById('fMinStock').value = '5';
  document.getElementById('fPhoto').value = '';
  document.getElementById('photoPreview').innerHTML = '';
  document.getElementById('activeGroup').style.display = 'none';
  document.getElementById('modalAlert').style.display = 'none';
  document.getElementById('modalOverlay').classList.add('open');
}

function editProduct(id) {
  const p = productsData.find(x => x.id === id);
  if (!p) return;
  editingId = id;
  document.getElementById('modalTitle').textContent = 'Edit Product';
  document.getElementById('fName').value = p.name;
  document.getElementById('fPrice').value = p.price;
  document.getElementById('fCategory').value = p.category_id || '';
  document.getElementById('fStock').value = p.stock;
  document.getElementById('fMinStock').value = p.min_stock;
  document.getElementById('fPhoto').value = '';
  document.getElementById('photoPreview').innerHTML = p.photo ? `<img src="${p.photo}" style="height:60px;border-radius:6px;margin-top:4px;">` : '';
  document.getElementById('fActive').checked = !!p.active;
  document.getElementById('activeGroup').style.display = '';
  document.getElementById('modalAlert').style.display = 'none';
  document.getElementById('modalOverlay').classList.add('open');
}

// Photo preview
document.getElementById('fPhoto').addEventListener('change', function() {
  const file = this.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = e => { document.getElementById('photoPreview').innerHTML = `<img src="${e.target.result}" style="height:60px;border-radius:6px;margin-top:4px;">`; };
    reader.readAsDataURL(file);
  }
});

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  editingId = null;
}

async function saveProduct() {
  const alertEl = document.getElementById('modalAlert');
  alertEl.style.display = 'none';

  const formData = new FormData();
  formData.append('name', document.getElementById('fName').value.trim());
  formData.append('price', document.getElementById('fPrice').value);
  formData.append('category_id', document.getElementById('fCategory').value);
  formData.append('stock', document.getElementById('fStock').value);
  formData.append('min_stock', document.getElementById('fMinStock').value);
  if (editingId) formData.append('active', document.getElementById('fActive').checked ? 1 : 0);
  const photoFile = document.getElementById('fPhoto').files[0];
  if (photoFile) formData.append('photo', photoFile);

  try {
    const token = getToken();
    const url = editingId ? `/api/products/${editingId}` : '/api/products';
    const method = editingId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Authorization': `Bearer ${token}` }, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');
    showToast(editingId ? 'Product updated' : 'Product created', 'success');
    closeModal();
    loadData();
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
    alertEl.className = 'alert alert-danger';
  }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  try {
    await api('DELETE', `/api/products/${id}`);
    showToast('Product deleted', 'success');
    loadData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

loadData();
