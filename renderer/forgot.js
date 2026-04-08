const API  = "http://localhost:5101";
const form = document.getElementById("fpForm");
const msg  = document.getElementById("msg");
const btn  = form.querySelector('button[type="submit"]');
const show = (t, type="error") => { msg.textContent=t; msg.className=`hint ${type}`; msg.hidden=false; };

form.addEventListener("submit", async (e)=>{
  e.preventDefault(); msg.hidden = true;
  const u = form.username.value.trim();
  const key = form.recoveryKey.value.trim();
  const p = form.password.value;
  if(!(u.length>=3)) return show("Логін має бути від 3 символів.");
  if(!key) return show("Введіть резервний ключ.");
  if(!(p.length>=6)) return show("Пароль має бути від 6 символів.");

  try{
    btn.disabled = true;
    const res = await fetch(`${API}/api/Users/reset-password`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ username: u, recoveryKey: key, newPassword: p })
    });
    const text = await res.text();
    if(!res.ok){
      if(res.status===404) return show("Користувача не знайдено.");
      if(res.status===403) return show("Невірний резервний ключ.");
      return show(text || "Не вдалося змінити пароль.");
    }
    show("Пароль оновлено. Увійдіть з новим паролем.", "ok");
    setTimeout(()=> location.href = "index.html", 2000);
  }catch{ show("Немає з'єднання з сервером."); }
  finally{ btn.disabled = false; }
});
