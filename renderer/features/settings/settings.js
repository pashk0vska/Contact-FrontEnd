const t = new Date().toLocaleDateString('uk-UA',{day:'2-digit',month:'long',year:'numeric'});
const elToday = document.getElementById('today'); if (elToday) elToday.textContent = `Сьогодні: ${t}`;
const logoutEl = document.getElementById('logout');
if (logoutEl) logoutEl.addEventListener('click',()=>{localStorage.removeItem('token');localStorage.removeItem('role');location.href='../auth/index.html';});

const API_CANDIDATES = ["http://localhost:5101","https://localhost:7286"];
let API = localStorage.getItem("apiBase") || API_CANDIDATES[0];
const token = localStorage.getItem("token"); if(!token) location.href="../auth/index.html";

async function apiFetch(path,init={}){
  const tryOnce=async(base)=>{const url=path.startsWith("http")?path:`${base}${path}`;return{res:await fetch(url,init),base};};
  try{return await tryOnce(API);}catch{for(const c of API_CANDIDATES){if(c===API)continue;try{const out=await tryOnce(c);localStorage.setItem("apiBase",c);API=c;return out;}catch{}}throw new Error("API not reachable");}
}

// Backup
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

// Restore
document.getElementById("fileRestore")?.addEventListener("change", async(e)=>{
  const file=e.target.files[0]; if(!file)return;
  confirmAction("Відновити БД з файлу? Поточні дані будуть замінені!",async(ok)=>{
    if(!ok){e.target.value="";return;}
    document.getElementById("backupStatus").textContent="Відновлення…";
    try{
      const text=await file.text();
      const{res}=await apiFetch(`${API}/api/Backup/import`,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${token}`},body:text});
      if(res.ok){showToast('success','БД відновлено');document.getElementById("backupStatus").textContent="Відновлення завершено!";}
      else{const t2=await res.text().catch(()=>"");showToast('error','Помилка: '+(t2||res.status));document.getElementById("backupStatus").textContent="";}
    }catch(err){showToast('error',err.message);document.getElementById("backupStatus").textContent="";}
    e.target.value="";
  });
});
