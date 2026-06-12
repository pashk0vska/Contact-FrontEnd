const t = new Date().toLocaleDateString('uk-UA',{day:'2-digit',month:'long',year:'numeric'});
const elToday = document.getElementById('today'); if (elToday) elToday.textContent = `Сьогодні: ${t}`;
const logoutEl = document.getElementById('logout');
if (logoutEl) logoutEl.addEventListener('click',()=>{localStorage.removeItem('token');localStorage.removeItem('role');location.href="../auth/index.html";});

const API_CANDIDATES = [window.API_BASE];
let API = window.API_BASE;
const token = localStorage.getItem("token"); if(!token) location.href="../auth/index.html";

async function apiFetch(path,init={}){
  const tryOnce=async(base)=>{const url=path.startsWith("http")?path:`${base}${path}`;return{res:await fetch(url,init),base};};
  try{return await tryOnce(API);}catch{for(const c of API_CANDIDATES){if(c===API)continue;try{const out=await tryOnce(c);localStorage.setItem("apiBase",c);API=c;return out;}catch{}}throw new Error("API not reachable");}
}

// Профіль оператора
const ROLE_LABEL = { superadmin:'СуперАдмін', admin:'Адміністратор', master:'Майстер' };
function _tokenJson(tok){try{const[,p]=tok.split('.');const bin=atob(p.replace(/-/g,'+').replace(/_/g,'/'));return JSON.parse(new TextDecoder('utf-8').decode(Uint8Array.from(bin,c=>c.charCodeAt(0))));}catch{return{};}}
function _initials(n){return (n||'').trim().split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase()||'?';}

async function loadProfile(){
  const j=_tokenJson(token);
  const name=j.username||j.name||j.unique_name||j.sub||'Користувач';
  const role=(j.role||j.Role||localStorage.getItem('role')||'').toLowerCase();
  const label=ROLE_LABEL[role]||'Користувач';
  const nm=document.getElementById('profName'); if(nm) nm.textContent=name;
  const av=document.getElementById('profAvatar'); if(av) av.textContent=_initials(name);
  const sub=document.getElementById('profSub'); if(sub) sub.textContent=label;
  // збагачуємо email (доступно admin/superadmin — а на цій сторінці інших і немає)
  try{
    const{res}=await apiFetch(`/api/Users`,{headers:{"Authorization":`Bearer ${token}`}});
    if(res.ok){const users=await res.json();const me=(users||[]).find(u=>u.username===name);if(me&&me.email&&sub) sub.textContent=`${label} · ${me.email}`;}
  }catch{}
}

document.getElementById('btnChangePass')?.addEventListener('click', async()=>{
  const cur=document.getElementById('cpCurrent').value;
  const nw=document.getElementById('cpNew').value;
  if(!cur||!nw){showToast('warning','Заповни поточний і новий пароль');return;}
  if(nw.length<6){showToast('warning','Новий пароль — від 6 символів');return;}
  const btn=document.getElementById('btnChangePass'); btn.disabled=true;
  try{
    const{res}=await apiFetch(`/api/Auth/change-password`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({currentPassword:cur,newPassword:nw})});
    if(res.ok){showToast('success','Пароль оновлено');document.getElementById('cpCurrent').value='';document.getElementById('cpNew').value='';}
    else showToast('error',(await res.text().catch(()=>''))||('Помилка: '+res.status));
  }catch(e){showToast('error',e.message);}
  finally{btn.disabled=false;}
});

// Стан бази даних
async function loadDbStatus(){
  const txt=document.getElementById('dbStatus');
  const info=document.getElementById('dbInfo');
  if(!txt) return;
  try{
    const{res}=await apiFetch(`/api/System/db-status`,{headers:{"Authorization":`Bearer ${token}`}});
    if(!res.ok){txt.innerHTML='<span class="db-dot"></span>Помилка: '+res.status;return;}
    const d=await res.json();
    if(d.connected){
      txt.innerHTML='<span class="db-dot on"></span>Підключено до <b style="color:#e6e6e6;margin-left:4px">'+(d.dbName||'—')+'</b>';
      if(info) info.innerHTML=`${d.version||'—'} · ${d.server||'—'}<br>Таблиць: ${d.tables??'—'} · Записів: ${Number(d.records||0).toLocaleString('uk-UA')}`;
    }else{
      txt.innerHTML='<span class="db-dot"></span>Немає підключення';
      if(info) info.textContent=d.error||'';
    }
  }catch(e){ txt.innerHTML='<span class="db-dot"></span>Немає зʼєднання з API'; }
}

// Бекап
document.getElementById("btnBackup")?.addEventListener("click", async()=>{
  document.getElementById("backupStatus").textContent="Створення бекапу…";
  try{
    const{res}=await apiFetch(`${API}/api/Backup/export`,{headers:{"Authorization":`Bearer ${token}`}});
    if(!res.ok){showToast('error','Помилка бекапу: '+res.status);document.getElementById("backupStatus").textContent="";return;}
    const blob=await res.blob();
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`kontakt_backup_${new Date().toISOString().slice(0,10)}.json`;a.click();
    showToast('success','Бекап завантажено');document.getElementById("backupStatus").textContent="Бекап успішно створено!";
  }catch(e){showToast('error',e.message);document.getElementById("backupStatus").textContent="";}
});

// Відновлення
document.getElementById("fileRestore")?.addEventListener("change", async(e)=>{
  const file=e.target.files[0]; if(!file)return;
  confirmAction("Відновити БД з файлу? Поточні дані будуть замінені!",async(ok)=>{
    if(!ok){e.target.value="";return;}
    document.getElementById("backupStatus").textContent="Відновлення…";
    try{
      const text=await file.text();
      const{res}=await apiFetch(`${API}/api/Backup/import`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:text});
      if(res.ok){showToast('success','БД відновлено');document.getElementById("backupStatus").textContent="Відновлення завершено!";loadDbStatus();}
      else{const t2=await res.text().catch(()=>"");showToast('error','Помилка: '+(t2||res.status));document.getElementById("backupStatus").textContent="";}
    }catch(err){showToast('error',err.message);document.getElementById("backupStatus").textContent="";}
    e.target.value="";
  });
});

loadProfile();
loadDbStatus();
