// === Today in appbar ===
const t = new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
const elToday = document.getElementById('today'); if (elToday) elToday.textContent = `Сьогодні: ${t}`;
const logoutBtn = document.getElementById('logout');
if (logoutBtn) logoutBtn.addEventListener('click', () => { localStorage.removeItem('token'); localStorage.removeItem('role'); location.href = "../auth/index.html"; });

const API_CANDIDATES = ["http://localhost:5101", "https://localhost:7286"];
let API = localStorage.getItem("apiBase") || API_CANDIDATES[0];
const token = localStorage.getItem("token");
if (!token) { location.href = "../auth/index.html"; }

async function apiFetch(path, init = {}) {
  const tryOnce = async (base) => { const url = path.startsWith("http") ? path : `${base}${path}`; return { res: await fetch(url, init), base }; };
  try { return await tryOnce(API); } catch {
    for (const c of API_CANDIDATES) { if (c === API) continue; try { const out = await tryOnce(c); localStorage.setItem("apiBase", c); API = c; return out; } catch {} }
    throw new Error("API is not reachable");
  }
}

// Телефон/email-хелпери з common.js (із запасними варіантами на випадок, якщо common.js не підвантажився)
const prettyPhone = (v) => (window.phoneToPretty ? window.phoneToPretty(v) : (v || ""));
const canonPhone  = (v) => (window.phoneToCanonical ? window.phoneToCanonical(v) : (v || ""));
const validPhone  = (v) => (window.isValidUaPhone ? window.isValidUaPhone(v) : !!(v || "").trim());
const validEmail  = (v) => (window.isValidEmail ? window.isValidEmail(v) : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((v || "").trim()));

let page = 1, pageSize = 10, sort = "FullName", dir = "asc";
let selectedIds = new Set();
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const escapeHtml = s => (s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

// Статуси українською + кольорові пігулки для історії клієнта
const REPAIR_STATUS_UA={new:"Новий",progress:"В процесі",done:"Готово",issued:"Видано",canceled:"Скасовано"};
const SALE_STATUS_UA={done:"Завершено",processing:"В обробці",cancelled:"Скасовано",returned:"Повернення"};
const STATUS_COLOR={new:"#1f8ee2",progress:"#e2b81f",done:"#1fe26a",issued:"#58d27a",canceled:"#e2706a",processing:"#e2b81f",cancelled:"#e2706a",returned:"#9b6cf0"};
function histPill(v,kind){
  const s=(v||"").toLowerCase();
  const label=(kind==='sale'?SALE_STATUS_UA:REPAIR_STATUS_UA)[s]||v||"—";
  const col=STATUS_COLOR[s]||"#5b6b76";
  return `<span style="display:inline-block;padding:3px 9px;border-radius:999px;font-size:11px;font-weight:700;background:${col}22;color:${col};border:1px solid ${col}55;white-space:nowrap">${escapeHtml(label)}</span>`;
}

function updateSortIndicators() {
  $$("th[data-sort]").forEach(th => {
    const old = th.querySelector('.sort-ind'); if (old) old.remove();
    if (th.dataset.sort === sort) { const sp = document.createElement('span'); sp.className='sort-ind'; sp.textContent = dir==='asc'?' ▲':' ▼'; th.appendChild(sp); }
  });
}

function updateBulkBtn() { const b = $("#btnBulkDelete"); if(b) b.style.display = selectedIds.size>0?'inline-flex':'none'; }

async function loadClients() {
  const q = ($("#q")?.value || "").trim();
  const url = new URL(`/api/Clients`, API);
  url.searchParams.set("q", q); url.searchParams.set("sort", sort); url.searchParams.set("dir", dir);
  url.searchParams.set("page", page); url.searchParams.set("pageSize", pageSize);
  let out;
  try { out = await apiFetch(url.href, { headers: { "Authorization": `Bearer ${token}` } }); }
  catch (e) { $("#clientsTbody").innerHTML = `<tr><td colspan="5" class="err">Немає з'єднання з API</td></tr>`; return; }
  const { res } = out;
  if (res.status === 401) { showToast('error',"Сесія завершилась"); localStorage.removeItem("token"); location.href="../auth/index.html"; return; }
  if (!res.ok) { $("#clientsTbody").innerHTML = `<tr><td colspan="5" class="err">Помилка API: ${res.status}</td></tr>`; return; }
  const { items, total } = await res.json();
  renderTable(items); renderPager(total); updateSortIndicators(); updateBulkBtn();
}

function renderTable(items) {
  const tbody = $("#clientsTbody"); tbody.innerHTML = "";
  if (!items || !items.length) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;opacity:.7">Нічого не знайдено</td></tr>`; return; }
  for (const c of items) {
    const tr = document.createElement("tr");
    // Позначка «К» — клієнт, створений у Конфігураторі ПК (FromConfigurator з бекенду).
    const cfgBadge = c.fromConfigurator ? ` <span class="cfg-badge" title="Клієнт із Конфігуратора ПК">К</span>` : "";
    tr.innerHTML = `<td><input type="checkbox" class="row-cb" data-id="${c.id}" ${selectedIds.has(c.id)?'checked':''}></td>
      <td>${escapeHtml(c.fullName)}${cfgBadge}</td><td>${escapeHtml(prettyPhone(c.phone))}</td><td>${escapeHtml(c.email||"")}</td>
      <td class="actions"><div class="row-actions"><button class="menu-btn" data-id="${c.id}" title="Дії">⋯</button></div></td>`;
    tbody.appendChild(tr);
  }
}

function renderPager(total) {
  const root = $("#pager"); const pages = Math.max(1, Math.ceil(total / pageSize)); page = Math.min(page, pages);
  let html = `<button class="nav" ${page<=1?"disabled":""} data-page="${page-1}">‹</button>`;
  for (let p = Math.max(1,page-2); p <= Math.min(pages,page+2); p++) html += `<button class="${p===page?"active":""}" data-page="${p}">${p}</button>`;
  html += `<button class="nav" ${page>=pages?"disabled":""} data-page="${page+1}">›</button>`;
  root.innerHTML = html;
}

const portal = document.getElementById("rowMenuPortal");
function openRowMenu(btn, id){
  portal.innerHTML = `<button data-act="edit" data-id="${id}">Редагувати</button><button data-act="history" data-id="${id}">Історія</button><button data-act="del" data-id="${id}">Видалити</button>`;
  portal.hidden = false;
  requestAnimationFrame(()=>{ const r=btn.getBoundingClientRect(); let left=Math.min(window.innerWidth-portal.offsetWidth-12,r.right-portal.offsetWidth); let top=Math.min(window.innerHeight-portal.offsetHeight-12,r.bottom+8); portal.style.left=`${Math.max(12,left)}px`; portal.style.top=`${Math.max(12,top)}px`; });
}
function closeRowMenu(){ portal.hidden=true; }

async function saveClient(model, id) {
  const method = id?"PUT":"POST"; const path = id?`/api/Clients/${id}`:`/api/Clients`;
  const { res } = await apiFetch(`${API}${path}`, { method, headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`}, body:JSON.stringify(model) });
  if (!res.ok) { showToast('error',"Помилка збереження: "+(await res.text().catch(()=>""))); return; }
  showToast('success', id?'Клієнта оновлено':'Клієнта додано'); page=1; await loadClients();
}

async function deleteClient(id) {
  const { res } = await apiFetch(`${API}/api/Clients/${id}`, { method:"DELETE", headers:{"Authorization":`Bearer ${token}`} });
  if (res.ok) { showToast('success','Видалено'); await loadClients(); } else showToast('error',"Помилка: "+res.status);
}

async function bulkDelete() {
  if (!selectedIds.size) return;
  confirmAction(`Видалити ${selectedIds.size} клієнт(ів)?`, async(ok)=>{
    if(!ok) return; const ids=Array.from(selectedIds);
    try { const {res}=await apiFetch(`${API}/api/Clients/batch-delete`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify(ids)});
      if(res.ok){showToast('success',`Видалено ${ids.length}`);selectedIds.clear();await loadClients();}else showToast('error','Помилка: '+res.status);
    }catch(e){showToast('error',e.message);}
  });
}

document.addEventListener("click",(e)=>{
  if(e.target.matches("#selectAll")){const c=e.target.checked;$$(".row-cb").forEach(cb=>{cb.checked=c;const id=+cb.dataset.id;c?selectedIds.add(id):selectedIds.delete(id);});updateBulkBtn();return;}
  if(e.target.matches(".row-cb")){const id=+e.target.dataset.id;e.target.checked?selectedIds.add(id):selectedIds.delete(id);updateBulkBtn();return;}
  if(e.target.closest("#btnBulkDelete")){bulkDelete();return;}
  const th=e.target.closest("th[data-sort]"); if(th){const s=th.dataset.sort; if(sort===s)dir=(dir==="asc"?"desc":"asc"); else{sort=s;dir="asc";} page=1;loadClients();return;}
  if(e.target.matches("#pager button[data-page]")){const p=+e.target.dataset.page;if(p>0){page=p;loadClients();}return;}
  const btnMenu=e.target.closest(".menu-btn"); if(btnMenu){openRowMenu(btnMenu,+btnMenu.dataset.id);return;}
  const act=e.target.closest("#rowMenuPortal [data-act]");
  if(act){const id=+act.dataset.id;
    if(act.dataset.act==="del") confirmAction("Видалити клієнта?",(ok)=>{if(ok)deleteClient(id);});
    else if(act.dataset.act==="edit") openEditModal(id);
    else if(act.dataset.act==="history") openHistoryModal(id);
    closeRowMenu();return;}
  if(!e.target.closest("#rowMenuPortal"))closeRowMenu();
});

document.addEventListener("scroll",()=>closeRowMenu(),true);
document.addEventListener("keydown",(e)=>{if(e.key==="Escape"){closeRowMenu();}});
$("#q")?.addEventListener("input", debounce(()=>{page=1;loadClients();},300));

// Add modal
const clientModal=document.getElementById("clientModal"), clientForm=document.getElementById("clientForm");
document.getElementById("btnAdd")?.addEventListener("click",()=>{clientForm.reset();clientModal.hidden=false;});
document.getElementById("cfCancel")?.addEventListener("click",()=>{clientModal.hidden=true;});

function closeModal(){clientModal.hidden=true;}
clientForm?.addEventListener("submit",async(e)=>{
  e.preventDefault();
  const fn=$("#cfFullName").value.trim();
  const phRaw=$("#cfPhone").value.trim();
  const em=$("#cfEmail").value.trim();
  if(!fn){showToast('warning',"Вкажіть ім'я.");return;}
  if(!validPhone(phRaw)){showToast('warning','Вкажіть коректний номер телефону.');return;}
  if(!validEmail(em)){showToast('warning','Вкажіть коректний email.');return;}
  await saveClient({fullName:fn,phone:canonPhone(phRaw),email:em});
  closeModal();
});

// Edit modal
const editModal=document.getElementById("editClientModal");
function openEditModal(id){
  apiFetch(`${API}/api/Clients?q=&page=1&pageSize=200`,{headers:{"Authorization":`Bearer ${token}`}}).then(async({res})=>{
    if(!res.ok)return;const data=await res.json();const c=(data.items||[]).find(x=>x.id===id);if(!c){showToast('error','Не знайдено');return;}
    $("#efId").value=c.id;$("#efFullName").value=c.fullName;$("#efPhone").value=prettyPhone(c.phone);$("#efEmail").value=c.email||"";editModal.hidden=false;});
}
function closeEditModal(){editModal.hidden=true;}
$("#efCancel")?.addEventListener("click",closeEditModal);

$("#editClientForm")?.addEventListener("submit",async(e)=>{
  e.preventDefault();
  const id=+$("#efId").value;
  const fn=$("#efFullName").value.trim();
  const phRaw=$("#efPhone").value.trim();
  const em=$("#efEmail").value.trim();
  if(!fn){showToast('warning',"Вкажіть ім'я.");return;}
  if(!validPhone(phRaw)){showToast('warning','Вкажіть коректний номер телефону.');return;}
  if(!validEmail(em)){showToast('warning','Вкажіть коректний email.');return;}
  await saveClient({fullName:fn,phone:canonPhone(phRaw),email:em},id);
  closeEditModal();
});

// History modal
const historyModal=document.getElementById("historyModal");
async function openHistoryModal(cid){
  $("#historyContent").innerHTML='<p style="opacity:.7">Завантаження…</p>';historyModal.hidden=false;
  try{const{res}=await apiFetch(`${API}/api/Clients/${cid}/history`,{headers:{"Authorization":`Bearer ${token}`}});if(!res.ok){$("#historyContent").innerHTML='<p>Помилка</p>';return;}
    const d=await res.json();let h=`<h4>${escapeHtml(d.clientName)}</h4>`;
    if(d.repairs&&d.repairs.length){h+=`<h5>Ремонти (${d.repairs.length})</h5><table class="table-mini"><thead><tr><th>Дата</th><th>Пристрій</th><th>Проблема</th><th>Статус</th><th>Ціна</th></tr></thead><tbody>`;
      for(const r of d.repairs)h+=`<tr><td>${new Date(r.date).toLocaleDateString('uk-UA')}</td><td>${escapeHtml(r.device)}</td><td>${escapeHtml(r.problem)}</td><td>${histPill(r.status,'repair')}</td><td>₴${Number(r.price).toLocaleString('uk-UA')}</td></tr>`;h+=`</tbody></table>`;}
    else h+=`<p style="opacity:.7">Ремонтів немає</p>`;
    if(d.sales&&d.sales.length){h+=`<h5>Покупки (${d.sales.length})</h5><table class="table-mini"><thead><tr><th>Дата</th><th>Товар</th><th>Сума</th><th>Статус</th></tr></thead><tbody>`;
      for(const s of d.sales)h+=`<tr><td>${new Date(s.date).toLocaleDateString('uk-UA')}</td><td>${escapeHtml(s.product)}</td><td>₴${Number(s.total).toLocaleString('uk-UA')}</td><td>${histPill(s.status,'sale')}</td></tr>`;h+=`</tbody></table>`;}
    else h+=`<p style="opacity:.7">Покупок немає</p>`;
    $("#historyContent").innerHTML=h;
  }catch(e){$("#historyContent").innerHTML='<p>Помилка: '+e.message+'</p>';}
}
function closeHistoryModal(){historyModal.hidden=true;}
$("#historyClose")?.addEventListener("click",closeHistoryModal);

// Жива маска телефону у модалках
if (window.attachPhoneInput) { attachPhoneInput($("#cfPhone")); attachPhoneInput($("#efPhone")); }

(()=>{const key=localStorage.getItem("openModal");if(!key)return;localStorage.removeItem("openModal");if(key==="client")document.getElementById("btnAdd")?.click();})();
loadClients();
