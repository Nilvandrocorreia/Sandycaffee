requireAuth();
initSidebar('reports');

let salesChart = null;
let bestChart = null;
let currentPeriod = 'day';

function setPeriod(btn, period) {
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentPeriod = period;
  loadAll();
}

async function loadAll() {
  document.getElementById('exportPdfBtn').href = `/api/reports/pdf?period=${currentPeriod}`;
  await Promise.all([loadSales(), loadBestSelling(), loadStock()]);
}

async function loadSales() {
  try {
    const data = await api('GET', `/api/reports/sales?period=${currentPeriod}`);
    document.getElementById('statRevenue').textContent = formatCurrency(data.total_revenue || 0);
    document.getElementById('statOrders').textContent = data.order_count || 0;
    document.getElementById('statAvg').textContent = formatCurrency(data.avg_order_value || 0);
    renderSalesChart(data.daily || []);
  } catch (err) {
    showToast('Failed to load sales data', 'error');
  }
}

async function loadBestSelling() {
  try {
    const data = await api('GET', `/api/reports/best-selling?period=${currentPeriod}`);
    renderBestSellingChart(data);
    renderBestTable(data);
  } catch (err) {
    showToast('Failed to load best-selling data', 'error');
  }
}

async function loadStock() {
  try {
    const data = await api('GET', '/api/inventory');
    renderStockTable(data);
  } catch (err) {
    showToast('Failed to load stock data', 'error');
  }
}

function renderSalesChart(daily) {
  const ctx = document.getElementById('salesChart').getContext('2d');
  const labels = daily.map(d => formatShortDate(d.day));
  const values = daily.map(d => d.revenue || 0);

  if (salesChart) salesChart.destroy();
  salesChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Revenue (£)',
        data: values,
        backgroundColor: 'rgba(210,105,30,0.15)',
        borderColor: '#D2691E',
        borderWidth: 2,
        pointBackgroundColor: '#FF8C00',
        fill: true,
        tension: 0.35
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => '£' + ctx.parsed.y.toFixed(2) } }
      },
      scales: {
        x: { ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: 'rgba(255,255,255,0.4)', callback: v => '£' + v }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
      }
    }
  });
}

function renderBestSellingChart(data) {
  const ctx = document.getElementById('bestSellingChart').getContext('2d');
  const top = data.slice(0, 8);
  const labels = top.map(p => p.name.length > 14 ? p.name.substring(0, 14) + '…' : p.name);
  const values = top.map(p => p.total_qty);

  const colors = [
    '#D2691E','#FF8C00','#8B4513','#A0522D','#CD853F',
    '#DEB887','#F4A460','#D2B48C'
  ];

  if (bestChart) bestChart.destroy();
  bestChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Qty Sold',
        data: values,
        backgroundColor: colors.slice(0, top.length),
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ctx.parsed.y + ' sold' } }
      },
      scales: {
        x: { ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: 'rgba(255,255,255,0.4)' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
      }
    }
  });
}

function renderBestTable(data) {
  const tbody = document.getElementById('bestTableBody');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">📊</div><p>No sales data for this period</p></div></td></tr>';
    return;
  }
  const medals = ['🥇', '🥈', '🥉'];
  tbody.innerHTML = data.map((p, i) => `
    <tr>
      <td>${medals[i] || (i + 1)}</td>
      <td><strong>${p.name}</strong></td>
      <td><span class="badge badge-info">${p.total_qty}</span></td>
      <td>${formatCurrency(p.total_revenue)}</td>
    </tr>
  `).join('');
}

function renderStockTable(data) {
  const tbody = document.getElementById('stockTableBody');
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">📦</div><p>No products</p></div></td></tr>';
    return;
  }
  tbody.innerHTML = data.map(p => {
    const isLow = p.stock <= p.min_stock;
    return `<tr>
      <td><strong>${p.name}</strong></td>
      <td>${p.category_name ? `<span class="badge badge-secondary">${p.category_emoji || ''} ${p.category_name}</span>` : '—'}</td>
      <td>${formatCurrency(p.price)}</td>
      <td><span class="badge badge-${isLow ? 'danger' : 'success'}">${p.stock}</span></td>
      <td>${p.min_stock}</td>
      <td><span class="badge badge-${isLow ? 'danger' : 'success'}">${isLow ? '⚠ LOW' : '✓ OK'}</span></td>
    </tr>`;
  }).join('');
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// Init
document.getElementById('exportPdfBtn').href = `/api/reports/pdf?period=${currentPeriod}`;
loadAll();
