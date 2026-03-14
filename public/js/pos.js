requireAuth();
initSidebar('pos');

let cart = [];
let allProducts = [];
let allMeals = [];
let categories = [];
let tables = [];
let pendingTillOrders = [];
let selectedPayment = 'cash';
let currentCategoryId = '';

async function loadData() {
  try {
    [allProducts, allMeals, categories, tables] = await Promise.all([
      api('GET', '/api/products'),
      api('GET', '/api/meals'),
      api('GET', '/api/categories'),
      api('GET', '/api/tables')
    ]);
    renderCategoryTabs();
    renderProducts();
    populateTableSelect();
    loadPendingTill();
  } catch (err) {
    showToast('Failed to load data: ' + err.message, 'error');
  }
}

async function loadPendingTill() {
  try {
    pendingTillOrders = await api('GET', '/api/orders/pending-till');
    updatePendingBadge();
  } catch (_) {}
}

function updatePendingBadge() {
  const badge = document.getElementById('pendingBadge');
  if (badge) {
    badge.textContent = pendingTillOrders.length || '';
    badge.style.display = pendingTillOrders.length ? 'inline-flex' : 'none';
  }
}

function renderCategoryTabs() {
  const tabs = document.getElementById('categoryTabs');
  const activeMeals = allMeals.filter(m => m.active);
  tabs.innerHTML =
    `<button class="filter-tab active" onclick="filterCategory(this, '')">All</button>` +
    categories.map(c => `<button class="filter-tab" onclick="filterCategory(this, 'cat_${c.id}')">${c.emoji} ${c.name}</button>`).join('') +
    (activeMeals.length ? `<button class="filter-tab" onclick="filterCategory(this, 'meals')">🍽️ Meals</button>` : '') +
    `<button class="filter-tab pending-tab" onclick="filterCategory(this, 'pending')">📥 Customer Orders <span class="pending-badge" id="pendingBadge" style="display:none"></span></button>`;
}

function filterCategory(btn, catKey) {
  document.querySelectorAll('#categoryTabs .filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentCategoryId = catKey;
  if (catKey === 'pending') {
    loadPendingTill().then(renderPendingOrders);
  } else {
    renderProducts();
  }
}

function renderProducts() {
  const grid = document.getElementById('productGrid');
  let items = [];

  if (currentCategoryId === 'meals') {
    items = allMeals.filter(m => m.active).map(m => ({ ...m, _type: 'meal' }));
  } else if (currentCategoryId.startsWith('cat_')) {
    const catId = parseInt(currentCategoryId.replace('cat_', ''));
    items = allProducts.filter(p => p.active && p.category_id === catId).map(p => ({ ...p, _type: 'product' }));
  } else {
    items = [
      ...allProducts.filter(p => p.active).map(p => ({ ...p, _type: 'product' })),
      ...allMeals.filter(m => m.active).map(m => ({ ...m, _type: 'meal' }))
    ];
  }

  if (items.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🛍️</div><p>No items in this category</p></div>';
    return;
  }

  grid.innerHTML = items.map(item => {
    if (item._type === 'meal') {
      return `<button class="pos-product-btn" onclick="addMealToCart(${item.id})">
        <div class="placeholder-img">🍽️</div>
        <div class="pname">${item.name}</div>
        <div class="pprice">${formatCurrency(item.price)}</div>
        <div class="pstock" style="color:rgba(255,140,0,0.6);">Combo Meal</div>
      </button>`;
    }
    const outOfStock = item.stock <= 0;
    const imgHtml = item.photo
      ? `<img src="${item.photo}" alt="${item.name}">`
      : `<div class="placeholder-img">${item.category_emoji || '☕'}</div>`;
    return `<button class="pos-product-btn" onclick="addProductToCart(${item.id})" ${outOfStock ? 'disabled style="opacity:0.4"' : ''}>
      ${imgHtml}
      <div class="pname">${item.name}</div>
      <div class="pprice">${formatCurrency(item.price)}</div>
      <div class="pstock">${outOfStock ? 'Out of stock' : item.stock + ' left'}</div>
    </button>`;
  }).join('');
}

function renderPendingOrders() {
  const grid = document.getElementById('productGrid');
  if (pendingTillOrders.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">✅</div><p>No pending customer orders</p></div>';
    return;
  }
  grid.innerHTML = pendingTillOrders.map(o => {
    const tableLabel = o.table_name || 'Counter';
    const timeAgo = getTimeAgo(o.created_at);
    const itemsHtml = o.items.map(i => `<div style="font-size:0.8rem;padding:2px 0;">${i.quantity}× ${i.name}</div>`).join('');
    const total = o.items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const billReq = o.table_number ? `<button class="btn btn-sm btn-warning" onclick="closeTable(${o.table_id}, ${o.id}, ${total.toFixed(2)})">💰 Close Table & Pay</button>` : '';
    return `
      <div class="pending-order-card">
        <div class="pending-header">
          <strong>🪑 ${tableLabel}</strong>
          <span style="font-size:0.75rem;color:rgba(255,255,255,0.4);">#${o.id} · ${timeAgo}</span>
        </div>
        ${o.table_status === 'bill-requested' ? '<div style="color:#d69e2e;font-size:0.78rem;font-weight:600;padding:4px 0;">🧾 Bill Requested</div>' : ''}
        <div style="margin:8px 0;">${itemsHtml}</div>
        <div style="font-size:0.95rem;font-weight:700;color:var(--accent);margin-bottom:10px;">Total: ${formatCurrency(total)}</div>
        ${billReq}
      </div>`;
  }).join('');
}

function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

async function closeTable(tableId, orderId, total) {
  if (!confirm(`Close table and process payment of ${formatCurrency(total)}?`)) return;
  try {
    await api('POST', '/api/sales', {
      order_id: orderId,
      total,
      payment_method: selectedPayment,
      till_number: 'Till 1'
    });
    await api('POST', `/api/tables/${tableId}/release`);
    showToast('Table closed and payment recorded', 'success');
    loadPendingTill().then(renderPendingOrders);
    loadData();
  } catch (err) {
    showToast('Failed: ' + err.message, 'error');
  }
}

function addProductToCart(productId) {
  const p = allProducts.find(x => x.id === productId);
  if (!p) return;
  const existing = cart.find(x => x._type === 'product' && x.id === productId);
  if (existing) existing.qty++;
  else cart.push({ id: p.id, name: p.name, price: p.price, qty: 1, _type: 'product' });
  renderCart();
}

function addMealToCart(mealId) {
  const m = allMeals.find(x => x.id === mealId);
  if (!m) return;
  const existing = cart.find(x => x._type === 'meal' && x.id === mealId);
  if (existing) existing.qty++;
  else cart.push({ id: m.id, name: m.name, price: m.price, qty: 1, _type: 'meal' });
  renderCart();
}

function updateQty(idx, delta) {
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  renderCart();
}

function clearCart() {
  cart = [];
  renderCart();
}

function renderCart() {
  const el = document.getElementById('cartItems');
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  if (cart.length === 0) {
    el.innerHTML = '<div class="cart-empty">Add items to start an order</div>';
    document.getElementById('cartTotal').textContent = '£0.00';
    return;
  }
  el.innerHTML = cart.map((item, idx) => `
    <div class="cart-item-pos">
      <div class="ci-name">${item.name}${item._type === 'meal' ? ' <span style="font-size:0.7rem;color:rgba(255,140,0,0.6);">(meal)</span>' : ''}</div>
      <div class="ci-qty">
        <button onclick="updateQty(${idx}, -1)">−</button>
        <span>${item.qty}</span>
        <button onclick="updateQty(${idx}, 1)">+</button>
      </div>
      <div class="ci-price">${formatCurrency(item.price * item.qty)}</div>
    </div>
  `).join('');
  document.getElementById('cartTotal').textContent = formatCurrency(total);
}

function populateTableSelect() {
  const sel = document.getElementById('tableSelect');
  sel.innerHTML = '<option value="">— Take Away / Till —</option>' +
    tables.filter(t => t.active).map(t => {
      const statusIcon = t.status === 'occupied' ? ' 🔴' : t.status === 'bill-requested' ? ' 🧾' : '';
      return `<option value="${t.id}">${t.name}${statusIcon}</option>`;
    }).join('');
}

// Payment tabs
document.querySelectorAll('.pay-tab').forEach(btn => {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.pay-tab').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    selectedPayment = this.dataset.method;
  });
});

async function placeOrder() {
  if (cart.length === 0) { showToast('Cart is empty', 'warning'); return; }

  const tableId = document.getElementById('tableSelect').value || null;
  const items = cart.map(i => ({
    product_id: i._type === 'product' ? i.id : null,
    meal_id: i._type === 'meal' ? i.id : null,
    name: i.name,
    quantity: i.qty,
    unit_price: i.price
  }));
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);

  try {
    const order = await api('POST', '/api/orders', {
      table_id: tableId ? parseInt(tableId) : null,
      items,
      type: tableId ? 'dine-in' : 'take-away',
      source: 'pos'
    });

    await api('POST', '/api/sales', {
      order_id: order.id,
      total,
      payment_method: selectedPayment,
      till_number: 'Till 1'
    });

    showReceipt(order, total);
    clearCart();
    allProducts = await api('GET', '/api/products');
    tables = await api('GET', '/api/tables');
    renderProducts();
    populateTableSelect();
    loadPendingTill();
  } catch (err) {
    showToast('Order failed: ' + err.message, 'error');
  }
}

function showReceipt(order, total) {
  const now = new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
  const tableName = order.table_name || 'Take Away';
  const itemsHtml = order.items.map(i => `
    <div class="receipt-row">
      <span>${i.name} x${i.quantity}</span>
      <span>${formatCurrency(i.unit_price * i.quantity)}</span>
    </div>`).join('');
  document.getElementById('receiptContent').innerHTML = `
    <div class="receipt-logo">☕ Sandycaffee</div>
    <div style="text-align:center;font-size:0.78rem;color:#777;margin-bottom:6px;">Point of Sale Receipt</div>
    <div class="receipt-divider"></div>
    <div class="receipt-row"><span>Order #${order.id}</span><span>${tableName}</span></div>
    <div class="receipt-row"><span>${now}</span><span>${selectedPayment.toUpperCase()}</span></div>
    <div class="receipt-divider"></div>
    ${itemsHtml}
    <div class="receipt-divider"></div>
    <div class="receipt-row receipt-total"><span>TOTAL</span><span>${formatCurrency(total)}</span></div>
    <div class="receipt-footer">Thank you for visiting Sandycaffee!<br>We hope to see you again soon ☕</div>
  `;
  document.getElementById('receiptModal').classList.add('open');
}

function closeReceipt() { document.getElementById('receiptModal').classList.remove('open'); }

function printReceipt() {
  const content = document.getElementById('receiptContent').outerHTML;
  const win = window.open('', '_blank', 'width=400,height=600');
  win.document.write(`<!DOCTYPE html><html><head>
    <style>
      body { font-family: 'Courier New', monospace; padding: 20px; }
      .receipt-logo { text-align: center; font-size: 1.1rem; font-weight: bold; margin-bottom: 6px; }
      .receipt-divider { border-top: 1px dashed #999; margin: 8px 0; }
      .receipt-row { display: flex; justify-content: space-between; font-size: 0.85rem; margin: 4px 0; }
      .receipt-total { font-size: 1rem; font-weight: bold; }
      .receipt-footer { text-align: center; font-size: 0.78rem; color: #666; margin-top: 10px; }
    </style></head><body>${content}</body></html>`);
  win.document.close();
  setTimeout(() => { win.print(); win.close(); }, 300);
}

loadData();
// Refresh pending orders every 15s
setInterval(loadPendingTill, 15000);
