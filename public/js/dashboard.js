requireAuth();
initSidebar('dashboard');

let hourlyChart = null;

async function loadDashboard() {
  try {
    // Today's sales
    const today = await api('GET', '/api/sales/today');
    document.getElementById('statRevenue').textContent = formatCurrency(today.total_revenue || 0);
    document.getElementById('statOrderCount').textContent = today.order_count || 0;
    document.getElementById('statOrders').textContent = `${today.order_count || 0} orders today`;

    // Best seller
    const best = await api('GET', '/api/reports/best-selling?period=day');
    if (best.length > 0) {
      document.getElementById('statBestSeller').textContent = best[0].name;
      document.getElementById('statBestQty').textContent = `${best[0].total_qty} sold today`;
    }

    // Hourly chart
    const hourly = await api('GET', '/api/reports/hourly');
    renderHourlyChart(hourly);

    // Low stock
    const lowStock = await api('GET', '/api/products/low-stock');
    renderLowStock(lowStock);
  } catch (err) {
    showToast('Failed to load dashboard data: ' + err.message, 'error');
  }
}

function renderHourlyChart(data) {
  const ctx = document.getElementById('hourlyChart').getContext('2d');
  const labels = data.map(d => d.hour + ':00');
  const values = data.map(d => d.revenue || 0);

  if (hourlyChart) hourlyChart.destroy();
  hourlyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Revenue (£)',
        data: values,
        backgroundColor: 'rgba(210,105,30,0.6)',
        borderColor: '#D2691E',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => '£' + ctx.parsed.y.toFixed(2) }
        }
      },
      scales: {
        x: {
          ticks: { color: 'rgba(255,255,255,0.4)', font: { size: 10 }, maxTicksLimit: 12 },
          grid: { color: 'rgba(255,255,255,0.05)' }
        },
        y: {
          ticks: { color: 'rgba(255,255,255,0.4)', callback: v => '£' + v },
          grid: { color: 'rgba(255,255,255,0.05)' }
        }
      }
    }
  });
}

function renderLowStock(items) {
  const el = document.getElementById('lowStockList');
  if (items.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:rgba(255,255,255,0.3);">✅ All stock levels are fine</div>';
    return;
  }
  el.innerHTML = items.map(p => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
      <div>
        <div style="font-size:0.88rem;font-weight:500;">${p.name}</div>
        <div style="font-size:0.76rem;color:rgba(255,255,255,0.4);">${p.category_name || 'Uncategorised'}</div>
      </div>
      <div style="text-align:right;">
        <span class="badge badge-danger">${p.stock} left</span>
        <div style="font-size:0.72rem;color:rgba(255,255,255,0.3);margin-top:2px;">min: ${p.min_stock}</div>
      </div>
    </div>
  `).join('');
}

async function loadTableStatus() {
  try {
    const tables = await api('GET', '/api/tables');
    const grid = document.getElementById('tableStatusGrid');
    if (!grid) return;
    if (tables.length === 0) {
      grid.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:0.85rem;">No tables configured</div>';
      return;
    }
    const statusColor = { available: '#38a169', occupied: '#e53e3e', 'bill-requested': '#d69e2e' };
    const statusLabel = { available: 'Available', occupied: 'Occupied', 'bill-requested': 'Bill Requested' };
    grid.innerHTML = tables.filter(t => t.active).map(t => {
      const status = t.status || 'available';
      const color = statusColor[status] || '#38a169';
      const label = statusLabel[status] || 'Available';
      return `
        <div style="background:var(--card-bg);border:2px solid ${color};border-radius:10px;padding:12px;text-align:center;">
          <div style="font-size:0.95rem;font-weight:600;">${t.name}</div>
          <div style="margin-top:6px;">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:4px;"></span>
            <span style="font-size:0.72rem;color:${color};font-weight:600;">${label}</span>
          </div>
        </div>`;
    }).join('');
  } catch (_) {}
}

loadDashboard();
loadTableStatus();
// Refresh every 30 seconds
setInterval(loadDashboard, 60000);
setInterval(loadTableStatus, 30000);
