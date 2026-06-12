/**
 * common.js — глобальні утиліти для проекту "Контакт"

 * Надає:
 *  showToast(type, message, duration?)
 *  confirmAction(message, callback, options?)  — options: true | {danger:true}
 *  debounce(fn, ms)
 *  setButtonLoading(btn, bool)
 *  checkSessionTimeout()
 *  initHotkeys()
 *  checkAutoOpen()   — для ?action=add
 *  getUserRole()     — роль користувача (superadmin/admin/master)
 *  phoneToPretty / phoneToCanonical / isValidUaPhone / attachPhoneInput — телефони (+380)
 *  isValidEmail
 *  makeClientSuggest(input, onPick) — стилізований автодоповнювач клієнта
 */

// ─── 0. Підключаємо компоненти.css якщо не підключено ──────────────────────
(function ensureComponentsCss() {
  if (!document.querySelector('link[href*="components.css"]')) {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = '../../core/components.css';
    document.head.appendChild(link);
  }
})();

// ─── 1. TOAST ───────────────────────────────────────────────────────────────
(function initToastContainer() {
  if (!document.getElementById('toast-container')) {
    const el = document.createElement('div');
    el.id = 'toast-container';
    document.body.appendChild(el);
  }
})();

/**
 * showToast('success'|'error'|'warning'|'info', 'Текст', 4000)
 */
function showToast(type, message, duration = 4000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  const remove = () => {
    toast.classList.add('out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  };

  setTimeout(remove, duration);
  toast.addEventListener('click', remove);
  return toast;
}

// Зберігаємо у window для доступу з інших скриптів
window.showToast = showToast;

// ─── 2. CUSTOM CONFIRM ──────────────────────────────────────────────────────
(function initConfirmDialog() {
  if (document.getElementById('confirm-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'confirm-overlay';
  overlay.setAttribute('hidden', '');
  overlay.innerHTML = `
    <div id="confirm-box" role="dialog" aria-modal="true">
      <p id="confirm-msg">Ви впевнені?</p>
      <div class="confirm-actions">
        <button id="confirm-cancel">Скасувати</button>
        <button id="confirm-ok">Підтвердити</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
})();

/**
 * confirmAction('Видалити запис?', () => doDelete())
 *
 * Єдиний стиль для ВСІХ діалогів підтвердження:
 *  • «Підтвердити» — зелена заповнена кнопка;
 *  • «Скасувати» — лише червона обводка (з неоновою підсвіткою).
 * Третій аргумент лишено для зворотної сумісності, але на вигляд не впливає.
 */
function confirmAction(message, callback, options) {
  const overlay  = document.getElementById('confirm-overlay');
  const msgEl    = document.getElementById('confirm-msg');
  const btnOk    = document.getElementById('confirm-ok');
  const btnCancel= document.getElementById('confirm-cancel');
  if (!overlay) return;

  overlay.classList.remove('danger');   // завжди єдиний стиль

  msgEl.textContent = message;
  overlay.hidden = false;

  const cleanup = () => { overlay.hidden = true; };

  const onOk = () => { cleanup(); callback && callback(true); };
  const onCancel = () => { cleanup(); callback && callback(false); };
  const onOverlay = (e) => { if (e.target === overlay) onCancel(); };

  btnOk.addEventListener('click', onOk, { once: true });
  btnCancel.addEventListener('click', onCancel, { once: true });
  overlay.addEventListener('click', onOverlay, { once: true });
}

window.confirmAction = confirmAction;

// ─── 3. OUTSIDE CLICK — закриття <details> і модалок ───────────────────────
document.addEventListener('click', function(e) {
  // Закриваємо всі відкриті <details> при кліку поза ними
  document.querySelectorAll('details[open]').forEach(det => {
    if (!det.contains(e.target)) det.open = false;
  });
});

// ─── 4. DEBOUNCE ────────────────────────────────────────────────────────────
function debounce(fn, ms = 300) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}
window.debounce = debounce;

// ─── 5. BUTTON LOADING HELPER ───────────────────────────────────────────────
/**
 * setButtonLoading(btn, true)  — блокує кнопку, зберігає текст
 * setButtonLoading(btn, false) — розблокує, повертає текст
 */
function setButtonLoading(btn, isLoading) {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.origText = btn.textContent;
    btn.textContent = '…';
    btn.dataset.loading = 'true';
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.origText || btn.textContent;
    btn.dataset.loading = 'false';
    btn.disabled = false;
  }
}
window.setButtonLoading = setButtonLoading;

// ─── 6. SESSION TIMEOUT CHECK ───────────────────────────────────────────────
/**
 * Декодує JWT, перевіряє exp.
 * Якщо до закінчення < 5 хв — показує toast.
 * Якщо вже закінчився — показує toast і редиректить.
 */
function checkSessionTimeout() {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const [, payload] = token.split('.');
    const { exp } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    if (!exp) return;

    const nowSec = Math.floor(Date.now() / 1000);
    const remaining = exp - nowSec;

    if (remaining <= 0) {
      showToast('error', 'Сесія завершена. Виконується вихід…', 3000);
      setTimeout(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        location.href = '../auth/index.html';
      }, 2000);
      return;
    }

    if (remaining < 300) { // менше 5 хвилин
      showToast('warning', `Сесія завершується через ${Math.ceil(remaining / 60)} хв. Збережіть роботу.`, 6000);
    }
  } catch (e) {
    // ігноруємо помилки парсингу
  }
}

// Перевіряємо при завантаженні та кожні 60 секунд
checkSessionTimeout();
setInterval(checkSessionTimeout, 60_000);

window.checkSessionTimeout = checkSessionTimeout;

// ─── 7. ГАРЯЧІ КЛАВІШІ ──────────────────────────────────────────────────────
function initHotkeys() {
  document.addEventListener('keydown', function(e) {
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    const isEditing = ['input', 'textarea', 'select'].includes(tag);

    // Esc — закрити модалку / меню
    if (e.key === 'Escape') {
      // Модалки (modal-layer)
      document.querySelectorAll('.modal-layer:not([hidden])').forEach(m => {
        m.hidden = true;
      });
      // portal меню
      const portal = document.getElementById('rowMenuPortal');
      if (portal) portal.hidden = true;
      // details
      document.querySelectorAll('details[open]').forEach(d => { d.open = false; });
    }

    // Ctrl+N — натиснути першу "зелену" кнопку (Додати / Створити)
    if (e.ctrlKey && e.key === 'n' && !isEditing) {
      e.preventDefault();
      const primary = document.querySelector(
        '#btnCreate, #btnAddSale, #btnAdd, #btnAddRepair, [id^="btn"]:not(#logout)'
      );
      primary?.click();
    }

    // F5 — оновити список (клік по першій кнопці сортування або reload)
    if (e.key === 'F5' && !e.ctrlKey) {
      e.preventDefault();
      // якщо є функція loadSales/loadRepairs/loadClients — спробуємо
      const loaders = ['loadSales', 'loadRepairs', 'loadClients', 'loadAnalytics', 'loadDashboard'];
      for (const fn of loaders) {
        if (typeof window[fn] === 'function') { window[fn](); break; }
      }
    }

    // ? — відкрити сторінку Допомоги
    if (e.key === '?' && !isEditing && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      if (!/help\.html$/i.test(location.pathname)) location.href = '../help/help.html';
    }
  });
}

initHotkeys();

// ─── 8. AUTO-OPEN MODAL при ?action=add ─────────────────────────────────────
/**
 * Якщо URL містить ?action=add — автоматично відкриває модалку додавання.
 * Виклик: checkAutoOpen() — вже вбудований нижче з затримкою для DOM.
 */
function checkAutoOpen() {
  const params = new URLSearchParams(location.search);
  if (params.get('action') !== 'add') return;

  // Прибираємо параметр з URL без перезавантаження
  const url = new URL(location.href);
  url.searchParams.delete('action');
  history.replaceState(null, '', url.toString());

  // Натискаємо кнопку відкриття форми
  const triggers = [
    '#btnCreate',     // repairs
    '#btnAddSale',    // sales
    '#btnAdd',        // clients
  ];
  for (const sel of triggers) {
    const btn = document.querySelector(sel);
    if (btn) { btn.click(); return; }
  }
}

// Запускаємо після рендеру сторінки
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAutoOpen);
} else {
  setTimeout(checkAutoOpen, 100);
}

window.checkAutoOpen = checkAutoOpen;

// ─── 9. GLOBAL LOGOUT WITH CONFIRM ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function(){
  const logoutBtn = document.getElementById('logout');
  if(logoutBtn){
    // Remove any existing click handlers by cloning
    const newBtn = logoutBtn.cloneNode(true);
    logoutBtn.parentNode.replaceChild(newBtn, logoutBtn);
    newBtn.addEventListener('click', function(e){
      e.preventDefault();
      confirmAction('Ви впевнені, що хочете вийти?', function(ok){
        if(ok){ localStorage.removeItem('token'); localStorage.removeItem('role'); location.href = '../auth/index.html'; }
      });
    });
  }
});

// ─── 10. РОЛІ (superadmin / admin / master) ────────────────────────────────
/**
 * Повертає роль користувача у нижньому регістрі.
 * Спершу зі збереженого localStorage('role') (кладеться при логіні),
 * у запасному варіанті — з JWT (claim role).
 */
function getUserRole() {
  const stored = (localStorage.getItem('role') || '').toLowerCase();
  if (stored) return stored;
  const token = localStorage.getItem('token');
  if (!token) return '';
  try {
    const [, p] = token.split('.');
    const bin = atob(p.replace(/-/g, '+').replace(/_/g, '/'));
    const j = JSON.parse(new TextDecoder('utf-8').decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
    const role = j.role || j.Role
      || j['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] || '';
    return String(role).toLowerCase();
  } catch { return ''; }
}
window.getUserRole = getUserRole;

function _roleLabel(r){
  const m = { superadmin:'СуперАдмін', admin:'Адміністратор', master:'Майстер', user:'Користувач' };
  return m[(r||'').toLowerCase()] || 'Користувач';
}
function _initials(n){
  return (n||'').trim().split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase() || '?';
}

/** Гейтинг UI за роллю: ставить body[data-role], решту робить CSS (components.css). */
function applyRoleGating(){
  const role = getUserRole();
  if (document.body) document.body.dataset.role = role || 'guest';
}

/** master не має доступу до Аналітики/Налаштувань/Користувачів — якщо зайшов напряму, повертаємо на дашборд. */
function guardPageByRole(){
  const role = getUserRole();
  if (role === 'master') {
    const path = (location.pathname || '').toLowerCase();
    if (path.endsWith('analytics.html') || path.endsWith('settings.html') || path.endsWith('users.html')) {
      location.replace('../dashboard/dashboard.html');
    }
  }
}

/**
 * Динамічно додає пункт «Користувачі» у сайдбар.
 * superadmin/admin — звичайне посилання; master — теж бачить (його заблокує applyMasterLocks).
 * На самій users.html лінк уже статичний — тоді ін'єкція не дублює його (перевірка наявності).
 */
function injectUsersLink(){
  const role = getUserRole();
  if (role !== 'superadmin' && role !== 'admin' && role !== 'master') return;
  const menu = document.querySelector('.sidebar .menu');
  if (!menu) return;

  // Якщо пункт вже є в HTML (як на сторінці users.html) — нічого не робимо
  if (document.querySelector('.sidebar a[href$="users.html"]') || menu.querySelector('a.active[data-page="users"]')) return;

  const a = document.createElement('a');
  a.href = '../users/users.html';
  // a.className = 'active'; <--- ПРИБРАЛИ
  a.dataset.page = 'users';
  a.innerHTML = '<img class="ico" src="../../assets/icons/users.png" width="22" height="22" alt=""><span>Користувачі</span>';

  const analytics = menu.querySelector('a[href$="analytics.html"]');
  if (analytics) analytics.insertAdjacentElement('afterend', a);
  else menu.appendChild(a);
}

/**
 * Для ролі master: показати заблоковані пункти (Аналітика/Налаштування/Користувачі)
 * напівпрозорими з замком і заборонити перехід. Викликати ПІСЛЯ injectUsersLink.
 */
function applyMasterLocks(){
  if (getUserRole() !== 'master') return;
  const links = document.querySelectorAll(
    '.sidebar .menu a[href$="analytics.html"], .sidebar .menu a[href$="settings.html"], .sidebar .menu a[href$="users.html"]'
  );
  links.forEach(a => {
    a.classList.add('locked');
    if (!a.querySelector('.lock')) {
      const lock = document.createElement('span');
      lock.className = 'lock';
      lock.textContent = '🔒';
      a.appendChild(lock);
    }
    a.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (window.showToast) showToast('warning', 'Розділ доступний лише адміністратору');
    });
  });
}

// ─── 11. Конфігуратор ПК (зовнішній сайт) + профіль у сайдбарі ─────────────
const CONFIGURATOR_URL = "https://configuratorkontakt-production.up.railway.app/"; 
document.addEventListener('DOMContentLoaded', function(){
  applyRoleGating();
  guardPageByRole();
  injectUsersLink();
  applyMasterLocks();

  const cfg = document.getElementById('btnConfigurator');
  if (cfg) cfg.addEventListener('click', function(e){ e.preventDefault(); window.open(CONFIGURATOR_URL, '_blank'); });

  // Пункт «Допомога» у сайдбарі (на більшості сторінок лінк без href) — централізована навігація
  document.querySelectorAll('.sidebar .menu a').forEach(a => {
    if ((a.textContent || '').trim() === 'Допомога' && !a.classList.contains('active') && !a.getAttribute('href')) {
      a.style.cursor = 'pointer';
      a.addEventListener('click', (e) => { e.preventDefault(); location.href = '../help/help.html'; });
    }
  });

  const token = localStorage.getItem('token');
  if (token){
    try{
      const [,p] = token.split('.');
      const bin = atob(p.replace(/-/g,'+').replace(/_/g,'/'));
      const j = JSON.parse(new TextDecoder('utf-8').decode(Uint8Array.from(bin, c=>c.charCodeAt(0))));
      const name = j.username||j.name||j.unique_name||j.sub||'Користувач';
      const role = getUserRole();
      const nm=document.getElementById('sideProfileName'); if(nm) nm.textContent=name;
      const rl=document.getElementById('sideProfileRole'); if(rl) rl.textContent=_roleLabel(role);
      const av=document.getElementById('sideProfileAvatar'); if(av) av.textContent=_initials(name);
    }catch(e){}
  }
});

// ─── 12. ТЕЛЕФОН (український формат +380) ─────────────────────────────────
/**
 * Робота з українськими номерами.
 *  - Користувач вводить просто цифри (09..., 09501234567, 50..., +380...).
 *  - У полі автоматично форматується у вигляд: +380 (50) 123 45 67
 *  - У БД зберігаємо канонічний вигляд: +380XXXXXXXXX
 *  - Валідний номер = рівно 9 цифр абонента (після коду 380 / провідного 0).
 */
function _phoneSubscriber(value){
  let d = (value || '').replace(/\D/g, '');
  if (d.startsWith('380')) d = d.slice(3);
  else if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 9);
}
function isValidUaPhone(value){ return _phoneSubscriber(value).length === 9; }
function phoneToCanonical(value){ const d = _phoneSubscriber(value); return d.length === 9 ? ('+380' + d) : ''; }
function phoneToPretty(value){
  const d = _phoneSubscriber(value);
  if (d.length !== 9) return value || '';   // не вдалось розпізнати — показуємо як є
  return `+380 (${d.slice(0,2)}) ${d.slice(2,5)} ${d.slice(5,7)} ${d.slice(7,9)}`;
}
/** Жива маска для <input>: форматує під час вводу, ставить каретку в кінець. */
function attachPhoneInput(input){
  if (!input || input.dataset.uaPhone) return;
  input.dataset.uaPhone = '1';
  input.setAttribute('inputmode', 'tel');
  input.setAttribute('maxlength', '19');
  const handler = () => {
    const digits = (input.value || '').replace(/\D/g, '');
    let d = digits;
    if (d.startsWith('380')) d = d.slice(3);
    else if (d.startsWith('0')) d = d.slice(1);
    d = d.slice(0, 9);
    let out = '';
    if (digits.length) {
      out = '+380 (' + d.slice(0, 2);
      if (d.length >= 2) out += ') ';
      if (d.length > 2)  out += d.slice(2, 5);
      if (d.length > 5)  out += ' ' + d.slice(5, 7);
      if (d.length > 7)  out += ' ' + d.slice(7, 9);
    }
    input.value = out;
    try { input.setSelectionRange(out.length, out.length); } catch {}
  };
  input.addEventListener('input', handler);
}
window.isValidUaPhone   = isValidUaPhone;
window.phoneToCanonical = phoneToCanonical;
window.phoneToPretty    = phoneToPretty;
window.attachPhoneInput = attachPhoneInput;

// ─── 13. EMAIL ──────────────────────────────────────────────────────────────
function isValidEmail(value){ return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((value || '').trim()); }
window.isValidEmail = isValidEmail;

// ─── 14. СТИЛІЗОВАНИЙ ПІДБІР КЛІЄНТА (заміна нативного <datalist>) ──────────
/**
 * makeClientSuggest(inputEl, onPick) → { render(list), hide() }
 *  - render(list): list = [{id, fullName, phone}] показує спадне меню під полем.
 *  - onPick(client): викликається при кліку на елемент.
 * Меню — position:fixed, додане в body, тож коректно лягає поверх модалок.
 */
function makeClientSuggest(input, onPick){
  if (!input) return { render(){}, hide(){} };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const box = document.createElement('div');
  box.className = 'client-suggest';
  box.hidden = true;
  document.body.appendChild(box);
  let items = [];

  function position(){
    const r = input.getBoundingClientRect();
    box.style.left  = r.left + 'px';
    box.style.top   = (r.bottom + 4) + 'px';
    box.style.width = r.width + 'px';
  }
  function hide(){ box.hidden = true; }
  function render(list){
    items = list || [];
    if (!items.length){ hide(); return; }
    box.innerHTML = items.map((c, i) =>
      `<button type="button" class="cs-item" data-i="${i}">
         <span class="cs-name">${esc(c.fullName)}</span>
         <span class="cs-phone">${esc(phoneToPretty(c.phone))}</span>
       </button>`).join('');
    position();
    box.hidden = false;
  }

  // mousedown (а не click) — щоб спрацювати до blur поля
  box.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('.cs-item');
    if (!btn) return;
    e.preventDefault();
    const c = items[+btn.dataset.i];
    hide();
    if (c && onPick) onPick(c);
  });
  input.addEventListener('blur', () => setTimeout(hide, 150));
  window.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });

  return { render, hide, position };
}
window.makeClientSuggest = makeClientSuggest;
