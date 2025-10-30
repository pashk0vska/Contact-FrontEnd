const API = "http://localhost:5101";
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

    const res = await fetch(`${API}/api/Auth/login`, {
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
    showMsg("Успішний вхід.", "ok");
    setTimeout(()=> location.href = "dashboard.html", 2000);
  }catch{
    showMsg("Немає з'єднання з сервером.");
  }finally{
    btn.disabled = false;
  }
});
