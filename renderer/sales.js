const API = "http://localhost:5101";
const token = localStorage.getItem("token");
const headers = token ? { Authorization: `Bearer ${token}`, "Content-Type":"application/json" } : { "Content-Type":"application/json" };

/* ====== APPBAR DATE ====== */
const todayEl = document.getElementById("today");
function renderDate(){
  if (!todayEl) return;
  todayEl.textContent = new Date().toLocaleDateString("uk-UA",{ day:"2-digit", month:"long", year:"numeric" });
}
renderDate();

/* ====== LOGOUT ====== */
const logout = document.getElementById('logout');
        if (logout) logout.addEventListener('click', ()=>{ localStorage.removeItem('token'); location.href='index.html'; });

/* ====== STATE ====== */
let page = 1, pageSize = 10, lastSelectedId = null;

/* ====== HELPERS ====== */
const num = n => `₴${Number(n||0).toLocaleString("uk-UA")}`;
function el(id){ return document.getElementById(id); }
function qs(sel,root=document){ return root.querySelector(sel); }
function qsa(sel,root=document){ return Array.from(root.querySelectorAll(sel)); }

/* ====== LOAD LIST ====== */
async function loadSales(){
  const q      = el("q").value.trim();
  const dateFrom = el("dateFrom").value || "";
  const dateTo   = el("dateTo").value || "";
  const pay    = el("pay").value;
  const status = el("status").value;
  const sort   = el("sort").value;

  const url = new URL(`${API}/api/Sales`);
  url.searchParams.set("page", page);
  url.searchParams.set("pageSize", pageSize);
  if (q) url.searchParams.set("q", q);
  if (dateFrom) url.searchParams.set("dateFrom", dateFrom);
  if (dateTo) url.searchParams.set("dateTo", dateTo);
  if (pay) url.searchParams.set("pay", pay);
  if (status) url.searchParams.set("status", status);
  if (sort) url.searchParams.set("sort", sort);

  try{
    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error("load failed");
    const data = await r.json();
    renderTable(data.items || data.data || [], data.total || data.count || 0);
  }catch{
    // fallback демо-дані якщо API ще не готовий
    const demo = [
      { id:1, date:"2025-10-22", client:"Анна П.", item:"Ноутбук", qty:1, price:24000, pay:"Готівка", status:"Завершено" },
      { id:2, date:"2025-10-21", client:"Микола С.", item:"Монітор", qty:2, price:32000, pay:"Картка", status:"Завершено" },
    ];
    renderTable(demo, demo.length);
  }
}

function renderTable(rows, total){
  const body = el("salesBody");
  body.innerHTML = rows.map(r=>`
    <tr data-id="${r.id}">
      <td>${new Date(r.date || r.createdAt || Date.now()).toLocaleDateString("uk-UA")}</td>
      <td>${r.client ?? r.customer ?? ""}</td>
      <td>${r.item ?? r.product ?? ""}</td>
      <td>${r.qty ?? r.quantity ?? 1}</td>
      <td>${num(r.price)}</td>
      <td>${r.pay ?? r.payment ?? ""}</td>
      <td class="${(r.status||"").includes("Заверш")?"ok":(r.status||"").includes("оброб")?"warn":""}">${r.status ?? ""}</td>
      <td>...</td>
    </tr>
  `).join("");

  // вибір рядка
  qsa("tr", body).forEach(tr=>{
    tr.addEventListener("click", ()=>{
      qsa("tr.selected", body).forEach(x=>x.classList.remove("selected"));
      tr.classList.add("selected");
      lastSelectedId = tr.dataset.id;
      el("btnReceipt").disabled = !lastSelectedId;
    })
  });

  // пагінація
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const pager = el("pager"); pager.innerHTML = "";
  for(let p=1;p<=pages;p++){
    const b = document.createElement("button");
    b.textContent = p;
    if (p===page) b.classList.add("active");
    b.addEventListener("click", ()=>{ page=p; loadSales(); });
    pager.appendChild(b);
  }
}

/* ====== FILTERS ====== */
el("btnApply").addEventListener("click", ()=>{ page=1; loadSales(); });
el("btnReset").addEventListener("click", ()=>{
  ["q","dateFrom","dateTo","pay","status","sort"].forEach(id=>{ const x=el(id); if(x.tagName==="SELECT") x.selectedIndex=0; else x.value=""; });
  page=1; loadSales();
});
el("q").addEventListener("keydown", e=>{ if(e.key==="Enter"){ page=1; loadSales(); } });

/* ====== RECEIPT (плейсхолдер) ====== */
el("btnReceipt").addEventListener("click", ()=>{
  if (!lastSelectedId) return;
  alert(`Чек буде згенеровано для продажу #${lastSelectedId}. (Реалізуємо пізніше)`);
});

/* ====== MODAL + CREATE ====== */
const modal = el("saleModal");
function openModal(){ modal.setAttribute("aria-hidden","false"); }
function closeModal(){ modal.setAttribute("aria-hidden","true"); }
qsa("[data-close]", modal).forEach(btn=>btn.addEventListener("click", closeModal));
el("btnCreate").addEventListener("click", ()=>{
  resetForm();
  openModal();
});
modal.addEventListener("click", e=>{ if (e.target.classList.contains("modal-backdrop")) closeModal(); });

/* Додавання рядка товару */
function addItemRow(preset={}){
  const wrap = el("itemsWrap");
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <input class="p-name" placeholder="Назва товару" list="productsList">
    <datalist id="productsList"></datalist>
    <input class="p-qty" type="number" min="1" value="${preset.qty||1}">
    <input class="p-price" type="number" min="0" step="0.01" value="${preset.price||0}">
    <div class="sum">${num( (preset.qty||1) * (preset.price||0) )}</div>
    <button type="button" class="rm">×</button>
  `;
  wrap.appendChild(row);

  const qty = qs(".p-qty", row), price = qs(".p-price", row), sum = qs(".sum", row);
  function recalc(){ sum.textContent = num((+qty.value||0) * (+price.value||0)); }
  qty.addEventListener("input", recalc); price.addEventListener("input", recalc);

  qs(".rm", row).addEventListener("click", ()=> row.remove());
  // автопідказка продуктів
  qs(".p-name", row).addEventListener("input", e=> searchProducts(e.target.value));
}
el("addItem").addEventListener("click", ()=> addItemRow());

function resetForm(){
  el("clientSearch").value = "";
  el("newClientName").value = "";
  el("newClientEmail").value = "";
  el("payType").selectedIndex = 0;
  el("saleStatus").selectedIndex = 1;
  el("note").value = "";
  el("itemsWrap").innerHTML = "";
  addItemRow();
}

/* Пошук клієнтів/продуктів для datalist */
let clientSuggestTimer = null;
el("clientSearch").addEventListener("input", e=>{
  clearTimeout(clientSuggestTimer);
  clientSuggestTimer = setTimeout(()=> searchClients(e.target.value), 250);
});

async function searchClients(query){
  if (!query) { el("clientsList").innerHTML=""; return; }
  try{
    const r = await fetch(`${API}/api/Clients?search=${encodeURIComponent(query)}&take=8`, { headers });
    if (!r.ok) throw 0;
    const data = await r.json();
    el("clientsList").innerHTML = (data.items||data).map(c=>`<option value="${c.name||c.fullName||c.email||""}"></option>`).join("");
  }catch{ /* без підказок */ }
}
async function searchProducts(query){
  if (!query) return;
  try{
    const r = await fetch(`${API}/api/Products?search=${encodeURIComponent(query)}&take=8`, { headers });
    if (!r.ok) throw 0;
    const data = await r.json();
    qsa("#productsList").forEach(dl=>{
      dl.innerHTML = (data.items||data).map(p=>`<option value="${p.name||""}"></option>`).join("");
    });
  }catch{}
}

/* Сабміт форми створення продажу */
el("saleForm").addEventListener("submit", async (e)=>{
  e.preventDefault();

  // хто клієнт?
  const existingName = el("clientSearch").value.trim();
  const newName = el("newClientName").value.trim();
  const newEmail = el("newClientEmail").value.trim();

  const items = qsa(".item-row", el("itemsWrap")).map(r=>{
    return {
      name: qs(".p-name", r).value.trim(),
      qty:  Number(qs(".p-qty", r).value || 0),
      price:Number(qs(".p-price", r).value || 0)
    };
  }).filter(x=>x.name && x.qty>0);

  if (!items.length){ alert("Додайте хоча б один товар"); return; }

  const payload = {
    client: existingName || newName || "Клієнт",
    clientEmail: newEmail || null,
    items,
    payment: el("payType").value,
    status: el("saleStatus").value,
    note: el("note").value || null
  };

  try{
    const r = await fetch(`${API}/api/Sales`, { method:"POST", headers, body:JSON.stringify(payload) });
    if (!r.ok) throw new Error(await r.text());
    closeModal();
    page = 1;
    loadSales();
  }catch(err){
    alert("Помилка збереження продажу.\n" + (err?.message || ""));
  }
});

/* ====== INIT ====== */
loadSales();
