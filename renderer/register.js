const API = "http://localhost:5101";
const form = document.getElementById("regForm");
const msg  = document.getElementById("msg");
const btn  = form.querySelector('button[type="submit"]');

function showMsg(text, type="error"){
  msg.textContent = text; msg.className = `hint ${type}`; msg.hidden = false;
}
const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

form.addEventListener("submit", async (e) => {
  e.preventDefault(); msg.hidden = true;

  const u = form.username.value.trim();
  const em = form.email.value.trim();
  const p  = form.password.value;

  // локальна валідація
  let ok = true;
  form.username.classList.toggle("invalid", !(u.length >= 3));
  form.email.classList.toggle("invalid", !emailRe.test(em));
  form.password.classList.toggle("invalid", !(p.length >= 6));
  if(!(u.length>=3)){ showMsg("Логін має бути від 3 символів."); ok=false; }
  else if(!emailRe.test(em)){ showMsg("Введіть коректний email."); ok=false; }
  else if(!(p.length>=6)){ showMsg("Пароль має бути від 6 символів."); ok=false; }

  if(!ok) return;

  try{
    btn.disabled = true;

    const res = await fetch(`${API}/api/Users`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ username: u, email: em, passwordHash: p, role: "user" })
    });
    const text = await res.text();

    if(!res.ok){
      if(res.status === 409 || (text && text.toLowerCase().includes("існує"))){
        showMsg("Такий логін вже існує.");
      }else{
        showMsg(text || "Помилка реєстрації.");
      }
      return;
    }

    showMsg("Акаунт створено. Увійдіть.", "ok");
    setTimeout(()=> location.href = "index.html", 2000);
  }catch{
    showMsg("Немає з'єднання з сервером.");
  }finally{
    btn.disabled = false;
  }
});

