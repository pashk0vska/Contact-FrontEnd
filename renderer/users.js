// ===== Appbar / logout =====
const t = new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
const elToday = document.getElementById('today'); if (elToday) elToday.textContent = `Сьогодні: ${t}`;
const logoutEl = document.getElementById('logout');
if (logoutEl) logoutEl.addEventListener('click', () => { localStorage.removeItem('token'); localStorage.removeItem('role'); location.href = 'index.html'; });

// ===== API =====
const API_CANDIDATES = ["http://localhost:5101", "https://localhost:7286"];
let API = localStorage.getItem("apiBase") || API_CANDIDATES[0];
const token = localStorage.getItem("token");
if (!token) location.href = "index.html";

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
  location.replace('dashboard.html');
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

const ROLE_LABEL = { superadmin: 'Власник', admin: 'Адміністратор', master: 'Майстер' };
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

// ===== Hint =====
const hint = $("#roleHint");
if (hint) {
  hint.textContent = myRole === 'superadmin'
    ? 'Ви — власник: можете створювати адміністраторів і майстрів, змінювати ролі та видаляти користувачів.'
    : 'Ви — адміністратор: можете створювати та видаляти лише майстрів.';
}

// ===== Load & render =====
async function loadUsers() {
  const tbody = $("#usersTbody");
  tbody.innerHTML = `<tr><td colspan="5" style="opacity:.7">Завантаження…</td></tr>`;
  let out;
  try { out = await apiFetch(`/api/Users`, { headers: authHeaders }); }
  catch { tbody.innerHTML = `<tr><td colspan="5" class="err">Немає з'єднання з API</td></tr>`; return; }
  const { res } = out;
  if (res.status === 401) { showToast('error', "Сесія завершилась"); localStorage.removeItem('token'); localStorage.removeItem('role'); location.href = "index.html"; return; }
  if (res.status === 403) { showToast('error', "Немає доступу"); location.replace('dashboard.html'); return; }
  if (!res.ok) { tbody.innerHTML = `<tr><td colspan="5" class="err">Помилка API: ${res.status}</td></tr>`; return; }
  const users = await res.json();
  renderUsers(Array.isArray(users) ? users : []);
}
window.loadUsers = loadUsers;

function renderUsers(users) {
  const tbody = $("#usersTbody"); tbody.innerHTML = "";
  if (!users.length) { tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;opacity:.7">Немає користувачів</td></tr>`; return; }
  for (const u of users) {
    const tr = document.createElement("tr");
    const actions = [];
    if (canChangeRole(u)) actions.push(`<button class="btn-mini" data-act="role" data-id="${u.id}" data-username="${escapeHtml(u.username)}" data-role="${escapeHtml(u.role)}">Роль</button>`);
    if (canDelete(u)) actions.push(`<button class="btn-mini danger" data-act="del" data-id="${u.id}" data-username="${escapeHtml(u.username)}">Видалити</button>`);
    const cell = actions.length ? `<div class="row-actions">${actions.join("")}</div>` : `<span style="opacity:.4">—</span>`;
    tr.innerHTML = `<td>${u.id}</td><td>${escapeHtml(u.username)}${u.username === ME ? ' <span style="opacity:.6">(ви)</span>' : ''}</td><td>${escapeHtml(u.email || "")}</td><td>${roleBadge(u.role)}</td><td style="text-align:right">${cell}</td>`;
    tbody.appendChild(tr);
  }
}

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

// ===== Change role modal (superadmin only) =====
const roleModal = $("#roleModal"), roleForm = $("#roleForm");
function openRoleModal(id, username, currentRole) {
  $("#rfUserId").value = id;
  $("#rfUserLabel").textContent = `Користувач: ${username}`;
  $("#rfRole").value = (currentRole || 'master').toLowerCase() === 'admin' ? 'admin' : 'master';
  roleModal.hidden = false;
}
function closeRoleModal() { roleModal.hidden = true; }
$("#rfCancel")?.addEventListener("click", closeRoleModal);

roleForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("#rfUserId").value;
  const role = $("#rfRole").value;
  const btn = roleForm.querySelector('button[type="submit"]'); btn.disabled = true;
  try {
    const { res } = await apiFetch(`/api/Users/${id}/role`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders },
      body: JSON.stringify({ role })
    });
    if (!res.ok) { showToast('error', "Помилка: " + ((await res.text().catch(() => "")) || res.status)); return; }
    showToast('success', "Роль оновлено");
    closeRoleModal();
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

// ===== Row action delegation =====
$("#usersTbody")?.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]"); if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.act === "del") deleteUser(id, btn.dataset.username);
  else if (btn.dataset.act === "role") openRoleModal(id, btn.dataset.username, btn.dataset.role);
});

loadUsers();
