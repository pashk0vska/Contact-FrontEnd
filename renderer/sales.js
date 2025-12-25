// === Today ===
const t = new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
const elToday = document.getElementById('today'); if (elToday) elToday.textContent = `Сьогодні: ${t}`;

// === Logout ===
const logout = document.getElementById('logout');
if (logout) logout.addEventListener('click', () => { localStorage.removeItem('token'); location.href = 'index.html'; });

// === API base (fallback 5101 -> 7286) ===
const API_CANDIDATES = ["http://localhost:5101", "https://localhost:7286"];
let API = localStorage.getItem("apiBase") || API_CANDIDATES[0];
const token = localStorage.getItem("token");
if (!token) location.href = "index.html";

async function apiFetch(path, init = {}) {
  const tryOnce = async (base) => {
    const url = path.startsWith("http") ? path : `${base}${path}`;
    const res = await fetch(url, init);
    return { res, base };
  };
  try { return await tryOnce(API); }
  catch {
    for (const c of API_CANDIDATES) {
      if (c === API) continue;
      try { const out = await tryOnce(c); localStorage.setItem("apiBase", c); API = c; return out; } catch {}
    }
    throw new Error("API is not reachable");
  }
}

// ===== State =====
let page = 1, pageSize = 10, sort = "Date", dir = "desc";
let filters = { from: "", to: "", status: "" };

// ===== Helpers =====
const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const debounce = (fn, ms=300)=>{let t; return (...a)=>{clearTimeout(t); t=setTimeout(()=>fn(...a),ms);} };
const fmtMoney = v => `₴ ${Number(v||0).toLocaleString("uk-UA")}`;
const fmtDate = s => { if (!s) return ""; const d = new Date(s); return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("uk-UA"); };

// ===== Load list =====
async function loadSales() {
  closeRowMenu();
  const q = ($("#q")?.value || "").trim();
  const url = new URL(`/api/Sales`, API);
  url.searchParams.set("page", page);
  url.searchParams.set("pageSize", pageSize);
  if (q) url.searchParams.set("q", q);
  if (sort) url.searchParams.set("sort", sort);
  if (dir)  url.searchParams.set("dir", dir);
  if (filters.from)   url.searchParams.set("from", filters.from);
  if (filters.to)     url.searchParams.set("to",   filters.to);
  if (filters.status) url.searchParams.set("status", filters.status);

  let out;
  try { out = await apiFetch(url.href, { headers: { "Authorization": `Bearer ${token}` } }); }
  catch (e) { console.error(e); $("#salesTbody").innerHTML = `<tr><td colspan="8" class="err">Немає з'єднання з API</td></tr>`; return; }

  const { res } = out;
  if (res.status === 401) { alert("Сесія завершилась. Увійдіть знову."); localStorage.removeItem('token'); location.href="index.html"; return; }
  if (!res.ok) { const txt = await res.text().catch(()=> ""); $("#salesTbody").innerHTML = `<tr><td colspan="8" class="err">Помилка API: ${res.status}${txt?` — ${txt}`:""}</td></tr>`; return; }

  const { items, total } = await res.json();
  renderTable(items);
  renderPager(total);
}

function renderTable(items) {
  const tbody = $("#salesTbody");
  tbody.innerHTML = "";
  if (!items || !items.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;opacity:.7">Нічого не знайдено</td></tr>`;
    return;
  }

  for (const s of items) {
    const id          = s.id ?? s.saleId ?? s.SaleId;
    const date        = s.date ?? s.Date ?? s.createdAt;
    const clientName  = s.clientName ?? s.clientFullName ?? s.ClientName ?? s.Client ?? "";
    const productName = s.productName ?? s.ProductName ?? s.Product ?? "";
    const quantity    = s.quantity ?? s.Qty ?? s.Quantity ?? 1;
    const totalPrice  = s.totalPrice ?? s.total ?? s.amount ?? s.Price ?? 0;
    const payment     = s.payment ?? s.Payment ?? s.paymentMethod ?? "";
    const status      = s.status ?? s.Status ?? "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDate(date)}</td>
      <td>${clientName}</td>
      <td>${productName}</td>
      <td style="text-align:center">${quantity}</td>
      <td style="text-align:right">${fmtMoney(totalPrice)}</td>
      <td>${payment}</td>
      <td class="${statusClass(status)}">${statusText(status)}</td>
      <td class="actions">
        <div class="row-actions">
          <button class="menu-btn" data-id="${id}" title="Дії" aria-haspopup="menu">⋯</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  }
}

function statusClass(v){
  switch((v||"").toLowerCase()){
    case "done": case "завершено": return "status-done";
    case "processing": case "в обробці": return "status-processing";
    case "cancelled": case "скасовано": return "status-cancelled";
    default: return "";
  }
}
function statusText(v){
  const s = (v||"").toLowerCase();
  if (s==="done") return "Завершено";
  if (s==="processing") return "В обробці";
  if (s==="cancelled") return "Скасовано";
  return v || "";
}

function renderPager(total){
  const root = $("#pager");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  page = Math.min(page, pages);
  let html = `<button class="nav" ${page<=1?"disabled":""} data-page="${page-1}">‹</button>`;
  for (let p = Math.max(1, page-2); p <= Math.min(pages, page+2); p++){
    html += `<button class="${p===page?"active":""}" data-page="${p}">${p}</button>`;
  }
  html += `<button class="nav" ${page>=pages?"disabled":""} data-page="${page+1}">›</button>`;
  root.innerHTML = html;
}

// ===== Row menu (portal) =====
const portal = document.getElementById("rowMenuPortal");
let currentMenuAnchor = null;

function openRowMenu(anchorBtn, saleId){
  if (currentMenuAnchor === anchorBtn && !portal.hidden){ closeRowMenu(); return; }
  currentMenuAnchor = anchorBtn;
  portal.innerHTML = `<button role="menuitem" data-act="del" data-id="${saleId}">Видалити продаж</button>`;
  portal.hidden = false;
  requestAnimationFrame(()=> {
    const r = anchorBtn.getBoundingClientRect();
    const pw = portal.offsetWidth, ph = portal.offsetHeight;
    let left = Math.min(window.innerWidth - pw - 12, r.right - pw + 2);
    let top  = Math.min(window.innerHeight - ph - 12, r.bottom + 8);
    portal.style.left = `${Math.max(12,left)}px`;
    portal.style.top  = `${Math.max(12,top)}px`;
  });
}
function closeRowMenu(){ portal.hidden = true; currentMenuAnchor = null; }

// ===== CRUD: create + delete =====
async function createSale(model){
  const { res } = await apiFetch(`${API}/api/Sales`, {
    method: "POST",
    headers: { "Content-Type":"application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(model)
  });
  if (!res.ok){
    const txt = await res.text().catch(()=> "");
    throw new Error(`Помилка збереження: ${res.status}${txt?` — ${txt}`:""}`);
  }
  return await res.json();
}

async function deleteSale(id){
  const { res } = await apiFetch(`${API}/api/Sales/${id}`, {
    method:"DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (res.ok) { await loadSales(); } else { alert("Помилка видалення: " + res.status); }
}

// ===== Events (table) =====
document.addEventListener("click", (e)=>{
  const th = e.target.closest("th[data-sort]");
  if (th){
    const s = th.dataset.sort;
    if (sort === s) dir = (dir === "asc" ? "desc" : "asc");
    else { sort = s; dir = (s==="Date" ? "desc" : "asc"); }
    page = 1; loadSales(); return;
  }

  if (e.target.matches("#pager button[data-page]")){
    const p = +e.target.dataset.page; if (p>0){ page = p; loadSales(); }
    return;
  }

  const btnMenu = e.target.closest(".menu-btn");
  if (btnMenu){
    const id = +btnMenu.dataset.id;
    openRowMenu(btnMenu, id);
    return;
  }

  const act = e.target.closest("#rowMenuPortal [data-act]");
  if (act && act.dataset.act === "del"){
    const id = +act.dataset.id;
    if (confirm("Видалити продаж?")) deleteSale(id);
    closeRowMenu(); return;
  }

  if (!e.target.closest("#rowMenuPortal")) closeRowMenu();
});

// пошук/фільтри
$("#q")?.addEventListener("input", debounce(()=>{ page=1; loadSales(); }, 300));
$("#fApply")?.addEventListener("click", ()=>{
  filters.from = $("#fFrom")?.value || "";
  filters.to   = $("#fTo")?.value   || "";
  filters.status = $("#fStatus")?.value || "";
  page = 1; loadSales();
});
$("#fReset")?.addEventListener("click", ()=>{
  $("#fFrom").value = $("#fTo").value = ""; $("#fStatus").value = "";
  filters = {from:"", to:"", status:""}; page=1; loadSales();
});
$("#sApply")?.addEventListener("click", ()=>{
  sort = $("#sortField").value || "Date";
  dir  = $("#sortDir").value || "desc";
  page=1; loadSales();
});
$("#sReset")?.addEventListener("click", ()=>{
  $("#sortField").value="Date"; $("#sortDir").value="desc";
  sort="Date"; dir="desc"; page=1; loadSales();
});

// ===== MODAL: Зареєструвати продаж =====
const saleModal = $("#saleModal");
const saleForm  = $("#saleForm");
const btnAddSale= $("#btnAddSale");
const sfCancel  = $("#sfCancel");
const sfClient  = $("#sfClient");
const sfClientId= $("#sfClientId");

function openSaleModal(){
  saleForm.reset();
  const d = new Date();
  const yyyy = d.getFullYear(), mm = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
  $("#sfDate").value = `${yyyy}-${mm}-${dd}`;
  sfClientId.value = "";
  $("#clientList").innerHTML = "";
  saleModal.hidden = false;
}
function closeSaleModal(){ saleModal.hidden = true; }

btnAddSale?.addEventListener("click", openSaleModal);
sfCancel?.addEventListener("click", closeSaleModal);
saleModal?.addEventListener("click", (e)=>{ if (e.target === saleModal) closeSaleModal(); });

// автопідказка клієнтів
sfClient?.addEventListener("input", debounce(async ()=>{
  const q = sfClient.value.trim();
  sfClientId.value = "";
  if (!q || q.length < 2){ $("#clientList").innerHTML = ""; return; }
  const url = new URL(`/api/Clients`, API);
  url.searchParams.set("q", q);
  url.searchParams.set("page", 1);
  url.searchParams.set("pageSize", 20);
  const { res } = await apiFetch(url.href, { headers: { "Authorization": `Bearer ${token}` } });
  if (!res.ok) return;
  const data = await res.json();
  const opts = (data.items || []).map(c => `<option value="${c.fullName}" data-id="${c.id}"></option>`).join("");
  $("#clientList").innerHTML = opts;
}, 300));

sfClient?.addEventListener("change", ()=>{
  const val = sfClient.value;
  const opt = Array.from($("#clientList").options).find(o => o.value === val);
  sfClientId.value = opt ? opt.dataset.id : "";
});

// сабміт (дозволяємо нового клієнта)
saleForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const submitBtn = saleForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;

  try{
    const dateRaw = $("#sfDate").value;
    // IMPORTANT: for date-only inputs (YYYY-MM-DD) DO NOT use toISOString().
    // toISOString() converts local time to UTC and can shift the calendar day.
    // We send a "local" date-time string without a timezone (treated as local on the backend).
    const dateValue = dateRaw ? `${dateRaw}T00:00:00` : new Date().toISOString();
    const payment = $("#sfPayment").value;
    const status  = $("#sfStatus").value;
    const note    = $("#sfNote").value.trim();

    const clientId   = +($("#sfClientId").value || 0);
    const clientName = $("#sfClient").value.trim();
    if (!clientId && !clientName){ alert("Вкажи клієнта: або обери зі списку, або введи ім’я нового."); return; }

    const name  = $("#sfProduct").value.trim();
    const qty   = Math.max(1, +$("#sfQty").value || 1);
    const price = Math.max(0, +$("#sfPrice").value || 0);

    const model = {
      clientId: clientId || null,
      clientName: clientId ? null : clientName, // якщо немає id — передаємо ім’я для створення
      date: dateValue,
      payment,
      status,
      note,
      item: { name, qty, price },
      upsertService: true // підказка бекенду додати сервіс
    };

    await createSale(model);
    // success: закриваємо модалку, оновлюємо список
    closeSaleModal();
    page = 1;
    await loadSales();
  }catch(err){
    alert(err.message || "Помилка збереження");
  }finally{
    submitBtn.disabled = false; // важливо: розблокувати кнопку
  }
});

// авто-відкриття модалки за запитом з дашборда
(() => {
  const key = localStorage.getItem("openModal");
  if (!key) return;
  localStorage.removeItem("openModal");
  if (key === "sale")   document.getElementById("btnAddSale")?.click();
  if (key === "repair") document.getElementById("btnAddRepair")?.click();
  if (key === "client") document.getElementById("btnAddClient")?.click();
})();

// ===== init =====
loadSales();
