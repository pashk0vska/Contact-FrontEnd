// ===== Параметри сторінки =====
const params = new URLSearchParams(location.search);
const RC_TYPE = (params.get("type") || "sale").toLowerCase();   // sale | repair
const RC_ID   = params.get("id");
const RC_BACK = params.get("back") || "";

// ===== API =====
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

const paper = document.getElementById("paper");
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const money = v => `${Number(v||0).toLocaleString("uk-UA",{minimumFractionDigits:2,maximumFractionDigits:2})} ₴`;
const SALE_TYPE = { product:"Товар", service:"Послуга", build:"Збірка", repair:"Ремонт" };
function fmtDateTime(s){
  if(!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("uk-UA",{day:"2-digit",month:"2-digit",year:"numeric"}) + " " +
         d.toLocaleTimeString("uk-UA",{hour:"2-digit",minute:"2-digit"});
}

// Шапка чека (логотип + реквізити майстерні)
function headHtml(){
  return `
    <div class="rc-head">
      <img class="rc-logo" src="../../assets/logo-bw.png" alt="КОНТАКТ">
      <div class="rc-shop">Сервісний центр «Контакт»</div>
      <div class="rc-sub">ФОП Марціновський О.В.</div>
      <div class="rc-sub">м. Коломия, вул. Валова 36В · +380 96 664 30 00</div>
    </div>`;
}

function renderSale(s){
  const items = s.items || [];
  const rows = items.length ? items.map(it=>`
      <tr>
        <td><span class="it-name">${esc(it.name||"")}</span><span class="it-type">${esc(SALE_TYPE[(it.type||"product").toLowerCase()]||"")}</span></td>
        <td class="qty">${it.qty||1}</td>
        <td class="num">${money(it.price)}</td>
        <td class="num">${money((it.price||0)*(it.qty||1))}</td>
      </tr>`).join("")
    : `<tr><td colspan="4" style="text-align:center;color:#999;padding:14px 0">Без позицій</td></tr>`;

  paper.innerHTML = `
    ${headHtml()}
    <div class="rc-meta"><div class="rc-no">Чек № S-${String(s.id).padStart(4,"0")}</div><div class="rc-date">${esc(fmtDateTime(s.date))}</div></div>
    <div class="rc-info">
      <div class="rc-row"><span class="k">Клієнт</span><span class="v">${esc(s.clientName||"—")}</span></div>
      <div class="rc-row"><span class="k">Оплата</span><span class="v">${esc(s.payment||"—")}</span></div>
      ${s.masterName?`<div class="rc-row"><span class="k">Майстер</span><span class="v">${esc(s.masterName)}</span></div>`:""}
    </div>
    <table class="rc-table">
      <thead><tr><th>Найменування</th><th class="qty">К-ть</th><th class="num">Ціна</th><th class="num">Сума</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="rc-total"><span class="lbl">До сплати</span><span class="amt">${money(s.total)}</span></div>
    <div class="rc-foot"><div class="pay">Спосіб оплати: ${esc(s.payment||"—")}</div>Дякуємо за звернення!</div>`;
}

function renderRepair(r){
  const device = `${r.deviceType||""}${r.model?" "+r.model:""}`.trim() || "—";
  const c = r.client || {};
  paper.innerHTML = `
    ${headHtml()}
    <div class="rc-meta"><div class="rc-no">Акт № R-${String(r.id).padStart(4,"0")}</div><div class="rc-date">${esc(fmtDateTime(r.createdAt))}</div></div>
    <div class="rc-info">
      <div class="rc-row"><span class="k">Клієнт</span><span class="v">${esc(c.fullName||r.clientName||"—")}</span></div>
      ${c.phone?`<div class="rc-row"><span class="k">Телефон</span><span class="v">${esc(window.phoneToPretty?phoneToPretty(c.phone):c.phone)}</span></div>`:""}
      <div class="rc-row"><span class="k">Пристрій</span><span class="v">${esc(device)}</span></div>
      <div class="rc-row"><span class="k">Несправність</span><span class="v">${esc(r.problem||"—")}</span></div>
      ${r.partsUsed?`<div class="rc-row"><span class="k">Запчастини / роботи</span><span class="v">${esc(r.partsUsed)}</span></div>`:""}
    </div>
    <div class="rc-total"><span class="lbl">Вартість</span><span class="amt">${money(r.totalCost)}</span></div>
    <div class="rc-foot">Дякуємо за звернення!</div>`;
}

async function load(){
  if(!RC_ID){ paper.innerHTML = `<div class="rc-error">Не вказано документ.</div>`; return; }
  const path = RC_TYPE === "repair" ? `/api/Repairs/${RC_ID}` : `/api/Sales/${RC_ID}`;
  let out;
  try{ out = await apiFetch(path, { headers:{ "Authorization":`Bearer ${token}` } }); }
  catch{ paper.innerHTML = `<div class="rc-error">Немає з'єднання з API.</div>`; return; }
  const { res } = out;
  if(res.status===401){ localStorage.removeItem("token"); location.href="../auth/index.html"; return; }
  if(res.status===404){ paper.innerHTML = `<div class="rc-error">Документ не знайдено.</div>`; return; }
  if(!res.ok){ paper.innerHTML = `<div class="rc-error">Помилка API: ${res.status}</div>`; return; }
  const data = await res.json();
  document.title = (RC_TYPE==="repair"?`Акт R-${RC_ID}`:`Чек S-${RC_ID}`) + " — Контакт";
  if(RC_TYPE==="repair") renderRepair(data); else renderSale(data);
}

// ===== Дії =====
function goBack(){
  if (window.history.length > 1) { window.history.back(); return; }
  const map = { sales:"../sales/sales.html", repairs:"../repairs/repairs.html" };
  location.href = map[RC_BACK] || "../dashboard/dashboard.html";
}

// Завантажити серверний PDF (надійний download, без window.open)
async function savePdf(){
  const path = RC_TYPE === "repair" ? `/api/Receipts/repair/${RC_ID}/pdf` : `/api/Receipts/sale/${RC_ID}/pdf`;
  try{
    const res = await fetch(`${API}${path}`, { headers:{ "Authorization":`Bearer ${token}` } });
    if(!res.ok){ if(window.showToast) showToast("error","Помилка PDF: "+res.status); return; }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (RC_TYPE==="repair"?`act-R-${RC_ID}`:`receipt-S-${RC_ID}`)+".pdf";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 60000);
  }catch(e){ if(window.showToast) showToast("error", e.message); }
}

document.getElementById("rcPrint")?.addEventListener("click", ()=>window.print());
document.getElementById("rcPdf")?.addEventListener("click", savePdf);
document.getElementById("rcBack")?.addEventListener("click", goBack);

load();
