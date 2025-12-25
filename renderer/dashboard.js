// === базові речі ===
const API = "http://localhost:5101";
const token = localStorage.getItem("token");
if (!token) { location.href = "index.html"; }
const headers = { "Authorization": `Bearer ${token}` };

// Дата в appbar
const todayEl = document.getElementById("today");
function renderDate() {
  if (!todayEl) return;
  todayEl.textContent = new Date().toLocaleDateString("uk-UA", {
    day: "2-digit", month: "long", year: "numeric"
  });
}
renderDate();

// Ім'я користувача у "Вітаємо, ..."
function usernameFromToken(jwt){
  try{
    const [, payload] = jwt.split(".");
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return json.username || json.name || json.unique_name || json.sub || null;
  }catch{ return null; }
}
const whoEl = document.getElementById("who");
if (whoEl) whoEl.textContent = usernameFromToken(token) || "користувачу";

// Вихід
document.getElementById("logout")?.addEventListener("click", ()=>{
  localStorage.removeItem("token");
  location.href = "index.html";
});

// Хелпери
const num = n => `₴${Number(n||0).toLocaleString("uk-UA")}`;
const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

// Рендер KPI + останні продажі
function render(d = {}) {
  set("salesToday",   d.salesToday ?? 0);
  set("profitSales",  num(d.profitSales ?? 0));
  set("incomeWeek",   num(d.incomeWeek ?? 0));
  set("newClients",   d.newClients ?? 0);
  set("repairsToday", d.repairsToday ?? 0);
  set("profitRepair", num(d.profitRepair ?? 0));
  set("clientsTotal", d.clientsTotal ?? 0);

  const tbody = document.getElementById("recentSales");
  if (tbody) {
    const recent = d.recent ?? [];
    tbody.innerHTML = recent.map(r => `
      <tr>
        <td>${r.name ?? ""}</td>
        <td>${r.item ?? ""}</td>
        <td>${num(r.price ?? 0)}</td>
      </tr>
    `).join("");
  }
}

// Завантаження агрегату з бекенду
async function loadDashboard() {
  try {
    const r = await fetch(`${API}/api/Dashboard/summary`, { headers });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    render(d);
  } catch (e) {
    console.error("Dashboard summary error:", e);
    render({}); // показати нулі, щоб не ламати верстку
  }
}
loadDashboard();

// === Кнопки швидкого доступу: одразу відкривати модалки на відповідних сторінках ===
function goToWithModal(page, modalFlagKey){
  localStorage.setItem(modalFlagKey, "1"); // сторінка прочитає і відкриє модалку
  location.href = page;
}
document.getElementById("quickAddClient")?.addEventListener("click", ()=> goToWithModal("clients.html", "openAddClient"));
document.getElementById("quickAddSale")?.addEventListener("click",   ()=> goToWithModal("sales.html",   "openAddSale"));
document.getElementById("quickAddRepair")?.addEventListener("click", ()=> goToWithModal("repairs.html", "openAddRepair"));
