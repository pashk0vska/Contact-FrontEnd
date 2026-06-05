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
function setDefaultRange(){const to=new Date(),from=new Date();from.setDate(to.getDate()-29);const f=document.getElementById('fromDate'),t2=document.getElementById('toDate');if(f&&!f.value)f.value=isoDate(from);if(t2&&!t2.value)t2.value=isoDate(to);}
function getMode(){const sel=document.querySelector('.dropdown-menu select');const v=(sel?.value||'').toLowerCase();if(v.includes('лише продаж'))return'sales';if(v.includes('лише ремонт'))return'repairs';return'all';}

let lastData = null;

function renderTopTable(items){
  const tbody=document.getElementById('topTbody');if(!tbody)return;tbody.innerHTML='';
  if(!items||!items.length){tbody.innerHTML=`<tr><td colspan="4" style="text-align:center;opacity:.7">Немає даних за період</td></tr>`;return;}
  for(const it of items){const tr=document.createElement('tr');tr.innerHTML=`<td>${it.product||''}</td><td>${it.category||''}</td><td style="text-align:center">${Number(it.qty||0).toLocaleString('uk-UA')}</td><td style="text-align:right">${fmtMoney(it.sum)}</td>`;tbody.appendChild(tr);}
}
function renderKpi(kpi){setText('kpiIncome',fmtMoney(kpi?.income));setText('kpiSalesCount',String(kpi?.salesCount??0));setText('kpiRepairsCount',String(kpi?.repairsCount??0));setText('kpiAvgCheck',fmtMoney(kpi?.avgCheck));setText('kpiProfit',fmtMoney(kpi?.profitEstimate));setText('kpiNewClients',String(kpi?.newClients??0));}

// ===== Графіки (стиль дашборду) — Блок B =====
let catChart=null, svcChart=null;
const CAT_COLORS={'Ремонти':'#30D73C','Товари':'#1f8ee2','Збірки':'#9b6cf0','Послуги':'#e2b81f'};
function renderCharts(data){
  if(typeof Chart==='undefined')return;
  Chart.defaults.font.family="Inter,system-ui,Segoe UI,Roboto,sans-serif";
  Chart.defaults.color="#7d8b96";

  // Дохід за категоріями
  const cats=(data.byCategory||[]);
  const cc=document.getElementById('catChartCanvas');
  if(cc){
    if(catChart)catChart.destroy();
    catChart=new Chart(cc,{
      type:'bar',
      data:{labels:cats.map(x=>x.name),datasets:[{label:'Дохід',data:cats.map(x=>x.value),backgroundColor:cats.map(x=>CAT_COLORS[x.name]||'#30D73C'),borderRadius:6,borderSkipped:false,maxBarThickness:64}]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{display:false},tooltip:{backgroundColor:'#0b1116',borderColor:'#243039',borderWidth:1,displayColors:false,callbacks:{label:c=>' ₴ '+Number(c.parsed.y||0).toLocaleString('uk-UA')}}},
        scales:{x:{grid:{display:false},border:{display:false},ticks:{font:{size:12}}},y:{beginAtZero:true,border:{display:false},grid:{color:'rgba(255,255,255,0.06)'},ticks:{maxTicksLimit:5,callback:v=>v>=1000?(v/1000)+'k':v}}}}
    });
  }

  // Топ послуг (горизонтальні бари)
  const svc=(data.topServices||[]);
  const sc=document.getElementById('svcChartCanvas');
  if(sc){
    if(svcChart)svcChart.destroy();
    if(svc.length){
      const ctx=sc.getContext('2d');
      const g=ctx.createLinearGradient(0,0,sc.width||500,0);
      g.addColorStop(0,'rgba(31,226,106,0.25)'); g.addColorStop(1,'rgba(31,226,106,0.65)');
      svcChart=new Chart(sc,{
        type:'bar',
        data:{labels:svc.map(x=>x.name),datasets:[{label:'К-ть',data:svc.map(x=>x.count),backgroundColor:g,hoverBackgroundColor:'rgba(31,226,106,0.85)',borderRadius:6,borderSkipped:false,maxBarThickness:22}]},
        options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false},tooltip:{backgroundColor:'#0b1116',borderColor:'#243039',borderWidth:1,displayColors:false}},
          scales:{x:{beginAtZero:true,border:{display:false},grid:{color:'rgba(255,255,255,0.06)'},ticks:{precision:0,font:{size:11}}},y:{grid:{display:false},border:{display:false},ticks:{font:{size:12}}}}}
      });
    }
  }
}

async function loadAnalytics(){
  const from=document.getElementById('fromDate')?.value||'';const to=document.getElementById('toDate')?.value||'';const type=getMode();
  const url=new URL('/api/Analytics/summary',API);if(from)url.searchParams.set('from',from);if(to)url.searchParams.set('to',to);url.searchParams.set('type',type);
  renderKpi({});renderTopTable([]);
  let out;
  try{out=await apiFetch(url.href,{headers:{'Authorization':`Bearer ${token}`}});}catch(e){return;}
  const{res}=out;
  if(res.status===401){showToast('error','Сесія завершилась');localStorage.removeItem('token');location.href="../auth/index.html";return;}
  if(!res.ok)return;
  const data=await res.json();lastData=data;
  renderKpi(data.kpi);renderTopTable(data.topProducts);renderCharts(data);
}

// CSV export
function exportCSV(){
  if(!lastData)return;const kpi=lastData.kpi||{};const top=lastData.topProducts||[];const cats=lastData.byCategory||[];
  let csv='KPI\nПоказник,Значення\n';
  csv+=`Дохід,${kpi.income||0}\nПродажів,${kpi.salesCount||0}\nРемонтів,${kpi.repairsCount||0}\nСер. чек,${kpi.avgCheck||0}\nПрибуток,${kpi.profitEstimate||0}\nНових клієнтів,${kpi.newClients||0}\n\n`;
  csv+='Дохід за категоріями\nКатегорія,Сума\n';
  for(const c of cats) csv+=`"${c.name}",${c.value}\n`;
  csv+='\nТОП-10 товарів\nПродукт,Категорія,Кількість,Сума\n';
  for(const t of top) csv+=`"${t.product}","${t.category}",${t.qty},${t.sum}\n`;
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`analytics_${new Date().toISOString().slice(0,10)}.csv`;a.click();
  showToast('success','CSV завантажено');
}

// PDF report
async function exportPDF(){
  const from=document.getElementById('fromDate')?.value||'';const to=document.getElementById('toDate')?.value||'';const type=getMode();
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
  const f=document.getElementById('fromDate'),t2=document.getElementById('toDate');
  if(f)f.value=isoDate(from);if(t2)t2.value=isoDate(to);
}
document.getElementById('periodSeg')?.addEventListener('click',(e)=>{
  const b=e.target.closest('button[data-period]');if(!b)return;
  document.querySelectorAll('#periodSeg button').forEach(x=>x.classList.toggle('active',x===b));
  setPeriod(b.dataset.period);loadAnalytics();
});

setDefaultRange();
document.getElementById('applyBtn')?.addEventListener('click',loadAnalytics);
document.getElementById('resetBtn')?.addEventListener('click',()=>{document.getElementById('fromDate').value='';document.getElementById('toDate').value='';const sel=document.querySelector('.dropdown-menu select');if(sel)sel.selectedIndex=0;setDefaultRange();loadAnalytics();});
document.getElementById('fromDate')?.addEventListener('change',loadAnalytics);
document.getElementById('toDate')?.addEventListener('change',loadAnalytics);
document.querySelector('.dropdown-menu select')?.addEventListener('change',loadAnalytics);
document.getElementById('btnExportCSV')?.addEventListener('click',exportCSV);
document.getElementById('btnExportPDF')?.addEventListener('click',exportPDF);
loadAnalytics();
