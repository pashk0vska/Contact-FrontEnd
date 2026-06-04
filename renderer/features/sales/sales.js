const t = new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
const elToday = document.getElementById('today'); if (elToday) elToday.textContent = `Сьогодні: ${t}`;
const logoutEl = document.getElementById('logout');
if (logoutEl) logoutEl.addEventListener('click', () => { localStorage.removeItem('token'); localStorage.removeItem('role'); location.href = "../auth/index.html"; });

const API_CANDIDATES = ["http://localhost:5101", "https://localhost:7286"];
let API = localStorage.getItem("apiBase") || API_CANDIDATES[0];
const token = localStorage.getItem("token");
if (!token) location.href = "../auth/index.html";

async function apiFetch(path, init = {}) {
  const tryOnce = async (base) => { const url = path.startsWith("http") ? path : `${base}${path}`; return { res: await fetch(url, init), base }; };
  try { return await tryOnce(API); } catch {
    for (const c of API_CANDIDATES) { if (c === API) continue; try { const out = await tryOnce(c); localStorage.setItem("apiBase", c); API = c; return out; } catch {} }
    throw new Error("API is not reachable");
  }
}

async function loadMasters(selectId, selectedId){
  const sel=document.getElementById(selectId); if(!sel) return;
  sel.innerHTML='<option value="">— не призначено —</option>';
  try{
    const{res}=await apiFetch(`/api/Masters`,{headers:{"Authorization":`Bearer ${token}`}});
    if(!res.ok) return;
    const list=await res.json();
    for(const m of (list||[])){const o=document.createElement("option");o.value=m.id;o.textContent=m.name;sel.appendChild(o);}
    if(selectedId!=null && selectedId!=="") sel.value=String(selectedId);
  }catch{}
}

let page = 1, pageSize = 10, sort = "Date", dir = "desc";
let filters = { from: "", to: "", status: "" };
let selectedIds = new Set();

const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
const fmtMoney = v => `₴ ${Number(v||0).toLocaleString("uk-UA")}`;
const fmtDate = s => { if (!s) return ""; const d = new Date(s); return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("uk-UA"); };

function updateSortIndicators() {
  $$("th[data-sort]").forEach(th => {
    const old = th.querySelector('.sort-ind'); if (old) old.remove();
    if (th.dataset.sort === sort) { const sp = document.createElement('span'); sp.className='sort-ind'; sp.textContent = dir==='asc'?' ▲':' ▼'; th.appendChild(sp); }
  });
}
function updateBulkBtn() { const b = $("#btnBulkDeleteSales"); if(b) b.style.display = selectedIds.size>0?'inline-flex':'none'; }

async function loadSales() {
  closeRowMenu();
  const q = ($("#q")?.value || "").trim();
  const url = new URL(`/api/Sales`, API);
  url.searchParams.set("page", page); url.searchParams.set("pageSize", pageSize);
  if (q) url.searchParams.set("q", q);
  if (sort) url.searchParams.set("sort", sort); if (dir) url.searchParams.set("dir", dir);
  if (filters.from) url.searchParams.set("from", filters.from);
  if (filters.to) url.searchParams.set("to", filters.to);
  if (filters.status) url.searchParams.set("status", filters.status);

  let out;
  try { out = await apiFetch(url.href, { headers: { "Authorization": `Bearer ${token}` } }); }
  catch (e) { $("#salesTbody").innerHTML = `<tr><td colspan="9" class="err">Немає з'єднання з API</td></tr>`; return; }
  const { res } = out;
  if (res.status === 401) { showToast('error',"Сесія завершилась"); localStorage.removeItem('token'); location.href="../auth/index.html"; return; }
  if (!res.ok) { $("#salesTbody").innerHTML = `<tr><td colspan="9" class="err">Помилка API: ${res.status}</td></tr>`; return; }
  const { items, total } = await res.json();
  renderTable(items); renderPager(total); updateSortIndicators(); updateBulkBtn();
}

function renderTable(items) {
  const tbody = $("#salesTbody"); tbody.innerHTML = "";
  if (!items || !items.length) { tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;opacity:.7">Нічого не знайдено</td></tr>`; return; }
  for (const s of items) {
    const id=s.id??s.saleId, date=s.date??s.Date, clientName=s.clientName??"", productName=s.productName??"", quantity=s.quantity??1, totalPrice=s.totalPrice??s.total??0, payment=s.payment??"", status=s.status??"";
    const tr = document.createElement("tr");
    tr.innerHTML = `<td><input type="checkbox" class="row-cb" data-id="${id}" ${selectedIds.has(id)?'checked':''}></td>
      <td>${fmtDate(date)}</td><td>${clientName}</td><td>${productName}</td><td style="text-align:center">${quantity}</td>
      <td style="text-align:right">${fmtMoney(totalPrice)}</td><td>${payment}</td><td class="${statusClass(status)}">${statusText(status)}</td>
      <td class="actions"><div class="row-actions"><button class="menu-btn" data-id="${id}" title="Дії">⋯</button></div></td>`;
    tbody.appendChild(tr);
  }
}

function statusClass(v){switch((v||"").toLowerCase()){case "done":case "завершено":return "status-done";case "processing":case "в обробці":return "status-processing";case "cancelled":case "скасовано":return "status-cancelled";default:return "";}}
function statusText(v){const s=(v||"").toLowerCase();if(s==="done")return "Завершено";if(s==="processing")return "В обробці";if(s==="cancelled")return "Скасовано";if(s==="returned")return "Повернення";return v||"";}

function renderPager(total){
  const root=$("#pager");const pages=Math.max(1,Math.ceil(total/pageSize));page=Math.min(page,pages);
  let html=`<button class="nav" ${page<=1?"disabled":""} data-page="${page-1}">‹</button>`;
  for(let p=Math.max(1,page-2);p<=Math.min(pages,page+2);p++) html+=`<button class="${p===page?"active":""}" data-page="${p}">${p}</button>`;
  html+=`<button class="nav" ${page>=pages?"disabled":""} data-page="${page+1}">›</button>`;root.innerHTML=html;
}

const portal = document.getElementById("rowMenuPortal");
let currentMenuAnchor = null;
function openRowMenu(btn, saleId){
  if(currentMenuAnchor===btn&&!portal.hidden){closeRowMenu();return;}currentMenuAnchor=btn;
  portal.innerHTML = `<button data-act="edit" data-id="${saleId}">Редагувати</button>
    <button data-act="receipt" data-id="${saleId}">Чек (PDF)</button>
    <button data-act="del" data-id="${saleId}">Видалити</button>`;
  portal.hidden=false;
  requestAnimationFrame(()=>{const r=btn.getBoundingClientRect();let left=Math.min(window.innerWidth-portal.offsetWidth-12,r.right-portal.offsetWidth+2);let top=Math.min(window.innerHeight-portal.offsetHeight-12,r.bottom+8);portal.style.left=`${Math.max(12,left)}px`;portal.style.top=`${Math.max(12,top)}px`;});
}
function closeRowMenu(){portal.hidden=true;currentMenuAnchor=null;}

async function createSale(model){
  const{res}=await apiFetch(`${API}/api/Sales`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify(model)});
  if(!res.ok){const txt=await res.text().catch(()=>"");throw new Error(`Помилка: ${res.status}${txt?` — ${txt}`:""}`);}return await res.json();
}

async function deleteSale(id){
  const{res}=await apiFetch(`${API}/api/Sales/${id}`,{method:"DELETE",headers:{"Authorization":`Bearer ${token}`}});
  if(res.ok){showToast('success','Видалено');await loadSales();}else showToast('error',"Помилка: "+res.status);
}

// PDF receipt with proper blob handling
async function openReceiptPdf(saleId){
  try{
    const res = await fetch(`${API}/api/Receipts/sale/${saleId}/pdf`,{headers:{"Authorization":`Bearer ${token}`}});
    if(!res.ok){showToast('error','Помилка генерації чека: '+res.status);return;}
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url,'_blank');
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(e){showToast('error','Помилка: '+e.message);}
}

async function bulkDeleteSales(){
  if(!selectedIds.size)return;
  confirmAction(`Видалити ${selectedIds.size} продаж(ів)?`,async(ok)=>{
    if(!ok)return;for(const id of selectedIds){await apiFetch(`${API}/api/Sales/${id}`,{method:"DELETE",headers:{"Authorization":`Bearer ${token}`}});}
    showToast('success',`Видалено ${selectedIds.size}`);selectedIds.clear();await loadSales();
  });
}

document.addEventListener("click",(e)=>{
  if(e.target.matches("#selectAllSales")){const c=e.target.checked;$$(".row-cb").forEach(cb=>{cb.checked=c;const id=+cb.dataset.id;c?selectedIds.add(id):selectedIds.delete(id);});updateBulkBtn();return;}
  if(e.target.matches(".row-cb")){const id=+e.target.dataset.id;e.target.checked?selectedIds.add(id):selectedIds.delete(id);updateBulkBtn();return;}
  if(e.target.closest("#btnBulkDeleteSales")){bulkDeleteSales();return;}
  const th=e.target.closest("th[data-sort]");if(th){const s=th.dataset.sort;if(sort===s)dir=(dir==="asc"?"desc":"asc");else{sort=s;dir=(s==="Date"?"desc":"asc");}page=1;loadSales();return;}
  if(e.target.matches("#pager button[data-page]")){const p=+e.target.dataset.page;if(p>0){page=p;loadSales();}return;}
  const btnMenu=e.target.closest(".menu-btn");if(btnMenu){openRowMenu(btnMenu,+btnMenu.dataset.id);return;}
  const act=e.target.closest("#rowMenuPortal [data-act]");
  if(act){const id=+act.dataset.id;
    if(act.dataset.act==="del") confirmAction("Видалити продаж?",(ok)=>{if(ok)deleteSale(id);});
    else if(act.dataset.act==="edit") openEditSaleModal(id);
    else if(act.dataset.act==="receipt") openReceiptPdf(id);
    closeRowMenu();return;}
  if(!e.target.closest("#rowMenuPortal"))closeRowMenu();
});

$("#q")?.addEventListener("input", debounce(()=>{page=1;loadSales();},300));
$("#fApply")?.addEventListener("click",()=>{filters.from=$("#fFrom")?.value||"";filters.to=$("#fTo")?.value||"";filters.status=$("#fStatus")?.value||"";page=1;loadSales();});
$("#fReset")?.addEventListener("click",()=>{$("#fFrom").value=$("#fTo").value="";$("#fStatus").value="";filters={from:"",to:"",status:""};page=1;loadSales();});
$("#sApply")?.addEventListener("click",()=>{sort=$("#sortField").value||"Date";dir=$("#sortDir").value||"desc";page=1;loadSales();});
$("#sReset")?.addEventListener("click",()=>{$("#sortField").value="Date";$("#sortDir").value="desc";sort="Date";dir="desc";page=1;loadSales();});

// === New client phone toggle (через clientMap нижче) ===

// === Create Sale Modal ===
const saleModal=$("#saleModal"),saleForm=$("#saleForm"),sfClient=$("#sfClient"),sfClientId=$("#sfClientId");
function openSaleModal(){saleForm.reset();saleForm.dataset.editId="";$("#saleModalTitle").textContent="Зареєструвати продаж";$("#sfSubmitBtn").textContent="Зберегти";
  const d=new Date();$("#sfDate").value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  sfClientId.value="";$("#clientList").innerHTML="";clientMap={};setPhoneVisible(false);loadMasters("sfMaster",null);saleModal.hidden=false;}
function closeSaleModal(){saleModal.hidden=true;}
$("#btnAddSale")?.addEventListener("click",openSaleModal);
$("#sfCancel")?.addEventListener("click",closeSaleModal);
// modal only closes via Cancel button

// мапа знайдених клієнтів: lower(ПІБ) -> id, для надійного розпізнавання наявного клієнта
let clientMap = {};
function setPhoneVisible(show){
  const row=document.getElementById('sfNewClientPhoneRow');
  if(row) row.style.display = show ? '' : 'none';
  const ph=$("#sfNewClientPhone");
  if(ph){ ph.required = !!show; if(!show) ph.value=''; }
}
function resolveClient(){
  const name=(sfClient.value||'').trim().toLowerCase();
  const id=clientMap[name];
  if(id){ sfClientId.value=id; setPhoneVisible(false); return true; }
  sfClientId.value="";
  setPhoneVisible((sfClient.value||'').trim().length>0);
  return false;
}

sfClient?.addEventListener("input", debounce(async()=>{
  const q=sfClient.value.trim();
  if(!q||q.length<2){$("#clientList").innerHTML="";clientMap={};resolveClient();return;}
  const url=new URL(`/api/Clients`,API);url.searchParams.set("q",q);url.searchParams.set("page",1);url.searchParams.set("pageSize",20);
  const{res}=await apiFetch(url.href,{headers:{"Authorization":`Bearer ${token}`}});if(!res.ok)return;
  const data=await res.json();
  clientMap={};
  $("#clientList").innerHTML=(data.items||[]).map(c=>{clientMap[(c.fullName||'').toLowerCase()]=c.id;return `<option value="${c.fullName}" data-id="${c.id}">${c.phone||''}</option>`;}).join("");
  resolveClient();
},300));
sfClient?.addEventListener("change",resolveClient);
sfClient?.addEventListener("blur",resolveClient);

saleForm?.addEventListener("submit",async(e)=>{
  e.preventDefault();const btn=saleForm.querySelector('button[type="submit"]');btn.disabled=true;
  try{const dateRaw=$("#sfDate").value;const dateValue=dateRaw?`${dateRaw}T00:00:00`:new Date().toISOString();
    if(!saleForm.dataset.editId) resolveClient();
    const clientId=+($("#sfClientId").value||0),clientName=$("#sfClient").value.trim();
    const newPhone=$("#sfNewClientPhone")?.value?.trim()||"";
    if(!clientId&&!clientName){showToast('warning',"Вкажи клієнта");return;}
    const isEditMode=!!saleForm.dataset.editId;if(!isEditMode&&!clientId&&!newPhone){showToast('warning','Вкажи телефон нового клієнта');return;}
    const model={clientId:clientId||null,clientName:clientId?null:clientName,clientPhone:clientId?null:newPhone,date:dateValue,payment:$("#sfPayment").value,status:$("#sfStatus2").value,note:$("#sfNote").value.trim(),
      item:{name:$("#sfProduct").value.trim(),qty:Math.max(1,+$("#sfQty").value||1),price:Math.max(0,+$("#sfPrice").value||0)},upsertService:true,masterId:$("#sfMaster").value?+$("#sfMaster").value:null};
    const editId=saleForm.dataset.editId;
    if(editId){
      const{res}=await apiFetch(`${API}/api/Sales/${editId}`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify(model)});
      if(res.ok||res.status===204)showToast('success','Продаж оновлено');else showToast('error','Помилка: '+res.status);
    }else{await createSale(model);showToast('success','Продаж створено');}
    closeSaleModal();page=1;await loadSales();
  }catch(err){showToast('error',err.message);}finally{btn.disabled=false;}
});

// === Full Edit Sale Modal (reuses create modal) ===
async function openEditSaleModal(id){
  try{const{res}=await apiFetch(`${API}/api/Sales/${id}`,{headers:{"Authorization":`Bearer ${token}`}});
    if(!res.ok){showToast('error','Не знайдено');return;}const sale=await res.json();
    saleForm.reset();saleForm.dataset.editId=id;
    $("#saleModalTitle").textContent="Редагувати продаж";$("#sfSubmitBtn").textContent="Оновити";
    if(sale.date){const d=new Date(sale.date);if(!isNaN(d))$("#sfDate").value=d.toISOString().slice(0,10);}
    $("#sfPayment").value=sale.payment||"Готівка";
    $("#sfClient").value=sale.clientName||"";sfClientId.value="";
    const items=sale.items||[];
    if(items.length){$("#sfProduct").value=items[0].name||"";$("#sfQty").value=items[0].qty||1;$("#sfPrice").value=items[0].price||0;}
    $("#sfStatus2").value=sale.status||"done";
    $("#sfNote").value=sale.note||"";
    clientMap={};setPhoneVisible(false);loadMasters("sfMaster", sale.masterId);
    saleModal.hidden=false;
  }catch(e){showToast('error',e.message);}
}

(()=>{const key=localStorage.getItem("openModal");if(!key)return;localStorage.removeItem("openModal");if(key==="sale")document.getElementById("btnAddSale")?.click();})();
loadSales();
