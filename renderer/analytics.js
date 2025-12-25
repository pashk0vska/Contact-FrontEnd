// ===== Appbar date =====
const todayText = new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
const elToday = document.getElementById('today');
if (elToday) elToday.textContent = `Сьогодні: ${todayText}`;

// ===== Auth / logout =====
const token = localStorage.getItem('token');
if (!token) location.href = 'index.html';
const logout = document.getElementById('logout');
if (logout) logout.addEventListener('click', () => {
  localStorage.removeItem('token');
  location.href = 'index.html';
});

// ===== API base (fallback 5101 -> 7286) =====
const API_CANDIDATES = ["http://localhost:5101", "https://localhost:7286"];
let API = localStorage.getItem("apiBase") || API_CANDIDATES[0];

async function apiFetch(path, init = {}) {
  const tryOnce = async (base) => {
    const url = path.startsWith("http") ? path : `${base}${path}`;
    const res = await fetch(url, init);
    return { res, base };
  };
  try {
    return await tryOnce(API);
  } catch {
    for (const c of API_CANDIDATES) {
      if (c === API) continue;
      try {
        const out = await tryOnce(c);
        localStorage.setItem("apiBase", c);
        API = c;
        return out;
      } catch { }
    }
    throw new Error("API is not reachable");
  }
}

// ===== DOM helpers =====
const $ = (s, r = document) => r.querySelector(s);
const fmtMoney = (v) => `₴ ${Number(v || 0).toLocaleString('uk-UA', { maximumFractionDigits: 2 })}`;

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ===== Date helpers =====
// For input[type=date] we keep "YYYY-MM-DD" and send it as date-only.
function isoDate(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function setDefaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - 29);
  const fromEl = document.getElementById('fromDate');
  const toEl = document.getElementById('toDate');
  if (fromEl && !fromEl.value) fromEl.value = isoDate(from);
  if (toEl && !toEl.value) toEl.value = isoDate(to);
}

function getMode() {
  // select in the dropdown "Показати"
  const sel = document.querySelector('.dropdown-menu select');
  const v = (sel?.value || '').toLowerCase();
  if (v.includes('лише продаж')) return 'sales';
  if (v.includes('лише ремонт')) return 'repairs';
  return 'all';
}

// ===== Render =====
function renderTopTable(items) {
  const tbody = document.getElementById('topTbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  if (!items || !items.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;opacity:.7">Немає даних за період</td></tr>`;
    return;
  }

  for (const it of items) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${it.product || ''}</td>
      <td>${it.category || ''}</td>
      <td style="text-align:center">${Number(it.qty || 0).toLocaleString('uk-UA')}</td>
      <td style="text-align:right">${fmtMoney(it.sum)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderKpi(kpi) {
  setText('kpiIncome', fmtMoney(kpi?.income));
  setText('kpiSalesCount', String(kpi?.salesCount ?? 0));
  setText('kpiRepairsCount', String(kpi?.repairsCount ?? 0));
  setText('kpiAvgCheck', fmtMoney(kpi?.avgCheck));
  setText('kpiProfit', fmtMoney(kpi?.profitEstimate));
  setText('kpiNewClients', String(kpi?.newClients ?? 0));
}

// ===== Load =====
async function loadAnalytics() {
  const from = document.getElementById('fromDate')?.value || '';
  const to = document.getElementById('toDate')?.value || '';
  const type = getMode();

  const url = new URL('/api/Analytics/summary', API);
  if (from) url.searchParams.set('from', from);
  if (to) url.searchParams.set('to', to);
  url.searchParams.set('type', type);

  // loading state
  renderKpi({ income: 0, salesCount: 0, repairsCount: 0, avgCheck: 0, profitEstimate: 0, newClients: 0 });
  renderTopTable([]);
  const tbody = document.getElementById('topTbody');
  if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="opacity:.7">Завантаження…</td></tr>`;

  let out;
  try {
    out = await apiFetch(url.href, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (e) {
    console.error(e);
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="color:#ffb3b3">Немає з'єднання з API</td></tr>`;
    return;
  }

  const { res } = out;
  if (res.status === 401) {
    alert('Сесія завершилась. Увійдіть знову.');
    localStorage.removeItem('token');
    location.href = 'index.html';
    return;
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="color:#ffb3b3">Помилка API: ${res.status}${txt ? ` — ${txt}` : ''}</td></tr>`;
    return;
  }

  const data = await res.json();
  renderKpi(data.kpi);
  renderTopTable(data.topProducts);
}

// ===== Wiring =====
setDefaultRange();
document.getElementById('applyBtn')?.addEventListener('click', loadAnalytics);
document.getElementById('resetBtn')?.addEventListener('click', () => {
  const fromEl = document.getElementById('fromDate');
  const toEl = document.getElementById('toDate');
  if (fromEl) fromEl.value = '';
  if (toEl) toEl.value = '';
  // reset mode to first option
  const sel = document.querySelector('.dropdown-menu select');
  if (sel) sel.selectedIndex = 0;
  setDefaultRange();
  loadAnalytics();
});

// auto reload when dates change
document.getElementById('fromDate')?.addEventListener('change', loadAnalytics);
document.getElementById('toDate')?.addEventListener('change', loadAnalytics);
document.querySelector('.dropdown-menu select')?.addEventListener('change', loadAnalytics);

// initial
loadAnalytics();
