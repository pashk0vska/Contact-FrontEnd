// === Today in appbar ===
const t = new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
const elToday = document.getElementById('today'); if (elToday) elToday.textContent = `Сьогодні: ${t}`;

// === Logout ===
const logout = document.getElementById('logout');
if (logout) logout.addEventListener('click', () => { localStorage.removeItem('token'); location.href = 'index.html'; });

// === API base (fallback 5101 -> 7286) ===
const API_CANDIDATES = ["http://localhost:5101", "https://localhost:7286"];
let API = localStorage.getItem("apiBase") || API_CANDIDATES[0];

const token = localStorage.getItem("token");
if (!token) { location.href = "index.html"; }

// try current; if network fails -> try other candidates and remember working one
async function apiFetch(path, init = {}) {
  const tryOnce = async (base) => {
    const url = path.startsWith("http") ? path : `${base}${path}`;
    const res = await fetch(url, init);
    return { res, base };
  };
  try {
    return await tryOnce(API);
  } catch {
    for (const candidate of API_CANDIDATES) {
      if (candidate === API) continue;
      try {
        const out = await tryOnce(candidate);
        localStorage.setItem("apiBase", candidate);
        API = candidate;
        return out;
      } catch {}
    }
    throw new Error("API is not reachable");
  }
}

// ===== State =====
let page = 1, pageSize = 10, sort = "FullName", dir = "asc";

// ===== Helpers =====
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const num = n => Number(n || 0).toLocaleString("uk-UA");
const debounce = (fn, ms = 300) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };
const escapeHtml = s => (s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

// ===== Load list =====
async function loadClients() {
  const q = ($("#q")?.value || "").trim();
  const url = new URL(`/api/Clients`, API);
  url.searchParams.set("q", q);
  url.searchParams.set("sort", sort);
  url.searchParams.set("dir", dir);
  url.searchParams.set("page", page);
  url.searchParams.set("pageSize", pageSize);

  let out;
  try {
    out = await apiFetch(url.href, { headers: { "Authorization": `Bearer ${token}` } });
  } catch (e) {
    console.error("Не вдалось підʼєднатись до API:", e);
    $("#clientsTbody").innerHTML = `<tr><td colspan="4" class="err">Немає з'єднання з API</td></tr>`;
    return;
  }

  const { res } = out;
  if (res.status === 401) { alert("Сесія завершилась. Увійдіть знову."); localStorage.removeItem("token"); location.href="index.html"; return; }
  if (!res.ok)          { const txt = await res.text().catch(()=> ""); console.error("Помилка API:", res.status, txt);
                          $("#clientsTbody").innerHTML = `<tr><td colspan="4" class="err">Помилка API: ${res.status}</td></tr>`; return; }

  const { items, total } = await res.json();
  renderTable(items);
  renderPager(total);
}

// ===== Renderers =====
function renderTable(items) {
  const tbody = $("#clientsTbody");
  tbody.innerHTML = "";
  if (!items || !items.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;opacity:.7">Нічого не знайдено</td></tr>`;
    return;
  }
  for (const c of items) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(c.fullName)}</td>
      <td>${escapeHtml(c.phone)}</td>
      <td>${escapeHtml(c.email || "")}</td>
      <td class="actions">
        <div class="row-actions">
          <button class="menu-btn" data-id="${c.id}" title="Дії" aria-haspopup="menu">⋯</button>
        </div>
      </td>`;
    tbody.appendChild(tr);
  }
}

function renderPager(total) {
  const root = $("#pager");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  page = Math.min(page, pages);

  let html = `<button class="nav" ${page<=1?"disabled":""} data-page="${page-1}">‹</button>`;
  for (let p = Math.max(1, page-2); p <= Math.min(pages, page+2); p++) {
    html += `<button class="${p===page?"active":""}" data-page="${p}">${p}</button>`;
  }
  html += `<button class="nav" ${page>=pages?"disabled":""} data-page="${page+1}">›</button>`;
  root.innerHTML = html;
}

// ===== Row menu (⋯) as a portal =====
const portal = document.getElementById("rowMenuPortal");

function openRowMenu(anchorBtn, clientId){
  // 1) вставляємо вміст меню
  portal.innerHTML = `<button role="menuitem" data-act="del" data-id="${clientId}">Видалити клієнта</button>`;
  portal.hidden = false;

  // 2) після рендера вимірюємо реальний розмір і ставимо координати
  requestAnimationFrame(() => {
    const r = anchorBtn.getBoundingClientRect();
    const pw = portal.offsetWidth;
    const ph = portal.offsetHeight;

    // позиціонуємо під кнопкою, вирівнюючи по правому краю, але не виходимо за межі екрана
    let left = Math.min(window.innerWidth - pw - 12, r.right - pw);
    let top  = Math.min(window.innerHeight - ph - 12, r.bottom + 8);

    left = Math.max(12, left);
    top  = Math.max(12, top);

    portal.style.left = `${left}px`;
    portal.style.top  = `${top}px`;
  });
}

function closeRowMenu(){ portal.hidden = true; }

// ===== CRUD =====
async function saveClient(model, id) {
  const method = id ? "PUT" : "POST";
  const path = id ? `/api/Clients/${id}` : `/api/Clients`;
  const { res } = await apiFetch(`${API}${path}`, {
    method,
    headers: { "Content-Type":"application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(model)
  });
  if (!res.ok) { const txt = await res.text().catch(()=> ""); alert("Помилка збереження: " + (txt || res.status)); return; }
  page = 1; await loadClients();
}

async function deleteClient(id) {
  const { res } = await apiFetch(`${API}/api/Clients/${id}`, {
    method:"DELETE", headers: { "Authorization": `Bearer ${token}` }
  });
  if (res.ok) { await loadClients(); } else { alert("Помилка видалення: " + res.status); }
}

// ===== UI events =====
document.addEventListener("click", (e) => {
  // сортування
  const th = e.target.closest("th[data-sort]");
  if (th) {
    const s = th.dataset.sort;
    if (sort === s) dir = (dir === "asc" ? "desc" : "asc");
    else { sort = s; dir = "asc"; }
    page = 1; loadClients(); return;
  }

  // пагінація
  if (e.target.matches("#pager button[data-page]")) {
    const p = +e.target.dataset.page; if (p>0) { page = p; loadClients(); }
    return;
  }

  // відкриття меню
  const btnMenu = e.target.closest(".menu-btn");
  if (btnMenu) {
    const id = +btnMenu.dataset.id;
    openRowMenu(btnMenu, id);
    return;
  }

  // клік по пункту меню порталу
  const act = e.target.closest("#rowMenuPortal [data-act]");
  if (act && act.dataset.act === "del") {
    const id = +act.dataset.id;
    if (confirm("Видалити клієнта?")) deleteClient(id);
    closeRowMenu(); return;
  }

  // клік поза меню -> закрити
  if (!e.target.closest("#rowMenuPortal")) closeRowMenu();
});

// при скролі/ESC закриваємо меню і модал
document.addEventListener("scroll", () => closeRowMenu(), true);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeRowMenu(); closeModal(); }
});

// пошук
$("#q")?.addEventListener("input", debounce(() => { page = 1; loadClients(); }, 300));

// ===== MODAL (custom layer) =====
const clientModal = document.getElementById("clientModal");
const clientForm  = document.getElementById("clientForm");
const btnAdd      = document.getElementById("btnAdd");
const btnCancel   = document.getElementById("cfCancel");

function openModal(){
  clientForm.reset();
  clientModal.hidden = false;
}
function closeModal(){
  clientModal.hidden = true;
}

btnAdd?.addEventListener("click", openModal);
btnCancel?.addEventListener("click", closeModal);
clientModal?.addEventListener("click", (e)=>{ if(e.target === clientModal) closeModal(); });

clientForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fullName = document.getElementById("cfFullName").value.trim();
  const phone    = document.getElementById("cfPhone").value.trim();
  const email    = document.getElementById("cfEmail").value.trim();
  if (!fullName || !phone) { alert("Будь ласка, заповни Ім’я та Телефон."); return; }
  await saveClient({ fullName, phone, email });
  closeModal();
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
loadClients();
