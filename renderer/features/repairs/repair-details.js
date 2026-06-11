const t = new Date().toLocaleDateString('uk-UA',{day:'2-digit',month:'long',year:'numeric'});
const elToday = document.getElementById('today'); if (elToday) elToday.textContent = `Сьогодні: ${t}`;
const logoutEl = document.getElementById('logout');
if (logoutEl) logoutEl.addEventListener('click',()=>{localStorage.removeItem('token');localStorage.removeItem('role');location.href="../auth/index.html";});

const API_CANDIDATES = [window.API_BASE];
let API = window.API_BASE;
const token = localStorage.getItem("token"); if (!token) location.href = "../auth/index.html";

async function apiFetch(path,init={}){
  const tryOnce=async(base)=>{const url=path.startsWith("http")?path:`${base}${path}`;return{res:await fetch(url,init),base};};
  try{return await tryOnce(API);}catch{for(const c of API_CANDIDATES){if(c===API)continue;try{const out=await tryOnce(c);localStorage.setItem("apiBase",c);API=c;return out;}catch{}}throw new Error("API not reachable");}
}

const $ = (s,r=document)=>r.querySelector(s);
const escapeHtml = s => (s ?? "").toString().replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmtMoney = v => `₴ ${Number(v||0).toLocaleString("uk-UA")}`;
const fmtDate = s => { if(!s) return "—"; const d=new Date(s); return Number.isNaN(d.getTime())?s:d.toLocaleDateString("uk-UA"); };
const prettyPhone = (v) => (window.phoneToPretty ? window.phoneToPretty(v) : (v || ""));

const params = new URLSearchParams(location.search);
const repairId = params.get("id");

$("#btnBack")?.addEventListener("click",()=>{ location.href="./repairs.html"; });

function statusBadge(v){
  const s=(v||"").toLowerCase();
  const map={new:["badge new","Новий"],progress:["badge progress","В процесі"],done:["badge done","Готово"],issued:["badge issued","Видано"],canceled:["badge canceled","Скасовано"]};
  const x=map[s]||["badge",v||"—"];
  return `<span class="${x[0]}">${x[1]}</span>`;
}

let current = null;

async function load(){
  if(!repairId){ $("#rdContent").innerHTML='<p class="err">Не вказано ремонт.</p>'; return; }
  let out;
  try{ out=await apiFetch(`/api/Repairs/${repairId}`,{headers:{"Authorization":`Bearer ${token}`}}); }
  catch{ $("#rdContent").innerHTML="<p class=\"err\">Немає з'єднання з API</p>"; return; }
  const {res}=out;
  if(res.status===401){ localStorage.removeItem('token'); location.href="../auth/index.html"; return; }
  if(res.status===404){ $("#rdContent").innerHTML='<p class="err">Ремонт не знайдено.</p>'; return; }
  if(!res.ok){ $("#rdContent").innerHTML=`<p class="err">Помилка API: ${res.status}</p>`; return; }
  current = await res.json();
  render(current);
}

function render(r){
  $("#rdId").textContent = `#${r.id}`;
  const c = r.client || {};
  const device = `${r.deviceType||""}${r.model?" "+r.model:""}`.trim() || "—";
  const st = (r.status||"").toLowerCase();
  const closed = st==="done" || st==="issued";
  const canceled = st==="canceled";

  const phonePretty = c.phone ? prettyPhone(c.phone) : "";
  const phone = c.phone ? `<a href="tel:${escapeHtml(c.phone)}" style="color:#1fe26a">${escapeHtml(phonePretty)}</a>` : "—";
  const email = c.email ? `<a href="mailto:${escapeHtml(c.email)}" style="color:#1fe26a">${escapeHtml(c.email)}</a>` : "—";

  $("#rdContent").innerHTML = `
    <div class="rd-grid">
      <div class="panel">
        <h3>Клієнт</h3>
        <div class="rd-row"><span class="k">ПІБ</span><span class="v">${escapeHtml(c.fullName||r.clientName||"—")}</span></div>
        <div class="rd-row"><span class="k">Телефон</span><span class="v">${phone}</span></div>
        <div class="rd-row"><span class="k">Email</span><span class="v">${email}</span></div>
        <h3 style="margin-top:18px">Пристрій</h3>
        <div class="rd-row"><span class="k">Пристрій</span><span class="v">${escapeHtml(device)}</span></div>
        <div class="rd-row"><span class="k">Проблема</span><span class="v">${escapeHtml(r.problem||"—")}</span></div>
        <div class="rd-row"><span class="k">Примітки / запчастини</span><span class="v">${escapeHtml(r.partsUsed||"—")}</span></div>
      </div>
      <div class="panel">
        <h3>Стан</h3>
        <div class="rd-row"><span class="k">Статус</span><span class="v">${statusBadge(r.status)}</span></div>
        <div class="rd-row"><span class="k">Майстер</span><span class="v">${escapeHtml(r.masterName||"— не призначено —")}</span></div>
        <div class="rd-row"><span class="k">Вартість</span><span class="v">${fmtMoney(r.totalCost)}</span></div>
        <div class="rd-row"><span class="k">Створено</span><span class="v">${fmtDate(r.createdAt)}</span></div>
        <div class="rd-actions">
          <button id="rdEdit" class="btn-ghost" type="button">Редагувати</button>
          <button id="rdReceipt" class="btn-ghost" type="button">Чек PDF</button>
          <button id="rdClose" class="btn" type="button" ${closed?"disabled":""}>Закрити ремонт</button>
          <button id="rdCancel" class="btn-danger" type="button" ${canceled?"disabled":""}>Відмова клієнта</button>
        </div>
      </div>
    </div>`;

  $("#rdEdit")?.addEventListener("click",()=>{ localStorage.setItem("openEditRepair", String(r.id)); location.href="./repairs.html"; });
  $("#rdReceipt")?.addEventListener("click",()=>{ location.href=`../receipt/receipt.html?type=repair&id=${r.id}&back=repairs`; });
  $("#rdClose")?.addEventListener("click",()=>confirmAction("Закрити ремонт (статус «Готово»)?",(ok)=>{if(ok)setStatus("done");}));
  $("#rdCancel")?.addEventListener("click",()=>confirmAction("Позначити як «Відмова клієнта» (скасувати)?",(ok)=>{if(ok)setStatus("canceled");}));
}

async function setStatus(newStatus){
  if(!current) return;
  const dto = {
    clientId: null,
    clientName: current.clientName || (current.client && current.client.fullName) || "",
    date: current.createdAt,
    device: current.deviceType || "",
    problem: current.problem || "",
    status: newStatus,
    price: current.totalCost || 0,
    masterId: current.masterId ?? null
  };
  try{
    const {res}=await apiFetch(`${API}/api/Repairs/${current.id}`,{method:"PUT",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:JSON.stringify(dto)});
    if(res.ok||res.status===204){ showToast('success','Статус оновлено'); await load(); }
    else showToast('error','Помилка: '+((await res.text().catch(()=>""))||res.status));
  }catch(e){ showToast('error',e.message); }
}

load();
