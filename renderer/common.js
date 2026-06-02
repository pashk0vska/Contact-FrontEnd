/**
 * common.js — глобальні утиліти для проекту "Контакт"

 * Надає:
 *  showToast(type, message, duration?)
 *  confirmAction(message, callback)
 *  debounce(fn, ms)
 *  setButtonLoading(btn, bool)
 *  checkSessionTimeout()
 *  initHotkeys()
 *  checkAutoOpen()   — для ?action=add
 */

// ─── 0. Підключаємо компоненти.css якщо не підключено ──────────────────────
(function ensureComponentsCss() {
  if (!document.querySelector('link[href*="components.css"]')) {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = './components.css';
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
 * Замінює нативний confirm().
 */
function confirmAction(message, callback) {
  const overlay  = document.getElementById('confirm-overlay');
  const msgEl    = document.getElementById('confirm-msg');
  const btnOk    = document.getElementById('confirm-ok');
  const btnCancel= document.getElementById('confirm-cancel');
  if (!overlay) return;

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
        location.href = './index.html';
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
        if(ok){ localStorage.removeItem('token'); location.href = 'index.html'; }
      });
    });
  }
});


/* ===== Конфігуратор ПК (зовнішній сайт) + профіль у сайдбарі ===== */
const CONFIGURATOR_URL = "https://configurator.example.com"; // TODO: замінити на реальний URL конфігуратора
function _roleLabel(r){const m={superadmin:'Власник',admin:'Адміністратор',master:'Майстер',user:'Користувач'};return m[(r||'').toLowerCase()]||'Користувач';}
function _initials(n){return (n||'').trim().split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase()||'?';}
document.addEventListener('DOMContentLoaded', function(){
  const cfg = document.getElementById('btnConfigurator');
  if (cfg) cfg.addEventListener('click', function(e){ e.preventDefault(); window.open(CONFIGURATOR_URL, '_blank'); });
  const token = localStorage.getItem('token');
  if (token){
    try{
      const [,p] = token.split('.');
      const bin = atob(p.replace(/-/g,'+').replace(/_/g,'/'));
      const j = JSON.parse(new TextDecoder('utf-8').decode(Uint8Array.from(bin, c=>c.charCodeAt(0))));
      const name = j.username||j.name||j.unique_name||j.sub||'Користувач';
      const role = j.role||j.Role||'';
      const nm=document.getElementById('sideProfileName'); if(nm) nm.textContent=name;
      const rl=document.getElementById('sideProfileRole'); if(rl) rl.textContent=_roleLabel(role);
      const av=document.getElementById('sideProfileAvatar'); if(av) av.textContent=_initials(name);
    }catch(e){}
  }
});
