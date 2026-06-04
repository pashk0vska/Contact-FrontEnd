const t = new Date().toLocaleDateString('uk-UA',{day:'2-digit',month:'long',year:'numeric'});
const elToday = document.getElementById('today'); if (elToday) elToday.textContent = `Сьогодні: ${t}`;
const logoutEl = document.getElementById('logout');
if (logoutEl) logoutEl.addEventListener('click',()=>{localStorage.removeItem('token');localStorage.removeItem('role');location.href="../auth/index.html";});

const API_CANDIDATES = ["http://localhost:5101","https://localhost:7286"];
let API = localStorage.getItem("apiBase") || API_CANDIDATES[0];
const token = localStorage.getItem("token"); if (!token) location.href = "../auth/index.html";

async function apiFetch(path,init={}){
  const tryOnce=async(base)=>{const url=path.startsWith("http")?path:`${base}${path}`;return{res:await fetch(url,init),base};};
  try{return await tryOnce(API);}catch{for(const c of API_CANDIDATES){if(c===API)continue;try{const out=await tryOnce(c);localStorage.setItem("apiBase",c);API=c;return out;}catch{}}throw new Error("API not reachable");}
}

let page=1,pageSize=9,sort="Date",dir="desc";
let filters={status:"",deviceType:"",from:"",to:""};
let viewMode="table";
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const fmtDate=s=>{if(!s)return"";const d=new Date(s);return Number.isNaN(d.getTime())?s:d.toLocaleDateString("uk-UA");};
const fmtMoney=v=>`₴ ${Number(v||0).toLocaleString("uk-UA")}`;

function updateSortIndicators(){$$("th[data-sort]").forEach(th=>{const old=th.querySelector('.sort-ind');if(old)old.remove();if(th.dataset.sort===sort){const sp=document.createElement('span');sp.className='sort-ind';sp.textContent=dir==='asc'?' ▲':' ▼';th.appendChild(sp);}});}

let allRepairs=[];

async function loadRepairs(){
  closeRowMenu();
  const q=($("#q")?.value||"").trim();
  const url=new URL(`/api/Repairs`,API);
  url.searchParams.set("page",page);url.searchParams.set("pageSize",viewMode==="kanban"?200:pageSize);
  if(q)url.searchParams.set("q",q);if(sort)url.searchParams.set("sort",sort);if(dir)url.searchParams.set("dir",dir);
  if(filters.status&&viewMode!=="kanban")url.searchParams.set("status",filters.status);
  if(filters.deviceType)url.searchParams.set("deviceType",filters.deviceType);
  if(filters.from)url.searchParams.set("from",filters.from);if(filters.to)url.searchParams.set("to",filters.to);
  let out;
  try{out=await apiFetch(url.href,{headers:{"Authorization":`Bearer ${token}`}});}catch(e){$("#repairsTbody").innerHTML=`<tr><td colspan="8" class="err">Немає з'єднання з API</td></tr>`;return;}
  const{res}=out;
  if(res.status===401){showToast('error',"Сесія завершилась");localStorage.removeItem('token');location.href="../auth/index.html";return;}
  if(!res.ok){$("#repairsTbody").innerHTML=`<tr><td colspan="8" class="err">Помилка API: ${res.status}</td></tr>`;return;}
  const{items,total}=await res.json(); allRepairs=items||[];
  if(viewMode==="kanban")renderKanban(allRepairs);else{renderTable(allRepairs);renderPager(total);updateSortIndicators();}
}

function renderTable(items){
  const tbody=$("#repairsTbody");tbody.innerHTML="";
  if(!items||!items.length){tbody.innerHTML=`<tr><td colspan="8" style="text-align:center;opacity:.7">Нічого не знайдено</td></tr>`;return;}
  for(const r of items){const id=r.id;const tr=document.createElement("tr");
    tr.innerHTML=`<td>${id}</td><td>${fmtDate(r.date)}</td><td>${r.clientName||""}</td><td>${r.device||""}</td><td>${r.problem||""}</td><td>${renderStatus(r.status)}</td><td style="text-align:right">${fmtMoney(r.price)}</td><td class="more"><button class="menu-btn" data-id="${id}" title="Дії">⋯</button></td>`;
    tbody.appendChild(tr);}
}
function renderStatus(v){const s=(v||"").toLowerCase();const map={"new":["badge new","Новий"],"progress":["badge progress","В процесі"],"done":["badge done","Готово"],"issued":["badge issued","Видано"],"canceled":["badge canceled","Скасовано"]};const x=map[s]||["badge",v||""];return`<span class="${x[0]}">${x[1]}</span>`;}
function renderPager(total){const root=$("#pager");const pages=Math.max(1,Math.ceil(total/pageSize));page=Math.min(page,pages);let html=`<button class="nav" ${page<=1?"disabled":""} data-page="${page-1}">‹</button>`;for(let p=Math.max(1,page-2);p<=Math.min(pages,page+2);p++)html+=`<button class="${p===page?"active":""}" data-page="${p}">${p}</button>`;html+=`<button class="nav" ${page>=pages?"disabled":""} data-page="${page+1}">›</button>`;root.innerHTML=html;}

// Kanban
function renderKanban(items){
  const board=$("#kanbanBoard");if(!board)return;
  const cols={new:[],progress:[],done:[]};
  for(const r of items){const s=(r.status||"").toLowerCase();if(cols[s])cols[s].push(r);}
  const colNames={new:"Новий",progress:"В процесі",done:"Готово"};
  board.innerHTML="";
  for(const[key,label]of Object.entries(colNames)){
    const col=document.createElement("div");col.className="kanban-col";
    col.innerHTML=`<div class="kanban-col-header"><span>${label}</span><span class="kanban-count">${cols[key].length}</span></div><div class="kanban-cards" data-status="${key}"></div>`;
    const cardsEl=col.querySelector('.kanban-cards');
    for(const r of cols[key]){
      const card=document.createElement("div");card.className="kanban-card";card.draggable=true;card.dataset.id=r.id;
      const isDone=(r.status||"").toLowerCase()==="done";
      card.innerHTML=`<div class="kc-header"><strong>#${r.id}</strong><span>${fmtDate(r.date)}</span></div><div class="kc-client">${r.clientName||""}</div><div class="kc-device">${r.device||""}</div><div class="kc-problem">${r.problem||""}</div><div class="kc-price">${fmtMoney(r.price)}</div><div class="kc-actions"><button class="btn-sm" data-act="edit" data-id="${r.id}">Редагувати</button>${isDone?`<button class="btn-sm" data-act="createSale" data-id="${r.id}">Продаж</button>`:""}<button class="btn-sm" data-act="receipt" data-id="${r.id}">Чек</button></div>`;
      card.addEventListener("dragstart",(ev)=>{ev.dataTransfer.setData("text/plain",r.id);card.classList.add("dragging");});
      card.addEventListener("dragend",()=>{card.classList.remove("dragging");});
      cardsEl.appendChild(card);
    }
    cardsEl.addEventListener("dragover",(ev)=>{ev.preventDefault();cardsEl.classList.add("drag-over");});
    cardsEl.addEventListener("dragleave",()=>{cardsEl.classList.remove("drag-over");});
    cardsEl.addEventListener("drop",async(ev)=>{ev.preventDefault();cardsEl.classList.remove("drag-over");const rid=+ev.dataTransfer.getData("text/plain");await updateRepairStatus(rid,cardsEl.dataset.status);});
    board.appendChild(col);
  }
}
async function updateRepairStatus(id,newStatus){
  const r=allRepairs.find(x=>x.id===id);if(!r)return;
  const dto={clientId:null,clientName:r.clientName||"",date:r.date,device:r.device||"",problem:r.problem||"",status:newStatus,price:r.price||0};
  const{res}=await apiFetch(`${API}/api/Repairs/${id}`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify(dto)});
  if(res.ok||res.status===204){showToast('success','Статус оновлено');await loadRepairs();}else showToast('error','Помилка: '+res.status);
}

function setView(mode){
  viewMode=mode;const tableWrap=$(".table-wrap"),pager=$("#pager"),board=$("#kanbanBoard");
  if(mode==="kanban"){page=1;if(tableWrap)tableWrap.style.display="none";if(pager)pager.style.display="none";if(board)board.style.display="flex";$("#btnViewTable")?.classList.remove("active");$("#btnViewKanban")?.classList.add("active");}
  else{if(tableWrap)tableWrap.style.display="";if(pager)pager.style.display="";if(board)board.style.display="none";$("#btnViewTable")?.classList.add("active");$("#btnViewKanban")?.classList.remove("active");}
  loadRepairs();
}
$("#btnViewTable")?.addEventListener("click",()=>setView("table"));
$("#btnViewKanban")?.addEventListener("click",()=>setView("kanban"));

// Portal menu — no emojis
const portal=document.getElementById("rowMenuPortal");let currentMenuAnchor=null;
function openRowMenu(btn,repairId){
  if(currentMenuAnchor===btn&&!portal.hidden){closeRowMenu();return;}currentMenuAnchor=btn;
  const r=allRepairs.find(x=>x.id===repairId);const isDone=(r?.status||"").toLowerCase()==="done";
  portal.innerHTML=`<button data-act="edit" data-id="${repairId}">Редагувати</button>${isDone?`<button data-act="createSale" data-id="${repairId}">Оформити продаж</button>`:""}<button data-act="receipt" data-id="${repairId}">Чек PDF</button><button data-act="del" data-id="${repairId}">Видалити</button>`;
  portal.hidden=false;
  requestAnimationFrame(()=>{const r2=btn.getBoundingClientRect();let left=Math.min(window.innerWidth-portal.offsetWidth-12,r2.right-portal.offsetWidth+2);let top=Math.min(window.innerHeight-portal.offsetHeight-12,r2.bottom+8);portal.style.left=`${Math.max(12,left)}px`;portal.style.top=`${Math.max(12,top)}px`;});
}
function closeRowMenu(){portal.hidden=true;currentMenuAnchor=null;}

async function fetchPdf(url){
  try{const res=await fetch(url,{headers:{"Authorization":`Bearer ${token}`}});
    if(!res.ok){showToast('error','Помилка PDF: '+res.status);return;}
    const blob=await res.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.target='_blank';a.download='document.pdf';document.body.appendChild(a);a.click();a.remove();
  }catch(e){showToast('error',e.message);}
}
async function createRepair(model){const{res}=await apiFetch(`${API}/api/Repairs`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify(model)});if(!res.ok)throw new Error(`Помилка: ${res.status}`);return await res.json();}
async function deleteRepair(id){const{res}=await apiFetch(`${API}/api/Repairs/${id}`,{method:"DELETE",headers:{"Authorization":`Bearer ${token}`}});if(res.ok){showToast('success','Видалено');await loadRepairs();}else showToast('error',"Помилка: "+res.status);}
async function createSaleFromRepair(repairId){
  try{const{res}=await apiFetch(`${API}/api/Repairs/${repairId}/create-sale`,{method:"POST",headers:{"Authorization":`Bearer ${token}`}});
    if(res.ok){const d=await res.json();showToast('success',`Продаж #${d.saleId} створено!`);}else showToast('error','Помилка: '+(await res.text().catch(()=>"")||res.status));
  }catch(e){showToast('error',e.message);}
}

document.addEventListener("click",(e)=>{
  const th=e.target.closest("th[data-sort]");if(th){const s=th.dataset.sort;if(sort===s)dir=(dir==="asc"?"desc":"asc");else{sort=s;dir=(s==="Date"?"desc":"asc");}page=1;loadRepairs();return;}
  if(e.target.matches("#pager button[data-page]")){const p=+e.target.dataset.page;if(p>0){page=p;loadRepairs();}return;}
  const btnMenu=e.target.closest(".menu-btn");if(btnMenu){openRowMenu(btnMenu,+btnMenu.dataset.id);return;}
  const kcAct=e.target.closest("[data-act]");
  if(kcAct&&(kcAct.closest(".kanban-card")||kcAct.closest("#rowMenuPortal"))){
    const id=+kcAct.dataset.id;
    if(kcAct.dataset.act==="del") confirmAction("Видалити ордер?",(ok)=>{if(ok)deleteRepair(id);});
    else if(kcAct.dataset.act==="edit") openEditRepairModal(id);
    else if(kcAct.dataset.act==="createSale") confirmAction("Створити продаж на основі цього ремонту?",(ok)=>{if(ok)createSaleFromRepair(id);});
    else if(kcAct.dataset.act==="receipt") fetchPdf(`${API}/api/Receipts/repair/${id}/pdf`);
    closeRowMenu();return;
  }
  if(!e.target.closest("#rowMenuPortal"))closeRowMenu();
});
$("#q")?.addEventListener("input",debounce(()=>{page=1;loadRepairs();},300));
$("#fApply")?.addEventListener("click",()=>{filters.status=$("#fStatus").value||"";filters.deviceType=$("#fDeviceType").value||"";filters.from=$("#fFrom").value||"";filters.to=$("#fTo").value||"";page=1;loadRepairs();});
$("#fReset")?.addEventListener("click",()=>{$("#fStatus").value="";$("#fDeviceType").value="";$("#fFrom").value="";$("#fTo").value="";filters={status:"",deviceType:"",from:"",to:""};page=1;loadRepairs();});
$("#sApply")?.addEventListener("click",()=>{sort=$("#sortField").value||"Date";dir=$("#sortDir").value||"desc";page=1;loadRepairs();});
$("#sReset")?.addEventListener("click",()=>{$("#sortField").value="Date";$("#sortDir").value="desc";sort="Date";dir="desc";page=1;loadRepairs();});

// New client phone toggle
// (стара setupNewClientPhone прибрана — клієнт розпізнається через clientMap нижче)

// Create/Edit modal
const repairModal=$("#repairModal"),repairForm=$("#repairForm"),rfClient=$("#rfClient"),rfClientId=$("#rfClientId");
function openRepairModal(){repairForm.reset();repairForm.dataset.editId="";$("#repairModalTitle").textContent="Створити ордер";$("#rfSubmitBtn").textContent="Зберегти";
  const d=new Date();$("#rfDate").value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  $("#clientList").innerHTML="";rfClientId.value="";clientMap={};setPhoneVisible(false);repairModal.hidden=false;}
function closeRepairModal(){repairModal.hidden=true;}
$("#btnCreate")?.addEventListener("click",openRepairModal);
$("#rfCancel")?.addEventListener("click",closeRepairModal);


// мапа знайдених клієнтів: lower(ПІБ) -> id, для надійного розпізнавання наявного клієнта
let clientMap = {};
function setPhoneVisible(show){
  const row=document.getElementById('rfNewClientPhoneRow');
  if(row) row.style.display = show ? '' : 'none';
  const ph=$("#rfNewClientPhone");
  if(ph){ ph.required = !!show; if(!show) ph.value=''; }
}
function resolveClient(){
  const name=(rfClient.value||'').trim().toLowerCase();
  const id=clientMap[name];
  if(id){ rfClientId.value=id; setPhoneVisible(false); return true; }
  rfClientId.value="";
  // телефон просимо лише якщо введено нове ім'я, якого немає в базі
  setPhoneVisible((rfClient.value||'').trim().length>0);
  return false;
}

rfClient?.addEventListener("input",debounce(async()=>{
  const q=rfClient.value.trim();
  if(!q||q.length<2){$("#clientList").innerHTML="";clientMap={};resolveClient();return;}
  const url=new URL(`/api/Clients`,API);url.searchParams.set("q",q);url.searchParams.set("page",1);url.searchParams.set("pageSize",20);
  const{res}=await apiFetch(url.href,{headers:{"Authorization":`Bearer ${token}`}});if(!res.ok)return;
  const data=await res.json();
  clientMap={};
  $("#clientList").innerHTML=(data.items||[]).map(c=>{clientMap[(c.fullName||'').toLowerCase()]=c.id;return `<option value="${c.fullName}" data-id="${c.id}">${c.phone||''}</option>`;}).join("");
  resolveClient();
},300));
rfClient?.addEventListener("change",resolveClient);
rfClient?.addEventListener("blur",resolveClient);

repairForm?.addEventListener("submit",async(e)=>{
  e.preventDefault();const btn=repairForm.querySelector('button[type="submit"]');btn.disabled=true;
  try{const dateRaw=$("#rfDate").value;const dateValue=dateRaw?`${dateRaw}T00:00:00`:new Date().toISOString();
    if(!repairForm.dataset.editId) resolveClient();
    const clientId=+(rfClientId.value||0),clientName=rfClient.value.trim();
    if(!clientId&&!clientName){showToast('warning',"Вкажи клієнта");return;}
    const isEditMode2=!!repairForm.dataset.editId;if(!isEditMode2&&!clientId){const phone=$("#rfNewClientPhone").value.trim();if(!phone){showToast("warning","Вкажи телефон нового клієнта");return;}}
    const model={clientId:clientId||null,clientName:clientId?null:clientName,clientPhone:clientId?null:$("#rfNewClientPhone").value.trim(),
      date:dateValue,device:$("#rfDevice").value.trim(),problem:$("#rfProblem").value.trim(),status:$("#rfStatus").value,price:Math.max(0,+$("#rfPrice").value||0)};
    const editId=repairForm.dataset.editId;
    if(editId){const{res}=await apiFetch(`${API}/api/Repairs/${editId}`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify(model)});
      if(res.ok||res.status===204)showToast('success','Ремонт оновлено');else showToast('error','Помилка: '+res.status);
    }else{await createRepair(model);showToast('success','Ордер створено');}
    closeRepairModal();page=1;await loadRepairs();
  }catch(err){showToast('error',err.message);}finally{btn.disabled=false;}
});

async function openEditRepairModal(id){
  try{const{res}=await apiFetch(`${API}/api/Repairs/${id}`,{headers:{"Authorization":`Bearer ${token}`}});
    if(!res.ok){showToast('error','Не знайдено');return;}const r=await res.json();
    repairForm.reset();repairForm.dataset.editId=id;
    $("#repairModalTitle").textContent="Редагувати ордер";$("#rfSubmitBtn").textContent="Оновити";
    if(r.date||r.Date){const d=new Date(r.date||r.Date);if(!isNaN(d))$("#rfDate").value=d.toISOString().slice(0,10);}
    $("#rfStatus").value=r.status||"new";rfClient.value=r.clientName||"";rfClientId.value="";
    clientMap={};setPhoneVisible(false);
    $("#rfDevice").value=r.deviceType||"";$("#rfProblem").value=r.problem||"";$("#rfPrice").value=r.totalCost||0;
    repairModal.hidden=false;
  }catch(e){showToast('error',e.message);}
}

(()=>{const key=localStorage.getItem("openModal");if(!key)return;localStorage.removeItem("openModal");if(key==="repair")document.getElementById("btnCreate")?.click();})();
loadRepairs();
