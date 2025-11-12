// === Today ===
const t = new Date().toLocaleDateString('uk-UA',{day:'2-digit',month:'long',year:'numeric'});
const elToday = document.getElementById('today'); if (elToday) elToday.textContent = `Сьогодні: ${t}`;

// === Logout ===
const logout = document.getElementById('logout');
if (logout) logout.addEventListener('click', ()=>{ localStorage.removeItem('token'); location.href='index.html'; });

// === API base (fallback 5101 -> 7286) ===
const API_CANDIDATES = ["http://localhost:5101","https://localhost:7286"];
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
let page=1, pageSize=9, sort="Date", dir="desc";
let filters = { status:"", deviceType:"", from:"", to:"" };

// ===== Helpers =====
const $  = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
const debounce = (fn,ms=300)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };
const fmtDate = s => { if(!s) return ""; const d=new Date(s); return Number.isNaN(d.getTime())?s:d.toLocaleDateString("uk-UA"); };
const fmtMoney = v => `₴ ${Number(v||0).toLocaleString("uk-UA")}`;

// ===== Load list =====
async function loadRepairs(){
  closeRowMenu();
  const q = ($("#q")?.value||"").trim();
  const url = new URL(`/api/Repairs`, API);
  url.searchParams.set("page", page);
  url.searchParams.set("pageSize", pageSize);
  if (q) url.searchParams.set("q", q);
  if (sort) url.searchParams.set("sort", sort);
  if (dir)  url.searchParams.set("dir", dir);
  if (filters.status) url.searchParams.set("status", filters.status);
  if (filters.deviceType) url.searchParams.set("deviceType", filters.deviceType);
  if (filters.from) url.searchParams.set("from", filters.from);
  if (filters.to)   url.searchParams.set("to",   filters.to);

  let out;
  try {
    out = await apiFetch(url.href, { headers: { "Authorization": `Bearer ${token}` } });
  } catch(e) {
    console.error(e);
    $("#repairsTbody").innerHTML = `<tr><td colspan="8" class="err">Немає з'єднання з API</td></tr>`;
    return;
  }
  const { res } = out;
  if (res.status === 401){ alert("Сесія завершилась. Увійдіть знову."); localStorage.removeItem('token'); location.href="index.html"; return; }
  if (!res.ok){ const txt=await res.text().catch(()=> ""); $("#repairsTbody").innerHTML = `<tr><td colspan="8" class="err">Помилка API: ${res.status}${txt?` — ${txt}`:""}</td></tr>`; return; }

  const { items, total } = await res.json();
  renderTable(items);
  renderPager(total);
}

function renderTable(items){
  const tbody = $("#repairsTbody");
  tbody.innerHTML = "";
  if (!items || !items.length){
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;opacity:.7">Нічого не знайдено</td></tr>`;
    return;
  }
  for (const r of items){
    const id = r.id ?? r.Id;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${id}</td>
      <td>${fmtDate(r.date ?? r.Date)}</td>
      <td>${r.clientName ?? r.ClientName ?? ""}</td>
      <td>${r.device ?? r.Device ?? ""}</td>
      <td>${r.problem ?? r.Problem ?? ""}</td>
      <td>${renderStatus(r.status ?? r.Status)}</td>
      <td style="text-align:right">${fmtMoney(r.price ?? r.Price)}</td>
      <td class="more">
        <button class="menu-btn" data-id="${id}" title="Дії" aria-haspopup="menu">⋯</button>
      </td>`;
    tbody.appendChild(tr);
  }
}

function renderStatus(v){
  const s = (v||"").toLowerCase();
  const map = {
    "new": ["badge new", "Новий"],
    "progress": ["badge progress", "В процесі"],
    "done": ["badge done", "Готово"],
    "issued": ["badge issued", "Видано"],
    "canceled": ["badge canceled", "Скасовано"]
  };
  const x = map[s] || ["badge", v||""];
  return `<span class="${x[0]}">${x[1]}</span>`;
}

function renderPager(total){
  const root = $("#pager");
  const pages = Math.max(1, Math.ceil(total / pageSize));
  page = Math.min(page, pages);
  let html = `<button class="nav" ${page<=1?"disabled":""} data-page="${page-1}">‹</button>`;
  for (let p=Math.max(1,page-2); p<=Math.min(pages,page+2); p++){
    html += `<button class="${p===page?"active":""}" data-page="${p}">${p}</button>`;
  }
  html += `<button class="nav" ${page>=pages?"disabled":""} data-page="${page+1}">›</button>`;
  root.innerHTML = html;
}

// ===== Portal row menu =====
const portal = document.getElementById("rowMenuPortal");
let currentMenuAnchor = null;
function openRowMenu(anchorBtn, repairId){
  if (currentMenuAnchor === anchorBtn && !portal.hidden){ closeRowMenu(); return; }
  currentMenuAnchor = anchorBtn;
  portal.innerHTML = `<button role="menuitem" data-act="del" data-id="${repairId}">Видалити ордер</button>`;
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

// ===== CRUD =====
async function createRepair(model){
  const { res } = await apiFetch(`${API}/api/Repairs`, {
    method: "POST",
    headers: { "Content-Type":"application/json", "Authorization": `Bearer ${token}` },
    body: JSON.stringify(model)
  });
  if (!res.ok){ const txt=await res.text().catch(()=> ""); throw new Error(`Помилка збереження: ${res.status}${txt?` — ${txt}`:""}`); }
  return await res.json();
}
async function deleteRepair(id){
  const { res } = await apiFetch(`${API}/api/Repairs/${id}`, {
    method:"DELETE",
    headers: { "Authorization": `Bearer ${token}` }
  });
  if (res.ok){ await loadRepairs(); } else { alert("Помилка видалення: "+res.status); }
}

// ===== Events =====
document.addEventListener("click",(e)=>{
  const th = e.target.closest("th[data-sort]");
  if (th){
    const s = th.dataset.sort;
    if (sort === s) dir = (dir === "asc" ? "desc" : "asc");
    else { sort = s; dir = (s==="Date" ? "desc" : "asc"); }
    page=1; loadRepairs(); return;
  }
  if (e.target.matches("#pager button[data-page]")){
    const p = +e.target.dataset.page; if (p>0){ page=p; loadRepairs(); }
    return;
  }
  const btnMenu = e.target.closest(".menu-btn");
  if (btnMenu){
    openRowMenu(btnMenu, +btnMenu.dataset.id);
    return;
  }
  const act = e.target.closest("#rowMenuPortal [data-act]");
  if (act && act.dataset.act==="del"){
    const id = +act.dataset.id;
    if (confirm("Видалити ордер?")) deleteRepair(id);
    closeRowMenu(); return;
  }
  if (!e.target.closest("#rowMenuPortal")) closeRowMenu();
});
$("#q")?.addEventListener("input", debounce(()=>{ page=1; loadRepairs(); }, 300));
$("#fApply")?.addEventListener("click", ()=>{
  filters.status = $("#fStatus").value || "";
  filters.deviceType = $("#fDeviceType").value || "";
  filters.from = $("#fFrom").value || "";
  filters.to   = $("#fTo").value   || "";
  page=1; loadRepairs();
});
$("#fReset")?.addEventListener("click", ()=>{
  $("#fStatus").value = ""; $("#fDeviceType").value="";
  $("#fFrom").value=""; $("#fTo").value="";
  filters = { status:"", deviceType:"", from:"", to:"" };
  page=1; loadRepairs();
});
$("#sApply")?.addEventListener("click", ()=>{
  sort = $("#sortField").value || "Date";
  dir  = $("#sortDir").value   || "desc";
  page=1; loadRepairs();
});
$("#sReset")?.addEventListener("click", ()=>{
  $("#sortField").value="Date"; $("#sortDir").value="desc";
  sort="Date"; dir="desc"; page=1; loadRepairs();
});

// ===== Modal (create) =====
const repairModal = $("#repairModal");
const repairForm  = $("#repairForm");
const btnCreate   = $("#btnCreate");
const rfCancel    = $("#rfCancel");
const rfClient    = $("#rfClient");
const rfClientId  = $("#rfClientId");

function openRepairModal(){
  repairForm.reset();
  const d = new Date();
  const yyyy=d.getFullYear(), mm=String(d.getMonth()+1).padStart(2,'0'), dd=String(d.getDate()).padStart(2,'0');
  $("#rfDate").value = `${yyyy}-${mm}-${dd}`;
  $("#clientList").innerHTML = "";
  rfClientId.value = "";
  repairModal.hidden = false;
}
function closeRepairModal(){ repairModal.hidden = true; }

btnCreate?.addEventListener("click", openRepairModal);
rfCancel?.addEventListener("click", closeRepairModal);
repairModal?.addEventListener("click",(e)=>{ if (e.target===repairModal) closeRepairModal(); });

// автопідказка клієнтів
rfClient?.addEventListener("input", debounce(async ()=>{
  const q = rfClient.value.trim();
  rfClientId.value = "";
  if (!q || q.length<2){ $("#clientList").innerHTML=""; return; }
  const url = new URL(`/api/Clients`, API);
  url.searchParams.set("q", q);
  url.searchParams.set("page", 1);
  url.searchParams.set("pageSize", 20);
  const { res } = await apiFetch(url.href, { headers: { "Authorization": `Bearer ${token}` } });
  if (!res.ok) return;
  const data = await res.json();
  const opts = (data.items||[]).map(c => `<option value="${c.fullName}" data-id="${c.id}"></option>`).join("");
  $("#clientList").innerHTML = opts;
}, 300));
rfClient?.addEventListener("change", ()=>{
  const val = rfClient.value;
  const opt = Array.from($("#clientList").options).find(o => o.value === val);
  rfClientId.value = opt ? opt.dataset.id : "";
});

// submit
repairForm?.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const submitBtn = repairForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try{
    const dateRaw = $("#rfDate").value;
    const dateISO = dateRaw ? new Date(`${dateRaw}T00:00:00`).toISOString() : new Date().toISOString();
    const status  = $("#rfStatus").value;
    const device  = $("#rfDevice").value.trim();
    const problem = $("#rfProblem").value.trim();
    const price   = Math.max(0, +$("#rfPrice").value || 0);
    const note    = $("#rfNote").value.trim(); // на майбутнє, якщо додасте в модель

    const clientId   = +($("#rfClientId").value || 0);
    const clientName = $("#rfClient").value.trim();
    if (!clientId && !clientName){ alert("Вкажи клієнта: або обери зі списку, або введи ім’я нового."); return; }

    const model = {
      clientId: clientId || null,
      clientName: clientId ? null : clientName,
      date: dateISO,
      device,
      problem,
      status,
      price
    };

    await createRepair(model);
    closeRepairModal();
    page=1; await loadRepairs();
  }catch(err){
    alert(err.message || "Помилка збереження");
  }finally{
    submitBtn.disabled = false;
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

// init
loadRepairs();
