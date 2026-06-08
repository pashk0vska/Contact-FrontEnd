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
const cnt = n => Number(n||0).toLocaleString("uk-UA");
const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

// Підрядок KPI: нейтральний (контекст) та "приріст" (зелений, зі стрілкою)
function subMuted(id, text){ const el=document.getElementById(id); if(el){ el.className='kpi-sub'; el.textContent=text; } }
function subPlus(id, n, label){
  const el=document.getElementById(id); if(!el) return;
  n = Number(n||0);
  if(n>0){ el.className='kpi-sub up'; el.textContent=`▲ +${cnt(n)} ${label}`; }
  else { el.className='kpi-sub'; el.textContent=`${cnt(n)} ${label}`; }
}

function _ini(n){return (n||"").trim().split(/\s+/).slice(0,2).map(s=>s[0]||"").join("").toUpperCase();}
function statusPill(v){const s=(v||"").toLowerCase();const label=(typeof STATUS_UA!=="undefined"&&STATUS_UA[s])||v||"\u2014";const col=(typeof STATUS_COLOR!=="undefined"&&STATUS_COLOR[s])||"#5b6b76";return `<span class="st-pill" style="background:${col}22;color:${col};border:1px solid ${col}55">${label}</span>`;}
function masterCell(name){if(!name)return '<span style="opacity:.4">\u2014</span>';return `<div class="mini-master"><span class="mini-ava">${_ini(name)}</span>${name}</div>`;}

function render(d = {}) {
  set("salesToday",d.salesToday??0);set("profitSales",num(d.profitSales??0));set("incomeWeek",num(d.incomeWeek??0));set("newClients",d.newClients??0);
  set("repairsToday",d.repairsToday??0);set("profitRepair",num(d.profitRepair??0));set("clientsTotal",d.clientsTotal??0);set("activeRepairs",d.activeRepairs??0);

  // Порівняльна / контекстна статистика (з наявних полів відповіді)
  subMuted("subSalesToday",  `за місяць: ${cnt(d.salesMonth??0)}`);
  subMuted("subProfitSales", `за місяць: ${num(d.salesMonthSum??0)}`);
  subMuted("subIncomeWeek",  `за місяць: ${num(d.totalIncomeMonth??0)}`);
  subMuted("subNewClients",  `у базі всього: ${cnt(d.clientsTotal??0)}`);
  subMuted("subRepairsToday",`за місяць: ${cnt(d.repairsMonth??0)}`);
  subMuted("subProfitRepair",`за місяць: ${num(d.repairsMonthSum??0)}`);
  subPlus("subClientsTotal",  d.newClients??0,   "сьогодні");
  subPlus("subActiveRepairs", d.repairsToday??0, "сьогодні");

  const tb = document.getElementById("recentRepairs");
  if (tb) { const rr=d.recentRepairs??[];tb.innerHTML=rr.map(r=>`<tr><td>${r.clientName??""}</td><td>${r.device??""}</td><td>${statusPill(r.status)}</td><td style="text-align:right">${num(r.totalCost??0)}</td><td>${masterCell(r.masterName)}</td></tr>`).join(""); }
  renderCharts(d);
}

// ===== Графіки дашборду (Chart.js) — T4 =====
let profitChart=null, statusChart=null;
const STATUS_UA={new:"Новий",progress:"В процесі",done:"Готово",issued:"Видано",canceled:"Скасовано"};
const STATUS_COLOR={new:"#1f8ee2",progress:"#e2b81f",done:"#1fe26a",issued:"#58d27a",canceled:"#e2706a"};
function renderCharts(d){
  if(typeof Chart==="undefined")return;
  Chart.defaults.font.family="Inter,system-ui,Segoe UI,Roboto,sans-serif";
  Chart.defaults.color="#7d8b96";
  const series=d.profitSeries||[];
  const pc=document.getElementById("profitChartCanvas");
  if(pc){
    if(profitChart)profitChart.destroy();
    const ctx=pc.getContext("2d");
    const g=ctx.createLinearGradient(0,0,0,280);
    g.addColorStop(0,"rgba(31,226,106,0.55)");
    g.addColorStop(1,"rgba(31,226,106,0.04)");
    profitChart=new Chart(pc,{
      type:"bar",
      data:{labels:series.map(x=>x.label),datasets:[{label:"Дохід",data:series.map(x=>x.value),backgroundColor:g,hoverBackgroundColor:"rgba(31,226,106,0.8)",borderRadius:6,borderSkipped:false,maxBarThickness:30}]},
      options:{
        responsive:true,maintainAspectRatio:false,
        layout:{padding:{top:8}},
        plugins:{
          legend:{display:false},
          tooltip:{backgroundColor:"#0b1116",borderColor:"#243039",borderWidth:1,titleColor:"#cdd4da",bodyColor:"#9adf9f",padding:10,displayColors:false,callbacks:{label:c=>" \u20b4 "+Number(c.parsed.y||0).toLocaleString("uk-UA")}}
        },
        scales:{
          x:{grid:{display:false},border:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:8,font:{size:11}}},
          y:{beginAtZero:true,border:{display:false},grid:{color:"rgba(255,255,255,0.06)"},ticks:{maxTicksLimit:5,font:{size:11},callback:v=>v>=1000?(v/1000)+"k":v}}
        }
      }
    });
  }
  const rs=(d.repairsByStatus||[]).filter(x=>(x.count||0)>0);
  const sc=document.getElementById("statusChartCanvas");
  if(sc){
    if(statusChart)statusChart.destroy();
    if(rs.length){
      const labels=rs.map(x=>STATUS_UA[(x.status||"").toLowerCase()]||x.status||"\u2014");
      const data=rs.map(x=>x.count||0);
      const colors=rs.map(x=>STATUS_COLOR[(x.status||"").toLowerCase()]||"#5b6b76");
      statusChart=new Chart(sc,{
        type:"doughnut",
        data:{labels,datasets:[{data,backgroundColor:colors,borderColor:"#0f161c",borderWidth:3,hoverOffset:8,spacing:2}]},
        options:{
          responsive:true,maintainAspectRatio:false,cutout:"66%",
          layout:{padding:8},
          plugins:{
            legend:{position:"bottom",labels:{color:"#cdd4da",usePointStyle:true,pointStyle:"circle",padding:16,boxWidth:8,font:{size:12}}},
            tooltip:{backgroundColor:"#0b1116",borderColor:"#243039",borderWidth:1,titleColor:"#cdd4da",bodyColor:"#e6e6e6",padding:10,callbacks:{label:c=>" "+c.label+": "+c.parsed}}
          }
        }
      });
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
