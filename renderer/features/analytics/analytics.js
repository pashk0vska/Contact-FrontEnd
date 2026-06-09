const todayText = new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
const elToday = document.getElementById('today'); if (elToday) elToday.textContent = `Сьогодні: ${todayText}`;
const token = localStorage.getItem('token'); if (!token) location.href = "../auth/index.html";
const logoutEl = document.getElementById('logout'); if (logoutEl) logoutEl.addEventListener('click', () => { localStorage.removeItem('token'); localStorage.removeItem('role'); location.href = "../auth/index.html"; });

const API_CANDIDATES = ["http://localhost:5101", "https://localhost:7286"];
let API = localStorage.getItem("apiBase") || API_CANDIDATES[0];
async function apiFetch(path, init = {}) {
  const tryOnce = async(base)=>{const url=path.startsWith("http")?path:`${base}${path}`;return{res:await fetch(url,init),base};};
  try{return await tryOnce(API);}catch{for(const c of API_CANDIDATES){if(c===API)continue;try{const out=await tryOnce(c);localStorage.setItem("apiBase",c);API=c;return out;}catch{}}throw new Error("API not reachable");}
}

const $=(s,r=document)=>r.querySelector(s);
const fmtMoney=v=>`₴ ${Number(v||0).toLocaleString('uk-UA',{maximumFractionDigits:2})}`;
function setText(id,text){const el=document.getElementById(id);if(el)el.textContent=text;}
function isoDate(d){return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}

// ===== Значення полів дати (джерело істини — dataset.iso) =====
function setPicker(input, iso){
  if(!input) return;
  input.dataset.iso = iso || '';
  if(iso){ const [y,m,d]=iso.split('-'); input.value = `${d}.${m}.${y}`; }
  else input.value = '';
}
function getPickerIso(input){ return input?.dataset.iso || ''; }

// ===== Кастомний календар (під стилістику програми) =====
const DP_WD=['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
const DP_MON=['Січень','Лютий','Березень','Квітень','Травень','Червень','Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
function attachDatePicker(input, onChange){
  if(!input || input._dp) return; input._dp = true;
  input.readOnly = true;
  const pop = document.createElement('div'); pop.className='dp-pop'; pop.hidden=true; document.body.appendChild(pop);
  let view = new Date();
  const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const parse = s => { if(!s) return null; const [y,m,d]=s.split('-').map(Number); return y?new Date(y,m-1,d):null; };
  function position(){ const r=input.getBoundingClientRect(); pop.style.left=Math.max(8,Math.min(r.left,window.innerWidth-272))+'px'; pop.style.top=(r.bottom+6)+'px'; }
  function render(){
    const cur=parse(input.dataset.iso);
    const y=view.getFullYear(), m=view.getMonth();
    const startDow=(new Date(y,m,1).getDay()+6)%7;
    const days=new Date(y,m+1,0).getDate();
    const todayIso=iso(new Date());
    let cells='';
    for(let i=0;i<startDow;i++) cells+='<span class="dp-cell empty"></span>';
    for(let d=1;d<=days;d++){
      const dIso=iso(new Date(y,m,d));
      const sel=cur&&iso(cur)===dIso?' sel':'';
      const tod=dIso===todayIso?' today':'';
      cells+=`<button type="button" class="dp-cell${sel}${tod}" data-d="${d}">${d}</button>`;
    }
    pop.innerHTML=`<div class="dp-head"><button type="button" class="dp-nav" data-nav="-1">‹</button><span class="dp-title">${DP_MON[m]} ${y}</span><button type="button" class="dp-nav" data-nav="1">›</button></div>`
      +`<div class="dp-wd">${DP_WD.map(w=>`<span>${w}</span>`).join('')}</div>`
      +`<div class="dp-grid">${cells}</div>`;
  }
  function open(){ const cur=parse(input.dataset.iso); view=cur?new Date(cur.getFullYear(),cur.getMonth(),1):new Date(); render(); position(); pop.hidden=false; }
  function close(){ pop.hidden=true; }
  input.addEventListener('click',()=>{ pop.hidden?open():close(); });
  pop.addEventListener('click',(e)=>{
    // Клік усередині календаря не повинен «спливати» до глобального
    // обробника закриття: інакше після перемальовування (‹ ›) ціль кліку
    // вже видалена з DOM, pop.contains(target) === false і календар закривається.
    e.stopPropagation();
    const nav=e.target.closest('[data-nav]');
    if(nav){ view.setMonth(view.getMonth()+(+nav.dataset.nav)); render(); return; }
    const cell=e.target.closest('.dp-cell[data-d]');
    if(cell){ setPicker(input, iso(new Date(view.getFullYear(),view.getMonth(),+cell.dataset.d))); close(); if(onChange) onChange(); }
  });
  document.addEventListener('click',(e)=>{ if(!pop.hidden && !pop.contains(e.target) && e.target!==input) close(); });
  window.addEventListener('scroll',()=>close(),true);
  document.addEventListener('keydown',(e)=>{ if(e.key==='Escape') close(); });
}

function setDefaultRange(){
  const to=new Date(),from=new Date();from.setDate(to.getDate()-29);
  const f=document.getElementById('fromDate'),t2=document.getElementById('toDate');
  if(f&&!f.dataset.iso)setPicker(f,isoDate(from));
  if(t2&&!t2.dataset.iso)setPicker(t2,isoDate(to));
}
function getMode(){const sel=document.getElementById('typeSelect');const v=(sel?.value||'').toLowerCase();if(v.includes('лише продаж'))return'sales';if(v.includes('лише ремонт'))return'repairs';return'all';}

let lastData = null;

// ===== Показ/приховування KPI та панелей за типом даних =====
function applyModeVisibility(mode){
  document.querySelectorAll('[data-modes]').forEach(el=>{
    const modes=(el.dataset.modes||'').split(/\s+/);
    el.hidden = !modes.includes(mode);
  });
}

function renderTopTable(items){
  const tbody=document.getElementById('topTbody');if(!tbody)return;tbody.innerHTML='';
  if(!items||!items.length){tbody.innerHTML=`<tr><td colspan="4" style="text-align:center;opacity:.7">Немає даних за період</td></tr>`;return;}
  for(const it of items){const tr=document.createElement('tr');tr.innerHTML=`<td>${it.product||''}</td><td>${it.category||''}</td><td style="text-align:center">${Number(it.qty||0).toLocaleString('uk-UA')}</td><td style="text-align:right">${fmtMoney(it.sum)}</td>`;tbody.appendChild(tr);}
}

// ===== Таблиця деталізації ремонтів за пристроями (режим «Лише ремонти») =====
function renderRepDeviceTable(items){
  const tbody=document.getElementById('repDeviceTbody');if(!tbody)return;tbody.innerHTML='';
  if(!items||!items.length){tbody.innerHTML=`<tr><td colspan="4" style="text-align:center;opacity:.7">Немає ремонтів за період</td></tr>`;return;}
  for(const it of items){
    const count=Number(it.count||0);
    const sum=Number(it.sum||0);
    const avg=count>0?sum/count:0;
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${it.device||'—'}</td><td style="text-align:center">${count.toLocaleString('uk-UA')}</td><td style="text-align:right">${fmtMoney(sum)}</td><td style="text-align:right">${fmtMoney(avg)}</td>`;
    tbody.appendChild(tr);
  }
}

function renderKpi(kpi){setText('kpiIncome',fmtMoney(kpi?.income));setText('kpiSalesCount',String(kpi?.salesCount??0));setText('kpiRepairsCount',String(kpi?.repairsCount??0));setText('kpiAvgCheck',fmtMoney(kpi?.avgCheck));setText('kpiProfit',fmtMoney(kpi?.profitEstimate));setText('kpiNewClients',String(kpi?.newClients??0));}

// ===== Графіки (стиль дашборду) =====
let catChart=null, svcChart=null, salesChart=null, profitChart=null, repStatusChart=null, repDeviceChart=null;
const CAT_COLORS={'Ремонти':'#30D73C','Товари':'#1f8ee2','Збірки':'#9b6cf0','Послуги':'#e2b81f'};
const RSTATUS_UA={new:"Новий",progress:"В процесі",done:"Готово",issued:"Видано",canceled:"Скасовано"};
const RSTATUS_COLOR={new:"#1f8ee2",progress:"#e2b81f",done:"#1fe26a",issued:"#58d27a",canceled:"#e2706a"};
const TIP={backgroundColor:'#0b1116',borderColor:'#243039',borderWidth:1,padding:10,titleColor:'#cdd4da',bodyColor:'#9adf9f',displayColors:false};

function renderCharts(data){
  if(typeof Chart==='undefined')return;
  Chart.defaults.font.family="Inter,system-ui,Segoe UI,Roboto,sans-serif";
  Chart.defaults.color="#7d8b96";
  const top=(data.topProducts||[]);

  // Дохід за категоріями (усі режими)
  const cats=(data.byCategory||[]);
  const cc=document.getElementById('catChartCanvas');
  if(cc){
    if(catChart)catChart.destroy();
    catChart=new Chart(cc,{type:'bar',
      data:{labels:cats.map(x=>x.name),datasets:[{label:'Дохід',data:cats.map(x=>x.value),backgroundColor:cats.map(x=>CAT_COLORS[x.name]||'#30D73C'),borderRadius:6,borderSkipped:false,maxBarThickness:64}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{...TIP,callbacks:{label:c=>' ₴ '+Number(c.parsed.y||0).toLocaleString('uk-UA')}}},
        scales:{x:{grid:{display:false},border:{display:false},ticks:{font:{size:12}}},y:{beginAtZero:true,border:{display:false},grid:{color:'rgba(255,255,255,0.06)'},ticks:{maxTicksLimit:5,callback:v=>v>=1000?(v/1000)+'k':v}}}}
    });
  }

  // ===== РЕМОНТИ: за статусами (doughnut) =====
  const rbs=(data.repairsByStatus||[]).filter(x=>(x.count||0)>0);
  const rsEl=document.getElementById('repStatusChartCanvas');
  if(rsEl){
    if(repStatusChart)repStatusChart.destroy();
    if(rbs.length){
      const labels=rbs.map(x=>RSTATUS_UA[(x.status||'').toLowerCase()]||x.status||'—');
      const dataArr=rbs.map(x=>x.count||0);
      const colors=rbs.map(x=>RSTATUS_COLOR[(x.status||'').toLowerCase()]||'#5b6b76');
      repStatusChart=new Chart(rsEl,{type:'doughnut',
        data:{labels,datasets:[{data:dataArr,backgroundColor:colors,borderColor:'#0f161c',borderWidth:3,hoverOffset:8,spacing:2}]},
        options:{responsive:true,maintainAspectRatio:false,cutout:'66%',layout:{padding:8},
          plugins:{legend:{position:'bottom',labels:{color:'#cdd4da',usePointStyle:true,pointStyle:'circle',padding:16,boxWidth:8,font:{size:12}}},
            tooltip:{...TIP,bodyColor:'#e6e6e6',callbacks:{label:c=>' '+c.label+': '+c.parsed}}}}
      });
    }
  }

  // ===== РЕМОНТИ: топ типів пристроїв за доходом (bar) =====
  const rbd=(data.repairsByDevice||[]);
  const rdEl=document.getElementById('repDeviceChartCanvas');
  if(rdEl){
    if(repDeviceChart)repDeviceChart.destroy();
    if(rbd.length){
      const ctx=rdEl.getContext('2d');const g=ctx.createLinearGradient(0,0,0,280);
      g.addColorStop(0,'rgba(48,215,60,0.55)');g.addColorStop(1,'rgba(48,215,60,0.05)');
      repDeviceChart=new Chart(rdEl,{type:'bar',
        data:{labels:rbd.map(x=>x.device||'—'),datasets:[{label:'Дохід',data:rbd.map(x=>x.sum||0),backgroundColor:g,hoverBackgroundColor:'rgba(48,215,60,0.8)',borderRadius:6,borderSkipped:false,maxBarThickness:42}]},
        options:{responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false},tooltip:{...TIP,callbacks:{label:c=>' ₴ '+Number(c.parsed.y||0).toLocaleString('uk-UA')}}},
          scales:{x:{grid:{display:false},border:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:8,font:{size:11}}},y:{beginAtZero:true,border:{display:false},grid:{color:'rgba(255,255,255,0.06)'},ticks:{maxTicksLimit:5,callback:v=>v>=1000?(v/1000)+'k':v}}}}
      });
    }
  }

  // Топ послуг (горизонтальні бари)
  const svc=(data.topServices||[]);
  const svcEl=document.getElementById('svcChartCanvas');
  if(svcEl){
    if(svcChart)svcChart.destroy();
    if(svc.length){
      const ctx=svcEl.getContext('2d');const g=ctx.createLinearGradient(0,0,svcEl.width||500,0);
      g.addColorStop(0,'rgba(31,226,106,0.25)');g.addColorStop(1,'rgba(31,226,106,0.65)');
      svcChart=new Chart(svcEl,{type:'bar',
        data:{labels:svc.map(x=>x.name),datasets:[{label:'К-ть',data:svc.map(x=>x.count),backgroundColor:g,hoverBackgroundColor:'rgba(31,226,106,0.85)',borderRadius:6,borderSkipped:false,maxBarThickness:22}]},
        options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false},tooltip:{...TIP,bodyColor:'#e6e6e6'}},
          scales:{x:{beginAtZero:true,border:{display:false},grid:{color:'rgba(255,255,255,0.06)'},ticks:{precision:0,font:{size:11}}},y:{grid:{display:false},border:{display:false},ticks:{font:{size:12}}}}}
      });
    }
  }

  // Продажі за період (ТОП товарів) — сума, бар
  const sEl=document.getElementById('salesChartCanvas');
  if(sEl){
    if(salesChart)salesChart.destroy();
    const ctx=sEl.getContext('2d');const g=ctx.createLinearGradient(0,0,0,280);
    g.addColorStop(0,'rgba(31,226,106,0.55)');g.addColorStop(1,'rgba(31,226,106,0.04)');
    salesChart=new Chart(sEl,{type:'bar',
      data:{labels:top.map(x=>x.product||'—'),datasets:[{label:'Сума',data:top.map(x=>x.sum||0),backgroundColor:g,hoverBackgroundColor:'rgba(31,226,106,0.8)',borderRadius:6,borderSkipped:false,maxBarThickness:34}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{...TIP,callbacks:{label:c=>' ₴ '+Number(c.parsed.y||0).toLocaleString('uk-UA')}}},
        scales:{x:{grid:{display:false},border:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:8,font:{size:10}}},y:{beginAtZero:true,border:{display:false},grid:{color:'rgba(255,255,255,0.06)'},ticks:{maxTicksLimit:5,callback:v=>v>=1000?(v/1000)+'k':v}}}}
    });
  }

  // Кількість (ТОП товарів) — лінія
  const pEl=document.getElementById('profitChartCanvas');
  if(pEl){
    if(profitChart)profitChart.destroy();
    const ctx=pEl.getContext('2d');const g=ctx.createLinearGradient(0,0,0,280);
    g.addColorStop(0,'rgba(31,142,226,0.45)');g.addColorStop(1,'rgba(31,142,226,0.02)');
    profitChart=new Chart(pEl,{type:'line',
      data:{labels:top.map(x=>x.product||'—'),datasets:[{label:'Кількість',data:top.map(x=>x.qty||0),borderColor:'#1f8ee2',backgroundColor:g,fill:true,tension:0.35,pointRadius:3,pointBackgroundColor:'#1f8ee2'}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{...TIP,bodyColor:'#cfe6ff'}},
        scales:{x:{grid:{display:false},border:{display:false},ticks:{maxRotation:0,autoSkip:true,maxTicksLimit:8,font:{size:10}}},y:{beginAtZero:true,border:{display:false},grid:{color:'rgba(255,255,255,0.06)'},ticks:{precision:0,maxTicksLimit:5}}}}
    });
  }
}

async function loadAnalytics(){
  const mode=getMode();
  applyModeVisibility(mode);                 // спершу показуємо потрібні панелі
  const from=getPickerIso(document.getElementById('fromDate'));
  const to=getPickerIso(document.getElementById('toDate'));
  const url=new URL('/api/Analytics/summary',API);if(from)url.searchParams.set('from',from);if(to)url.searchParams.set('to',to);url.searchParams.set('type',mode);
  renderKpi({});renderTopTable([]);renderRepDeviceTable([]);
  let out;
  try{out=await apiFetch(url.href,{headers:{'Authorization':`Bearer ${token}`}});}catch(e){return;}
  const{res}=out;
  if(res.status===401){showToast('error','Сесія завершилась');localStorage.removeItem('token');location.href="../auth/index.html";return;}
  if(!res.ok)return;
  const data=await res.json();lastData=data;
  renderKpi(data.kpi);renderTopTable(data.topProducts);renderRepDeviceTable(data.repairsByDevice);renderCharts(data);
}

// Excel export (професійний .xlsx з бекенду)
async function exportExcel(){
  const from=getPickerIso(document.getElementById('fromDate'));const to=getPickerIso(document.getElementById('toDate'));const type=getMode();
  const url=new URL('/api/Analytics/report-excel',API);if(from)url.searchParams.set('from',from);if(to)url.searchParams.set('to',to);url.searchParams.set('type',type);
  try{const{res}=await apiFetch(url.href,{headers:{'Authorization':`Bearer ${token}`}});
    if(!res.ok){showToast('error','Помилка генерації Excel');return;}
    const blob=await res.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`kontakt-zvit_${from||'all'}_${to||'all'}.xlsx`;a.click();showToast('success','Excel завантажено');
  }catch(e){showToast('error',e.message);}
}

// PDF report
async function exportPDF(){
  const from=getPickerIso(document.getElementById('fromDate'));const to=getPickerIso(document.getElementById('toDate'));const type=getMode();
  const url=new URL('/api/Analytics/report-pdf',API);if(from)url.searchParams.set('from',from);if(to)url.searchParams.set('to',to);url.searchParams.set('type',type);
  try{const{res}=await apiFetch(url.href,{headers:{'Authorization':`Bearer ${token}`}});
    if(!res.ok){showToast('error','Помилка генерації PDF');return;}
    const blob=await res.blob();const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`report_${from||'all'}_${to||'all'}.pdf`;a.click();showToast('success','PDF завантажено');
  }catch(e){showToast('error',e.message);}
}

// Перемикач періоду (Місяць/Квартал/Рік)
function setPeriod(p){
  const to=new Date();const from=new Date();
  if(p==='month')from.setMonth(to.getMonth()-1);
  else if(p==='quarter')from.setMonth(to.getMonth()-3);
  else if(p==='year')from.setFullYear(to.getFullYear()-1);
  setPicker(document.getElementById('fromDate'),isoDate(from));
  setPicker(document.getElementById('toDate'),isoDate(to));
}
document.getElementById('periodSeg')?.addEventListener('click',(e)=>{
  const b=e.target.closest('button[data-period]');if(!b)return;
  document.querySelectorAll('#periodSeg button').forEach(x=>x.classList.toggle('active',x===b));
  setPeriod(b.dataset.period);loadAnalytics();
});

// Кастомні календарі: зміна дати скидає активний сегмент і перезавантажує
attachDatePicker(document.getElementById('fromDate'), ()=>{document.querySelectorAll('#periodSeg button').forEach(x=>x.classList.remove('active'));loadAnalytics();});
attachDatePicker(document.getElementById('toDate'),   ()=>{document.querySelectorAll('#periodSeg button').forEach(x=>x.classList.remove('active'));loadAnalytics();});

setDefaultRange();
document.getElementById('applyBtn')?.addEventListener('click',()=>{document.querySelectorAll('#periodSeg button').forEach(x=>x.classList.remove('active'));loadAnalytics();});
document.getElementById('resetBtn')?.addEventListener('click',()=>{setPicker(document.getElementById('fromDate'),'');setPicker(document.getElementById('toDate'),'');const sel=document.getElementById('typeSelect');if(sel)sel.selectedIndex=0;setDefaultRange();loadAnalytics();});
document.getElementById('typeSelect')?.addEventListener('change',loadAnalytics);
document.getElementById('btnExportCSV')?.addEventListener('click',exportExcel);
document.getElementById('btnExportPDF')?.addEventListener('click',exportPDF);
loadAnalytics();
