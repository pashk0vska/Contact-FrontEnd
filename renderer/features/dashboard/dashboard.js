const API_CANDIDATES = ["http://localhost:5101", "https://localhost:7286"];
let API = localStorage.getItem("apiBase") || API_CANDIDATES[0];
async function apiFetch(path, init = {}) {
  const tryOnce = async (base) => {
    const url = path.startsWith("http") ? path : `${base}${path}`;
    return { res: await fetch(url, init), base };
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
const token = localStorage.getItem("token");
if (!token) { location.href = "../auth/index.html"; }
const headers = { "Authorization": `Bearer ${token}` };

// Date in appbar — same format as other pages
const todayEl = document.getElementById("today");
if (todayEl) {
  const t = new Date().toLocaleDateString("uk-UA", { day: "2-digit", month: "long", year: "numeric" });
  todayEl.textContent = "Сьогодні: " + t;
}

// Username
function usernameFromToken(jwt){
  try{ const [,payload]=jwt.split(".");const bin=atob(payload.replace(/-/g,"+").replace(/_/g,"/"));const json=JSON.parse(new TextDecoder("utf-8").decode(Uint8Array.from(bin,c=>c.charCodeAt(0))));return json.username||json.name||json.unique_name||json.sub||null;}catch{return null;}
}
const whoEl = document.getElementById("who");
if (whoEl) whoEl.textContent = usernameFromToken(token) || "користувачу";

document.getElementById("logout")?.addEventListener("click",()=>{localStorage.removeItem("token");localStorage.removeItem("role");location.href="../auth/index.html";});

const num = n => `₴${Number(n||0).toLocaleString("uk-UA")}`;
const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

function render(d = {}) {
  set("salesToday",d.salesToday??0);set("profitSales",num(d.profitSales??0));set("incomeWeek",num(d.incomeWeek??0));set("newClients",d.newClients??0);
  set("repairsToday",d.repairsToday??0);set("profitRepair",num(d.profitRepair??0));set("clientsTotal",d.clientsTotal??0);
  const tbody = document.getElementById("recentSales");
  if (tbody) { const recent=d.recent??[];tbody.innerHTML=recent.map(r=>`<tr><td>${r.name??""}</td><td>${r.item??""}</td><td>${num(r.price??0)}</td></tr>`).join(""); }
  renderCharts(d);
}

// ===== Графіки дашборду (Chart.js) — T4 =====
let profitChart=null, statusChart=null;
const STATUS_UA={new:"Новий",progress:"В процесі",done:"Готово",issued:"Видано",canceled:"Скасовано"};
const STATUS_COLOR={new:"#1f8ee2",progress:"#e2b81f",done:"#1fe26a",issued:"#58d27a",canceled:"#e2706a"};
function renderCharts(d){
  if(typeof Chart==="undefined")return;
  const series=d.profitSeries||[];
  const pc=document.getElementById("profitChartCanvas");
  if(pc){
    if(profitChart)profitChart.destroy();
    profitChart=new Chart(pc,{type:"bar",data:{labels:series.map(x=>x.label),datasets:[{label:"Дохід (₴)",data:series.map(x=>x.value),backgroundColor:"rgba(31,226,106,0.35)",borderColor:"#1fe26a",borderWidth:1.5,borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:"#9aa4ad",maxRotation:0,autoSkip:true}},y:{beginAtZero:true,ticks:{color:"#9aa4ad"}}}}});
  }
  const rs=d.repairsByStatus||[];
  const sc=document.getElementById("statusChartCanvas");
  if(sc){
    if(statusChart)statusChart.destroy();
    const labels=rs.map(x=>STATUS_UA[(x.status||"").toLowerCase()]||x.status||"—");
    const data=rs.map(x=>x.count||0);
    const colors=rs.map(x=>STATUS_COLOR[(x.status||"").toLowerCase()]||"#5b6b76");
    if(data.some(v=>v>0)){
      statusChart=new Chart(sc,{type:"doughnut",data:{labels,datasets:[{data,backgroundColor:colors,borderColor:"#11181f",borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom",labels:{color:"#e6e6e6",boxWidth:14}}}}});
    }
  }
}

async function loadDashboard() {
  try { const { res: r } = await apiFetch(`/api/Dashboard/summary`,{headers});if(!r.ok)throw new Error(`HTTP ${r.status}`);render(await r.json()); }
  catch(e){ console.error("Dashboard error:",e);render({}); }
}
loadDashboard();

// Quick access buttons — redirect with ?action=add
document.getElementById("quickSale")?.addEventListener("click",()=>{window.location.href="../sales/sales.html?action=add";});
document.getElementById("quickRepair")?.addEventListener("click",()=>{window.location.href="../repairs/repairs.html?action=add";});
document.getElementById("quickClient")?.addEventListener("click",()=>{window.location.href="../clients/clients.html?action=add";});
