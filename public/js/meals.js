requireAuth();
initSidebar('meals');

let editingId = null;
let mealsData = [];
let productsData = [];
let mealItems = [];

async function loadData() {
  try {
    [mealsData, productsData] = await Promise.all([
      api('GET', '/api/meals'),
      api('GET', '/api/products')
    ]);
    renderMeals();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderMeals() {
  const el = document.getElementById('mealsList');
  if (mealsData.length === 0) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">🍽️</div><p>No meals yet</p></div>';
    return;
  }
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Price</th><th>Description</th><th>Items</th><th>Status</th><th>Actions</th></tr></thead>
    <tbody>${mealsData.map(m => `
      <tr>
        <td><strong>${m.name}</strong></td>
        <td>${formatCurrency(m.price)}</td>
        <td><span class="text-muted">${m.description || '—'}</span></td>
        <td>${(m.items || []).map(i => `<span class="badge badge-secondary" style="margin:2px;">${i.quantity}x ${i.product_name}</span>`).join('')}</td>
        <td><span class="badge badge-${m.active ? 'success' : 'secondary'}">${m.active ? 'Active' : 'Hidden'}</span></td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="editMeal(${m.id})">Edit</button>
          <button class="btn btn-sm btn-danger" onclick="deleteMeal(${m.id})">Delete</button>
        </td>
      </tr>`).join('')}
    </tbody></table></div>`;
}

function openModal() {
  editingId = null;
  mealItems = [];
  document.getElementById('modalTitle').textContent = 'Add Meal';
  document.getElementById('fName').value = '';
  document.getElementById('fPrice').value = '';
  document.getElementById('fDescription').value = '';
  document.getElementById('modalAlert').style.display = 'none';
  renderMealItems();
  document.getElementById('modalOverlay').classList.add('open');
}

function editMeal(id) {
  const m = mealsData.find(x => x.id === id);
  if (!m) return;
  editingId = id;
  mealItems = (m.items || []).map(i => ({ product_id: i.product_id, quantity: i.quantity }));
  document.getElementById('modalTitle').textContent = 'Edit Meal';
  document.getElementById('fName').value = m.name;
  document.getElementById('fPrice').value = m.price;
  document.getElementById('fDescription').value = m.description || '';
  document.getElementById('modalAlert').style.display = 'none';
  renderMealItems();
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  editingId = null;
  mealItems = [];
}

function addMealItem() {
  mealItems.push({ product_id: productsData[0]?.id || '', quantity: 1 });
  renderMealItems();
}

function removeMealItem(idx) {
  mealItems.splice(idx, 1);
  renderMealItems();
}

function renderMealItems() {
  const el = document.getElementById('mealItemsList');
  if (mealItems.length === 0) {
    el.innerHTML = '<p class="text-muted" style="font-size:0.85rem;">No items added yet</p>';
    return;
  }
  el.innerHTML = mealItems.map((item, idx) => `
    <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">
      <select class="form-control" onchange="mealItems[${idx}].product_id=parseInt(this.value)" style="flex:1;">
        ${productsData.map(p => `<option value="${p.id}" ${p.id == item.product_id ? 'selected' : ''}>${p.name}</option>`).join('')}
      </select>
      <input type="number" class="form-control" value="${item.quantity}" min="1" style="width:70px;"
        onchange="mealItems[${idx}].quantity=parseInt(this.value)||1">
      <button type="button" class="btn btn-sm btn-danger btn-icon" onclick="removeMealItem(${idx})">✕</button>
    </div>
  `).join('');
}

async function saveMeal() {
  const alertEl = document.getElementById('modalAlert');
  alertEl.style.display = 'none';
  const body = {
    name: document.getElementById('fName').value.trim(),
    price: parseFloat(document.getElementById('fPrice').value),
    description: document.getElementById('fDescription').value.trim(),
    items: mealItems.filter(i => i.product_id)
  };
  if (!body.name) { alertEl.textContent = 'Name required'; alertEl.style.display = 'block'; alertEl.className = 'alert alert-danger'; return; }
  try {
    if (editingId) {
      await api('PUT', `/api/meals/${editingId}`, body);
      showToast('Meal updated', 'success');
    } else {
      await api('POST', '/api/meals', body);
      showToast('Meal created', 'success');
    }
    closeModal();
    loadData();
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
    alertEl.className = 'alert alert-danger';
  }
}

async function deleteMeal(id) {
  if (!confirm('Delete this meal?')) return;
  try {
    await api('DELETE', `/api/meals/${id}`);
    showToast('Meal deleted', 'success');
    loadData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

loadData();
