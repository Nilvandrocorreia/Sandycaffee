// Kitchen Display — no login required
if (typeof initSidebar === 'function') initSidebar('kitchen');

let allOrders = [];
let currentFilter = 'all';

async function loadOrders() {
  try {
    const res = await fetch('/api/orders/kitchen');
    if (!res.ok) throw new Error('Server returned ' + res.status);
    allOrders = await res.json();
    renderOrders();
    document.getElementById('lastRefresh').textContent = 'Updated ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    document.getElementById('activeCount').textContent = allOrders.length + ' active';
  } catch (err) {
    console.error('[Kitchen] Failed to load orders:', err.message);
    if (typeof showToast === 'function') showToast('Failed to load orders: ' + err.message, 'error');
  }
}

function setFilter(btn, filter) {
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = filter;
  renderOrders();
}

function renderOrders() {
  const grid = document.getElementById('kitchenGrid');
  const filtered = currentFilter === 'all' ? allOrders : allOrders.filter(o => o.status === currentFilter);

  if (filtered.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>No orders to display</p></div>';
    return;
  }

  grid.innerHTML = filtered.map(order => {
    const tableLabel = order.table_name || 'Counter';
    const timeAgo = getTimeAgo(order.created_at);
    const statusDot = { new: 'dot-new', preparing: 'dot-preparing', ready: 'dot-ready' }[order.status] || 'dot-new';

    const itemsHtml = order.items.map(i => `
      <div class="order-item">
        <div><span class="item-qty">${i.quantity}×</span>${i.name}</div>
      </div>
    `).join('');

    const statusLabel = { new: '🔴 New', preparing: '🟡 Preparing', ready: '🟢 Ready' }[order.status];
    const nextActions = getNextActions(order.status, order.id);

    return `
      <div class="order-card status-${order.status}" id="order-${order.id}">
        <div class="order-card-header">
          <div>
            <div class="order-num"><span class="status-dot ${statusDot}"></span>Order #${order.id}</div>
            <div class="order-table">🪑 ${tableLabel}</div>
          </div>
          <div class="order-time">
            <div><span class="badge badge-${order.status === 'new' ? 'danger' : order.status === 'preparing' ? 'warning' : 'success'}">${statusLabel}</span></div>
            <div style="margin-top:4px;">${timeAgo}</div>
          </div>
        </div>
        <div class="order-items">${itemsHtml}</div>
        <div class="order-card-footer">${nextActions}</div>
      </div>
    `;
  }).join('');
}

function getNextActions(status, orderId) {
  if (status === 'new') {
    return `<button class="btn btn-warning btn-sm" onclick="updateStatus(${orderId}, 'preparing')">🍳 Start Preparing</button>`;
  } else if (status === 'preparing') {
    return `
      <button class="btn btn-secondary btn-sm" onclick="updateStatus(${orderId}, 'new')">↩ Back</button>
      <button class="btn btn-success btn-sm" onclick="updateStatus(${orderId}, 'ready')">✅ Mark Ready</button>
    `;
  } else if (status === 'ready') {
    return `
      <button class="btn btn-secondary btn-sm" onclick="updateStatus(${orderId}, 'preparing')">↩ Back</button>
      <button class="btn btn-primary btn-sm" onclick="updateStatus(${orderId}, 'completed')">✔ Complete</button>
    `;
  }
  return '';
}

async function updateStatus(orderId, status) {
  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error('Server returned ' + res.status);
    if (status === 'completed') {
      allOrders = allOrders.filter(o => o.id !== orderId);
      renderOrders();
      document.getElementById('activeCount').textContent = allOrders.length + ' active';
    } else {
      const order = allOrders.find(o => o.id === orderId);
      if (order) order.status = status;
      renderOrders();
    }
    if (typeof showToast === 'function') showToast(`Order #${orderId} → ${status}`, 'success');
  } catch (err) {
    if (typeof showToast === 'function') showToast('Update failed: ' + err.message, 'error');
  }
}

function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

loadOrders();

// Poll every 5 seconds
setInterval(loadOrders, 5000);
