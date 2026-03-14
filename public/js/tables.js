requireAuth();
initSidebar('tables');

let tablesData = [];
let detectedUrl = '';

async function loadBaseUrl() {
  try {
    const data = await api('GET', '/api/settings/base-url');
    detectedUrl = data.detected_url;
    document.getElementById('baseUrlInput').value = data.base_url;
    document.getElementById('detectedBtn').title = `Detected: ${data.detected_url}`;
    const statusEl = document.getElementById('baseUrlStatus');
    statusEl.innerHTML = `
      Current: <strong style="color:var(--accent)">${data.base_url}</strong>
      &nbsp;|&nbsp; Detected LAN IP: <strong>${data.detected_url}</strong>
      ${data.is_custom ? '' : '&nbsp;<span style="color:#d69e2e;">(auto-detected — save to lock in)</span>'}
    `;
  } catch (err) {
    console.error('Failed to load base URL:', err.message);
  }
}

function useDetected() {
  if (detectedUrl) document.getElementById('baseUrlInput').value = detectedUrl;
}

async function saveBaseUrl() {
  const base_url = document.getElementById('baseUrlInput').value.trim();
  if (!base_url) { showToast('Enter a URL first', 'warning'); return; }
  try {
    await api('PUT', '/api/settings/base-url', { base_url });
    // Regenerate all QR codes with the new URL
    const result = await api('POST', '/api/tables/regenerate-qr');
    showToast(`URL saved. Regenerated ${result.regenerated} QR code(s).`, 'success');
    loadBaseUrl();
    loadTables();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadTables() {
  try {
    tablesData = await api('GET', '/api/tables');
    renderGrid();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderGrid() {
  const grid = document.getElementById('tablesGrid');
  if (tablesData.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🪑</div><p>No tables yet</p></div>';
    return;
  }
  grid.innerHTML = tablesData.map(t => `
    <div class="table-card">
      <h3>${t.name}</h3>
      ${t.qr_code
        ? `<img src="${t.qr_code}" alt="QR for ${t.name}">`
        : `<div style="width:140px;height:140px;margin:0 auto 14px;background:rgba(255,255,255,0.05);border-radius:8px;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.3);">No QR</div>`}
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
        <button class="btn btn-sm btn-secondary" onclick="openPrintModal(${t.id})">🖨️ Print QR</button>
        <button class="btn btn-sm btn-danger" onclick="deleteTable(${t.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

function openModal() {
  document.getElementById('fNumber').value = '';
  document.getElementById('fName').value = '';
  document.getElementById('modalAlert').style.display = 'none';
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

async function saveTable() {
  const alertEl = document.getElementById('modalAlert');
  alertEl.style.display = 'none';
  const number = document.getElementById('fNumber').value;
  const name = document.getElementById('fName').value.trim();
  if (!number || !name) { alertEl.textContent = 'Both fields are required'; alertEl.style.display = 'block'; alertEl.className = 'alert alert-danger'; return; }
  try {
    await api('POST', '/api/tables', { number: parseInt(number), name });
    showToast('Table added with QR code', 'success');
    closeModal();
    loadTables();
  } catch (err) {
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
    alertEl.className = 'alert alert-danger';
  }
}

function openPrintModal(id) {
  const t = tablesData.find(x => x.id === id);
  if (!t) return;
  document.getElementById('printModalTitle').textContent = `QR Code — ${t.name}`;
  document.getElementById('printTableName').textContent = t.name;
  document.getElementById('printQRImg').src = t.qr_code || `/api/tables/${t.id}/qr`;
  document.getElementById('printModalOverlay').classList.add('open');
}

function closePrintModal() {
  document.getElementById('printModalOverlay').classList.remove('open');
}

function printQR() {
  const content = document.getElementById('printQRContent').innerHTML;
  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html><html><head>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
      body { font-family: 'Poppins', sans-serif; text-align: center; padding: 40px; background: #fff; color: #333; }
      h2 { color: #D2691E; }
      img { width: 200px; height: 200px; }
      @media print { button { display: none; } }
    </style>
    </head><body>${content}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 500);
}

async function deleteTable(id) {
  if (!confirm('Delete this table?')) return;
  try {
    await api('DELETE', `/api/tables/${id}`);
    showToast('Table deleted', 'success');
    loadTables();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

loadBaseUrl();
loadTables();
