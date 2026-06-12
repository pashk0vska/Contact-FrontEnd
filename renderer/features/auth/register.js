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
const form = document.getElementById("regForm");
const msg  = document.getElementById("msg");
const btn  = form.querySelector('button[type="submit"]');

function showMsg(text, type="error"){ msg.textContent = text; msg.className = `hint ${type}`; msg.hidden = false; }
const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

form.addEventListener("submit", async (e) => {
  e.preventDefault(); msg.hidden = true;
  const u = form.username.value.trim(), em = form.email.value.trim(), p = form.password.value;
  form.username.classList.toggle("invalid", !(u.length >= 3));
  form.email.classList.toggle("invalid", !emailRe.test(em));
  form.password.classList.toggle("invalid", !(p.length >= 6));
  if(!(u.length>=3)){ showMsg("Логін має бути від 3 символів."); return; }
  if(!emailRe.test(em)){ showMsg("Введіть коректний email."); return; }
  if(!(p.length>=6)){ showMsg("Пароль має бути від 6 символів."); return; }

  try{
    btn.disabled = true;
    const { res } = await apiFetch(`/api/Users/register`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ username: u, email: em, password: p })
    });
    const data = await res.json().catch(()=>({}));
    if(!res.ok){
      if(res.status===409) showMsg("Такий логін вже існує.");
      else showMsg(data?.message || "Помилка реєстрації.");
      return;
    }
    // Show recovery keys if returned
    const keys = data.recoveryKeys || [];
    if(keys.length > 0){
      const keysDiv = document.getElementById("recoveryKeys");
      const keysList = document.getElementById("keysList");
      if(keysDiv && keysList){
        keysList.innerHTML = keys.map((k,i) => `<div class="key-item"><strong>${i+1}.</strong> <code>${k}</code></div>`).join("");
        keysDiv.hidden = false;
        form.style.display = "none";
        msg.hidden = true;
      } else {
        showMsg("Акаунт створено. Ваші ключі відновлення: " + keys.join(", "), "ok");
      }
    } else {
      showMsg("Акаунт створено. Увійдіть.", "ok");
      setTimeout(()=> location.href = "index.html", 2000);
    }
  }catch{ showMsg("Немає з'єднання з сервером."); }
  finally{ btn.disabled = false; }
});
