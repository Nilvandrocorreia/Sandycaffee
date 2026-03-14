requireAuth();
initSidebar('inventory');

let inventoryData = [];
let movementsData = [];
let restockProductId = null;

async function loadInventory() {
  try {
    inventoryData = await api('GET', '/api/inventory');
    renderInventory();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadMovements() {
  try {
    movementsData = await api('GET', '/api/inventory/movements');
    renderMovements();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function filterTable() {
  renderInventory();
}

function renderInventory() {
  const tbody = document.getElementById('inventoryTableBody');
  const search = (document.getElementById('searchInput').value || '').toLowerCase();
  const filtered = inventoryData.filter(p =>
    p.name.toLowerCase().includes(search) ||
    (p.category_name || '').toLowerCase().includes(search)
  );

  const lowStockItems = inventoryData.filter(p => p.stock <= p.min_stock);
  const badge = document.getElementById('lowStockBadge');
  if (lowStockItems.length > 0) {
    badge.textContent = lowStockItems.length + ' low stock';
    badge.style.display = '';
  } else {
    badge.style.display = 'none';
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📦</div><p>No products found</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const isLow = p.stock <= p.min_stock;
    const pct = p.min_stock > 0 ? Math.min(100, (p.stock / (p.min_stock * 3)) * 100) : 100;
    const barColor = isLow ? '#e53e3e' : p.stock < p.min_stock * 2 ? '#d69e2e' : '#38a169';
    const photo = p.photo
      ? `<img src="${p.photo}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;">`
      : `<div style="width:36px;height:36px;border-radius:6px;background:rgba(255,255,255,0.07);display:flex;align-items:center;justify-content:center;font-size:1.1rem;">${p.category_emoji || '🍽️'}</div>`;

    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          ${photo}
          <strong>${p.name}</strong>
        </div>
      </td>
      <td>${p.category_name ? `<span class="badge badge-secondary">${p.category_emoji || ''} ${p.category_name}</span>` : '<span class="text-muted">—</span>'}</td>
      <td>${formatCurrency(p.price)}</td>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <span class="badge badge-${isLow ? 'danger' : 'success'}">${p.stock}</span>
          <div class="stock-bar-wrap">
            <div class="stock-bar" style="width:${pct}%;background:${barColor};"></div>
          </div>
        </div>
      </td>
      <td>${p.min_stock}</td>
      <td><span class="badge badge-${isLow ? 'danger' : 'success'}">${isLow ? '⚠ LOW' : '✓ OK'}</span></td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="openRestockModal(${p.id}, '${p.name.replace(/'/g, "\\'")}', ${p.stock})">+ Restock</button>
      </td>
    </tr>`;
  }).join('');
}

function renderMovements() {
  const tbody = document.getElementById('movementsTableBody');
  if (movementsData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state"><div class="empty-icon">📋</div><p>No movements recorded</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = movementsData.map(m => {
    const typeColour = { sale: 'danger', restock: 'success', adjustment: 'warning' }[m.type] || 'secondary';
    const qtyLabel = m.type === 'sale' ? `−${Math.abs(m.quantity)}` : `+${m.quantity}`;
    const qtyColor = m.type === 'sale' ? 'var(--danger)' : 'var(--success)';
    return `<tr>
      <td>${formatDate(m.created_at)}</td>
      <td><strong>${m.product_name}</strong></td>
      <td><span class="badge badge-${typeColour}">${m.type}</span></td>
      <td style="font-weight:700;color:${qtyColor};">${qtyLabel}</td>
      <td class="text-muted">${m.note || '—'}</td>
    </tr>`;
  }).join('');
}

function switchTab(btn, tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(tabId).classList.add('active');
  if (tabId === 'tabMovements' && movementsData.length === 0) {
    loadMovements();
  }
}

function openRestockModal(id, name, currentStock) {
  restockProductId = id;
  document.getElementById('restockTitle').textContent = 'Restock: ' + name;
  document.getElementById('restockCurrentStock').textContent = currentStock + ' units in stock';
  document.getElementById('restockQty').value = '';
  document.getElementById('restockNote').value = '';
  document.getElementById('restockAlert').style.display = 'none';
  document.getElementById('restockModal').classList.add('open');
}

function closeRestockModal() {
  document.getElementById('restockModal').classList.remove('open');
  restockProductId = null;
}

async function submitRestock() {
  const alertEl = document.getElementById('restockAlert');
  alertEl.style.display = 'none';
  const qty = parseInt(document.getElementById('restockQty').value);
  const note = document.getElementById('restockNote').value.trim();

  if (!qty || qty <= 0) {
    alertEl.textContent = 'Please enter a valid quantity';
    alertEl.className = 'alert alert-danger';
    alertEl.style.display = 'block';
    return;
  }

  try {
    await api('PUT', `/api/inventory/${restockProductId}/restock`, { quantity: qty, note });
    showToast('Stock updated successfully', 'success');
    closeRestockModal();
    loadInventory();
    // Reload movements if tab is active
    movementsData = [];
    loadMovements();
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.className = 'alert alert-danger';
    alertEl.style.display = 'block';
  }
}

loadInventory();
loadMovements();
