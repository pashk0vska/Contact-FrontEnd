const API = "http://localhost:5101";
const token = localStorage.getItem("token");

/* Дата у правій частині appbar */
const todayEl = document.getElementById("today");
function renderDate(){
  if (!todayEl) return;
  todayEl.textContent = new Date().toLocaleDateString("uk-UA", {
    day:"2-digit", month:"long", year:"numeric"
  });
}
renderDate();
(function scheduleNextMidnight(){
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1, 0,0,2);
  setTimeout(()=>{ renderDate(); scheduleNextMidnight(); }, next - now);
})();

/* Ім’я користувача з JWT для “Вітаємо, …” */
function usernameFromToken(jwt){
  try{
    const [, payload] = jwt.split(".");
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json.username || json.name || json.unique_name || json.sub || null;
  }catch{ return null; }
}
const whoEl = document.getElementById("who");
if (whoEl) whoEl.textContent = usernameFromToken(token || "") || "користувачу";

/* Вихід */
const logout = document.getElementById("logout");
if (logout){
  logout.addEventListener("click", ()=>{
    localStorage.removeItem("token");
    location.href = "index.html";
  });
}

/* Хелпери */
const headers = token ? { Authorization: `Bearer ${token}` } : {};
const num = n => `₴${Number(n||0).toLocaleString("uk-UA")}`;
const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

/* Рендер (реальні нулі за замовчуванням) */
function render(d = {}){
  set("salesToday",   d.salesToday ?? 0);
  set("profitSales",  num(d.profitSales ?? 0));
  set("incomeWeek",   num(d.incomeWeek ?? 0));
  set("newClients",   d.newClients ?? 0);
  set("repairsToday", d.repairsToday ?? 0);
  set("profitRepair", num(d.profitRepair ?? 0));
  set("clientsTotal", d.clientsTotal ?? 0);

  const recent = (d.recent ?? []);
  const tbody = document.getElementById("recentSales");
  if (tbody){
    tbody.innerHTML = recent.map(r => `
      <tr>
        <td>${r.name ?? ""}</td>
        <td>${r.item ?? ""}</td>
        <td>${num(r.price ?? 0)}</td>
      </tr>`).join("");
  }
}

/* Завантаження агрегату; якщо бек ще порожній — лишаються нулі */
async function loadDashboard(){
  try{
    const r = await fetch(`${API}/api/Dashboard/summary`, { headers });
    if (r.ok){
      const d = await r.json();
      render({
        salesToday:   d.salesToday,
        profitSales:  d.profitSales,
        incomeWeek:   d.incomeWeek,
        newClients:   d.newClients,
        repairsToday: d.repairsToday,
        profitRepair: d.profitRepair,
        clientsTotal: d.clientsTotal,
        recent:       d.recent
      });
      return;
    }
  }catch{/* впаде на запасний шлях */ }

  // запасний шлях — збираємо по частинах:
  let sales={}, repairs={}, clients={}, week={}, recent=[];
  try{ const r = await fetch(`${API}/api/Sales/summary?range=today`, { headers }); if (r.ok) sales   = await r.json(); }catch{}
  try{ const r = await fetch(`${API}/api/Repairs/summary?range=today`, { headers }); if (r.ok) repairs = await r.json(); }catch{}
  try{ const r = await fetch(`${API}/api/Clients/summary`,             { headers }); if (r.ok) clients = await r.json(); }catch{}
  try{ const r = await fetch(`${API}/api/Revenue/summary?range=week`,  { headers }); if (r.ok) week    = await r.json(); }catch{}
  try{ const r = await fetch(`${API}/api/Sales/recent?take=8`,         { headers }); if (r.ok) recent  = await r.json(); }catch{}

  render({
    salesToday:   sales.count ?? sales.salesToday ?? 0,
    profitSales:  sales.profit ?? sales.profitSales ?? 0,
    incomeWeek:   week.total ?? 0,
    newClients:   clients.newToday ?? 0,
    repairsToday: repairs.count ?? 0,
    profitRepair: repairs.profit ?? 0,
    clientsTotal: clients.total ?? 0,
    recent:       (recent.items ?? recent) || []
  });
}
loadDashboard().catch(()=>render());
