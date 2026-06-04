// ===== Appbar / logout =====
const t = new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
const elToday = document.getElementById('today'); if (elToday) elToday.textContent = `Сьогодні: ${t}`;
const logoutEl = document.getElementById('logout');
if (logoutEl) logoutEl.addEventListener('click', () => { localStorage.removeItem('token'); localStorage.removeItem('role'); location.href = "../auth/index.html"; });

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

const $ = (s, r = document) => r.querySelector(s);
const escapeHtml = s => (s ?? "").replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const authHeaders = { "Authorization": `Bearer ${token}` };

// ===== Caller role / identity =====
const myRole = (window.getUserRole && window.getUserRole()) || '';
if (myRole && myRole !== 'superadmin' && myRole !== 'admin') {
  // master сюди не має доступу (бекенд також поверне 403)
  location.replace("../dashboard/dashboard.html");
}
function myUsername() {
  try {
    const [, p] = token.split('.');
    const bin = atob(p.replace(/-/g, '+').replace(/_/g, '/'));
    const j = JSON.parse(new TextDecoder('utf-8').decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    return j.username || j.name || j.unique_name || j.sub || '';
  } catch { return ''; }
}
const ME = myUsername();

const ROLE_LABEL = { superadmin: 'СуперАдмін', admin: 'Адміністратор', master: 'Майстер' };
function roleBadge(r) { const k = (r || '').toLowerCase(); return `<span class="role-badge ${k}">${ROLE_LABEL[k] || escapeHtml(r)}</span>`; }

// Які ролі може створювати поточний користувач (відповідає бекенду)
function creatableRoles() {
  return myRole === 'superadmin'
    ? [['admin', 'Адміністратор'], ['master', 'Майстер']]
    : [['master', 'Майстер']];
}

// Правила дій над рядком (дублюють серверні перевірки)
function canDelete(u) {
  const r = (u.role || '').toLowerCase();
  if (r === 'superadmin') return false;        // superadmin не видаляється через API
  if (u.username === ME) return false;          // не можна видалити себе
  if (myRole === 'superadmin') return true;     // superadmin → admin/master
  if (myRole === 'admin') return r === 'master';// admin → лише master
  return false;
}
function canChangeRole(u) {
  const r = (u.role || '').toLowerCase();
  return myRole === 'superadmin' && r !== 'superadmin';
}
// Редагування: ті самі правила керованості, що й видалення (без заборони "себе")
function canEdit(u) {
  const r = (u.role || '').toLowerCase();
  if (r === 'superadmin') return false;
  if (myRole === 'superadmin') return true;
  if (myRole === 'admin') return r === 'master';
  return false;
}

let usersCache = [];

// ===== Load & render =====
async function loadUsers() {
  const tbody = $("#usersTbody");
  tbody.innerHTML = `<tr><td colspan="5" style="opacity:.7">Завантаження…</td></tr>`;
  let out;
  try { out = await apiFetch(`/api/Users`, { headers: authHeaders }); }
  catch { tbody.innerHTML = `<tr><td colspan="5" class="err">Немає з'єднання з API</td></tr>`; return; }
  const { res } = out;
  if (res.status === 401) { showToast('error', "Сесія завершилась"); localStorage.removeItem('token'); localStorage.removeItem('role'); location.href = "../auth/index.html"; return; }
  if (res.status === 403) { showToast('error', "Немає доступу"); location.replace("../dashboard/dashboard.html"); return; }
  if (!res.ok) { tbody.innerHTML = `<tr><td colspan="5" class="err">Помилка API: ${res.status}</td></tr>`; return; }
  const users = await res.json();
  usersCache = Array.isArray(users) ? users : [];
  renderUsers(usersCache);
}
window.loadUsers = loadUsers;

function renderUsers(users) {
  const tbody = $("#usersTbody"); tbody.innerHTML = "";
  if (!users.length) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;opacity:.7">Немає користувачів</td></tr>`; return; }
  for (const u of users) {
    const tr = document.createElement("tr");
    const hasActions = canEdit(u) || canChangeRole(u) || canDelete(u);
    const cell = hasActions
      ? `<div class="row-actions"><button class="menu-btn" data-id="${u.id}" title="Дії">⋯</button></div>`
      : `<span style="opacity:.4">—</span>`;
    tr.innerHTML = `<td>${u.id}</td><td>${escapeHtml(u.username)}${u.username === ME ? ' <span style="opacity:.6">(ви)</span>' : ''}</td><td>${escapeHtml(u.email || "")}</td><td>${roleBadge(u.role)}</td><td style="text-align:right">${cell}</td>`;
    tbody.appendChild(tr);
  }
}

// ===== Row "Дії" portal menu =====
const portal = document.getElementById("rowMenuPortal");
let currentAnchor = null;
function openRowMenu(btn, id) {
  if (currentAnchor === btn && !portal.hidden) { closeRowMenu(); return; }
  currentAnchor = btn;
  const u = usersCache.find(x => String(x.id) === String(id));
  if (!u) return;
  const items = [];
  if (canEdit(u)) items.push(`<button data-act="edit" data-id="${u.id}">Редагувати</button>`);
  if (canDelete(u)) items.push(`<button data-act="del" data-id="${u.id}">Видалити</button>`);
  if (!items.length) return;
  portal.innerHTML = items.join("");
  portal.hidden = false;
  requestAnimationFrame(() => {
    const r = btn.getBoundingClientRect();
    const left = Math.min(window.innerWidth - portal.offsetWidth - 12, r.right - portal.offsetWidth);
    const top = Math.min(window.innerHeight - portal.offsetHeight - 12, r.bottom + 8);
    portal.style.left = `${Math.max(12, left)}px`;
    portal.style.top = `${Math.max(12, top)}px`;
  });
}
function closeRowMenu() { portal.hidden = true; currentAnchor = null; }
document.addEventListener("scroll", () => closeRowMenu(), true);
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeRowMenu(); });

// ===== Create modal =====
const userModal = $("#userModal"), userForm = $("#userForm");
function openUserModal() {
  userForm.reset();
  $("#ufRole").innerHTML = creatableRoles().map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  userModal.hidden = false;
  $("#ufUsername").focus();
}
function closeUserModal() { userModal.hidden = true; }
$("#btnAddUser")?.addEventListener("click", openUserModal);
$("#ufCancel")?.addEventListener("click", closeUserModal);

userForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = $("#ufUsername").value.trim();
  const email = $("#ufEmail").value.trim();
  const password = $("#ufPassword").value;
  const role = $("#ufRole").value;
  if (username.length < 3) { showToast('warning', "Логін має бути від 3 символів."); return; }
  if (!email) { showToast('warning', "Вкажіть email."); return; }
  if (password.length < 6) { showToast('warning', "Пароль має бути від 6 символів."); return; }
  const btn = userForm.querySelector('button[type="submit"]'); btn.disabled = true;
  try {
    const { res } = await apiFetch(`/api/Users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ username, email, password, role })
    });
    if (res.status === 409) { showToast('error', "Такий логін вже існує."); return; }
    if (res.status === 403) { showToast('error', (await res.text().catch(() => "")) || "Недостатньо прав."); return; }
    if (!res.ok) { showToast('error', "Помилка: " + ((await res.text().catch(() => "")) || res.status)); return; }
    showToast('success', "Користувача створено");
    closeUserModal();
    await loadUsers();
  } catch (err) { showToast('error', err.message); }
  finally { btn.disabled = false; }
});

// ===== Delete =====
async function deleteUser(id, username) {
  confirmAction(`Видалити користувача «${username}»?`, async (ok) => {
    if (!ok) return;
    try {
      const { res } = await apiFetch(`/api/Users/${id}`, { method: "DELETE", headers: authHeaders });
      if (res.ok || res.status === 204) { showToast('success', "Видалено"); await loadUsers(); }
      else showToast('error', "Помилка: " + ((await res.text().catch(() => "")) || res.status));
    } catch (e) { showToast('error', e.message); }
  });
}

// ===== Edit modal (uses future PUT /api/Users/{id}) =====
const editModal = $("#editUserModal"), editForm = $("#editUserForm");
function openEditModal(u) {
  $("#euId").value = u.id;
  $("#euUsername").value = u.username || "";
  $("#euEmail").value = u.email || "";
  $("#euPassword").value = "";
  // роль у модалці редагування може міняти лише superadmin (і не для superadmin-цілі)
  const roleWrap = $("#euRoleWrap"), roleSel = $("#euRole");
  if (canChangeRole(u)) {
    roleWrap.style.display = "";
    roleSel.innerHTML = `<option value="admin">Адміністратор</option><option value="master">Майстер</option>`;
    roleSel.value = (u.role || 'master').toLowerCase() === 'admin' ? 'admin' : 'master';
  } else {
    roleWrap.style.display = "none";
    roleSel.innerHTML = "";
  }
  editModal.hidden = false;
  $("#euUsername").focus();
}
function closeEditModal() { editModal.hidden = true; }
$("#euCancel")?.addEventListener("click", closeEditModal);

editForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#euId").value;
  const username = $("#euUsername").value.trim();
  const email = $("#euEmail").value.trim();
  const password = $("#euPassword").value;
  if (username.length < 3) { showToast('warning', "Логін має бути від 3 символів."); return; }
  if (!email) { showToast('warning', "Вкажіть email."); return; }
  if (password && password.length < 6) { showToast('warning', "Пароль має бути від 6 символів."); return; }
  const body = { username, email };
  if (password) body.password = password;
  if ($("#euRoleWrap").style.display !== "none" && $("#euRole").value) body.role = $("#euRole").value;
  const btn = editForm.querySelector('button[type="submit"]'); btn.disabled = true;
  try {
    const { res } = await apiFetch(`/api/Users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify(body)
    });
    if (res.status === 404 || res.status === 405) { showToast('error', "Ендпоінт редагування ще не реалізований на бекенді."); return; }
    if (res.status === 409) { showToast('error', "Такий логін вже існує."); return; }
    if (res.status === 403) { showToast('error', (await res.text().catch(() => "")) || "Недостатньо прав."); return; }
    if (!res.ok && res.status !== 204) { showToast('error', "Помилка: " + ((await res.text().catch(() => "")) || res.status)); return; }
    showToast('success', "Користувача оновлено");
    closeEditModal();
    await loadUsers();
  } catch (err) { showToast('error', err.message); }
  finally { btn.disabled = false; }
});

// ===== Click delegation: Дії button + portal items =====
document.addEventListener("click", (e) => {
  const trigger = e.target.closest(".menu-btn");
  if (trigger) { openRowMenu(trigger, trigger.dataset.id); return; }
  const act = e.target.closest("#rowMenuPortal [data-act]");
  if (act) {
    const u = usersCache.find(x => String(x.id) === String(act.dataset.id));
    closeRowMenu();
    if (!u) return;
    if (act.dataset.act === "edit") openEditModal(u);
    else if (act.dataset.act === "del") deleteUser(u.id, u.username);
    return;
  }
  if (!e.target.closest("#rowMenuPortal")) closeRowMenu();
});

loadUsers();
