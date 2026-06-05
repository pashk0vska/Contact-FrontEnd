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
  portal.innerHTML = `<button data-act="details" data-id="${saleId}">Деталі</button>
    <button data-act="edit" data-id="${saleId}">Редагувати</button>
    <button data-act="duplicate" data-id="${saleId}">Дублювати</button>
    <button data-act="receipt" data-id="${saleId}">Чек (PDF)</button>
    <button data-act="invoice" data-id="${saleId}">Накладна</button>
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
    else if(act.dataset.act==="details") openSaleDetails(id);
    else if(act.dataset.act==="duplicate") confirmAction("Дублювати цей продаж?",(ok)=>{if(ok)duplicateSale(id);});
    else if(act.dataset.act==="receipt") openReceiptPdf(id);
    else if(act.dataset.act==="invoice") openReceiptPdf(id);
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
// ===== POS: позиції продажу (T6) =====
function addItemRow(item){
  const wrap=document.getElementById('sfItems'); if(!wrap) return;
  const div=document.createElement('div'); div.className='pos-row';
  div.innerHTML='<select class="pi-type"><option value="product">Товар</option><option value="service">Послуга</option><option value="build">Збірка</option></select>'
    +'<input class="pi-name" type="text" placeholder="Назва позиції">'
    +'<input class="pi-qty" type="number" min="1" value="1">'
    +'<input class="pi-price" type="number" min="0" value="0">'
    +'<span class="pi-sum">₴ 0</span>'
    +'<button type="button" class="pi-del" title="Прибрати">✕</button>';
  wrap.appendChild(div);
  if(item){
    div.querySelector('.pi-type').value=(item.type||'product');
    div.querySelector('.pi-name').value=item.name||'';
    div.querySelector('.pi-qty').value=item.qty||1;
    div.querySelector('.pi-price').value=item.price||0;
  }
  recalcTotal();
}
function resetItems(){const w=document.getElementById('sfItems'); if(w) w.innerHTML=''; addItemRow();}
function rowSum(r){return Math.max(1,+r.querySelector('.pi-qty').value||1)*Math.max(0,+r.querySelector('.pi-price').value||0);}
function recalcTotal(){
  let t=0;
  document.querySelectorAll('#sfItems .pos-row').forEach(r=>{const s=rowSum(r);t+=s;const sp=r.querySelector('.pi-sum');if(sp)sp.textContent=fmtMoney(s);});
  const el=document.getElementById('sfTotal'); if(el) el.textContent=fmtMoney(t);
}
function collectItems(){
  const out=[];
  document.querySelectorAll('#sfItems .pos-row').forEach(r=>{
    const name=r.querySelector('.pi-name').value.trim(); if(!name) return;
    out.push({name,qty:Math.max(1,+r.querySelector('.pi-qty').value||1),price:Math.max(0,+r.querySelector('.pi-price').value||0),type:r.querySelector('.pi-type').value||'product'});
  });
  return out;
}
document.getElementById('sfAddItem')?.addEventListener('click',()=>addItemRow());
document.getElementById('sfItems')?.addEventListener('input',recalcTotal);
document.getElementById('sfItems')?.addEventListener('click',(e)=>{
  const del=e.target.closest('.pi-del'); if(!del) return;
  const rows=document.querySelectorAll('#sfItems .pos-row');
  if(rows.length<=1){const r=del.closest('.pos-row');r.querySelector('.pi-name').value='';r.querySelector('.pi-qty').value=1;r.querySelector('.pi-price').value=0;}
  else del.closest('.pos-row').remove();
  recalcTotal();
});

function openSaleModal(){saleForm.reset();saleForm.dataset.editId="";$("#saleModalTitle").textContent="Зареєструвати продаж";$("#sfSubmitBtn").textContent="Зберегти";
  const d=new Date();$("#sfDate").value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  sfClientId.value="";$("#clientList").innerHTML="";clientMap={};setPhoneVisible(false);loadMasters("sfMaster",null);resetItems();saleModal.hidden=false;}
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

async function submitSale(openReceipt){
  const btn=document.getElementById('sfSubmitBtn');const rbtn=document.getElementById('sfReceipt');
  btn.disabled=true; if(rbtn) rbtn.disabled=true;
  try{const dateRaw=$("#sfDate").value;const dateValue=dateRaw?`${dateRaw}T00:00:00`:new Date().toISOString();
    if(!saleForm.dataset.editId) resolveClient();
    const clientId=+($("#sfClientId").value||0),clientName=$("#sfClient").value.trim();
    const newPhone=$("#sfNewClientPhone")?.value?.trim()||"";
    if(!clientId&&!clientName){showToast('warning',"Вкажи клієнта");return;}
    const isEditMode=!!saleForm.dataset.editId;if(!isEditMode&&!clientId&&!newPhone){showToast('warning','Вкажи телефон нового клієнта');return;}
    const saleItems=collectItems(); if(!saleItems.length){showToast('warning','Додай хоча б одну позицію');return;}
    const model={clientId:clientId||null,clientName:clientId?null:clientName,clientPhone:clientId?null:newPhone,date:dateValue,payment:$("#sfPayment").value,status:$("#sfStatus2").value,note:$("#sfNote").value.trim(),
      items:saleItems,upsertService:true,masterId:$("#sfMaster").value?+$("#sfMaster").value:null};
    const editId=saleForm.dataset.editId;
    let saleId=editId?+editId:null;
    if(editId){
      const{res}=await apiFetch(`${API}/api/Sales/${editId}`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify(model)});
      if(res.ok||res.status===204)showToast('success','Продаж оновлено');else{showToast('error','Помилка: '+res.status);return;}
    }else{const d=await createSale(model);saleId=d&&d.id?d.id:null;showToast('success','Продаж створено');}
    closeSaleModal();page=1;await loadSales();
    if(openReceipt&&saleId) openReceiptPdf(saleId);
  }catch(err){showToast('error',err.message);}
  finally{btn.disabled=false; if(rbtn) rbtn.disabled=false;}
}
saleForm?.addEventListener("submit",(e)=>{e.preventDefault();submitSale(false);});
document.getElementById('sfReceipt')?.addEventListener('click',()=>submitSale(true));

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
    const wrap=document.getElementById('sfItems'); if(wrap) wrap.innerHTML='';
    if(items.length){for(const it of items) addItemRow(it);} else { addItemRow(); }
    $("#sfStatus2").value=sale.status||"done";
    $("#sfNote").value=sale.note||"";
    clientMap={};setPhoneVisible(false);loadMasters("sfMaster", sale.masterId);
    saleModal.hidden=false;
  }catch(e){showToast('error',e.message);}
}

async function duplicateSale(id){
  try{const{res}=await apiFetch(`${API}/api/Sales/${id}/duplicate`,{method:"POST",headers:{"Authorization":`Bearer ${token}`}});
    if(res.ok){const d=await res.json().catch(()=>({}));showToast('success','Продаж дубльовано'+(d&&d.id?` (#${d.id})`:''));page=1;await loadSales();}
    else showToast('error','Помилка: '+((await res.text().catch(()=>""))||res.status));
  }catch(e){showToast('error',e.message);}
}

const saleDetailsModal=document.getElementById('saleDetailsModal');
document.getElementById('sdClose')?.addEventListener('click',()=>{saleDetailsModal.hidden=true;});
const SALE_TYPE={product:'Товар',service:'Послуга',build:'Збірка',repair:'Ремонт'};
async function openSaleDetails(id){
  document.getElementById('sdContent').innerHTML='<p style="opacity:.7">Завантаження…</p>';
  saleDetailsModal.hidden=false;
  try{
    const{res}=await apiFetch(`${API}/api/Sales/${id}`,{headers:{"Authorization":`Bearer ${token}`}});
    if(!res.ok){document.getElementById('sdContent').innerHTML='<p class="err">Помилка: '+res.status+'</p>';return;}
    const sale=await res.json();
    document.getElementById('sdTitle').textContent=`Продаж #${sale.id}`;
    const items=sale.items||[];
    let rows=items.map(it=>`<tr><td>${it.name||''}</td><td>${SALE_TYPE[(it.type||'product').toLowerCase()]||it.type||''}</td><td style="text-align:center">${it.qty||1}</td><td style="text-align:right">${fmtMoney(it.price)}</td><td style="text-align:right">${fmtMoney((it.price||0)*(it.qty||1))}</td></tr>`).join('');
    if(!rows) rows='<tr><td colspan="5" style="opacity:.6;text-align:center">Без позицій</td></tr>';
    document.getElementById('sdContent').innerHTML=`
      <div class="sd-grid">
        <div><span class="sd-k">Клієнт</span><div class="sd-v">${sale.clientName||'—'}</div></div>
        <div><span class="sd-k">Дата</span><div class="sd-v">${fmtDate(sale.date)}</div></div>
        <div><span class="sd-k">Оплата</span><div class="sd-v">${sale.payment||'—'}</div></div>
        <div><span class="sd-k">Статус</span><div class="sd-v">${statusText(sale.status)}</div></div>
        <div><span class="sd-k">Майстер</span><div class="sd-v">${sale.masterName||'—'}</div></div>
        <div><span class="sd-k">Примітка</span><div class="sd-v">${sale.note||'—'}</div></div>
      </div>
      <table class="table-mini" style="margin-top:14px"><thead><tr><th>Назва</th><th>Тип</th><th>К-ть</th><th>Ціна</th><th>Сума</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="text-align:right;margin-top:12px;font-weight:800;font-size:16px">Разом: <span style="color:#1fe26a">${fmtMoney(sale.total)}</span></div>
      <div class="actions" style="margin-top:14px"><button class="btn-ghost" id="sdReceiptBtn" type="button">Чек (PDF)</button></div>`;
    document.getElementById('sdReceiptBtn')?.addEventListener('click',()=>openReceiptPdf(sale.id));
  }catch(e){document.getElementById('sdContent').innerHTML='<p class="err">'+e.message+'</p>';}
}

(()=>{const key=localStorage.getItem("openModal");if(!key)return;localStorage.removeItem("openModal");if(key==="sale")document.getElementById("btnAddSale")?.click();})();
loadSales();
