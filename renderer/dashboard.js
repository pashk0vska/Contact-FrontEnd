<<<<<<< HEAD
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
=======
const API = "http://localhost:5101";
>>>>>>> 32b556b46fa6ebd6d481b68147b0781037af91e8
const token = localStorage.getItem("token");
if (!token) { location.href = "index.html"; }
const headers = { "Authorization": `Bearer ${token}` };

// Date in appbar — same format as other pages
const todayEl = document.getElementById("today");
if (todayEl) {
  const t = new Date().toLocaleDateString("uk-UA", { day: "2-digit", month: "long", year: "numeric" });
  todayEl.textContent = "Сьогодні: " + t;
}

// Username
function usernameFromToken(jwt){
<<<<<<< HEAD
  try{ const [,payload]=jwt.split(".");const bin=atob(payload.replace(/-/g,"+").replace(/_/g,"/"));const json=JSON.parse(new TextDecoder("utf-8").decode(Uint8Array.from(bin,c=>c.charCodeAt(0))));return json.username||json.name||json.unique_name||json.sub||null;}catch{return null;}
=======
  try{ const [,payload]=jwt.split(".");const json=JSON.parse(atob(payload.replace(/-/g,"+").replace(/_/g,"/")));return json.username||json.name||json.unique_name||json.sub||null;}catch{return null;}
>>>>>>> 32b556b46fa6ebd6d481b68147b0781037af91e8
}
const whoEl = document.getElementById("who");
if (whoEl) whoEl.textContent = usernameFromToken(token) || "користувачу";

document.getElementById("logout")?.addEventListener("click",()=>{localStorage.removeItem("token");location.href="index.html";});

const num = n => `₴${Number(n||0).toLocaleString("uk-UA")}`;
const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

function render(d = {}) {
  set("salesToday",d.salesToday??0);set("profitSales",num(d.profitSales??0));set("incomeWeek",num(d.incomeWeek??0));set("newClients",d.newClients??0);
  set("repairsToday",d.repairsToday??0);set("profitRepair",num(d.profitRepair??0));set("clientsTotal",d.clientsTotal??0);
  const tbody = document.getElementById("recentSales");
  if (tbody) { const recent=d.recent??[];tbody.innerHTML=recent.map(r=>`<tr><td>${r.name??""}</td><td>${r.item??""}</td><td>${num(r.price??0)}</td></tr>`).join(""); }
}

async function loadDashboard() {
<<<<<<< HEAD
  try { const { res: r } = await apiFetch(`/api/Dashboard/summary`,{headers});if(!r.ok)throw new Error(`HTTP ${r.status}`);render(await r.json()); }
=======
  try { const r=await fetch(`${API}/api/Dashboard/summary`,{headers});if(!r.ok)throw new Error(`HTTP ${r.status}`);render(await r.json()); }
>>>>>>> 32b556b46fa6ebd6d481b68147b0781037af91e8
  catch(e){ console.error("Dashboard error:",e);render({}); }
}
loadDashboard();

// Quick access buttons — redirect with ?action=add
document.getElementById("quickSale")?.addEventListener("click",()=>{window.location.href="sales.html?action=add";});
document.getElementById("quickRepair")?.addEventListener("click",()=>{window.location.href="repairs.html?action=add";});
document.getElementById("quickClient")?.addEventListener("click",()=>{window.location.href="clients.html?action=add";});

