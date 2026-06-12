const API_CANDIDATES = [window.API_BASE];
let API = window.API_BASE;
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
const form = document.getElementById("loginForm");
const msg  = document.getElementById("msg");
const btn  = form.querySelector('button[type="submit"]');

function showMsg(text, type="error"){
  msg.textContent = text; msg.className = `hint ${type}`; msg.hidden = false;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.hidden = true;

  // Перевірки
  const u = form.username.value.trim();
  const p = form.password.value;
  form.username.classList.toggle("invalid", !u);
  form.password.classList.toggle("invalid", !p);
  if (!u || !p){ showMsg("Заповніть логін і пароль."); return; }

  try{
    btn.disabled = true;

    const { res } = await apiFetch(`/api/Auth/login`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ username: u, password: p })
    });

    const data = await res.json().catch(()=> ({}));

    if(!res.ok){
      if(res.status === 401 || res.status === 400){
        showMsg("Невірний логін або пароль.");
        form.password.focus(); form.password.select();
      }else{
        showMsg(data?.title || "Помилка сервера. Спробуйте пізніше.");
      }
      return;
    }

    const token = data.accessToken || data.token || data.jwt;
    if(!token){ showMsg("Сервер не повернув токен."); return; }

    localStorage.setItem("token", token);
    // зберігаємо роль із відповіді логіну для гейтингу UI (superadmin/admin/master)
    if (data.role) localStorage.setItem("role", String(data.role).toLowerCase());
    else localStorage.removeItem("role");

    showMsg("Успішний вхід.", "ok");
    setTimeout(()=> location.href = "../dashboard/dashboard.html", 800);
  }catch{
    showMsg("Немає з'єднання з сервером.");
  }finally{
    btn.disabled = false;
  }
});
