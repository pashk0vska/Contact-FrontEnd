const todayText = new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' });
const elToday = document.getElementById('today'); if (elToday) elToday.textContent = `Сьогодні: ${todayText}`;
const token = localStorage.getItem('token'); if (!token) location.href = 'index.html';
const logoutEl = document.getElementById('logout'); if (logoutEl) logoutEl.addEventListener('click', () => { localStorage.removeItem('token'); location.href = 'index.html'; });

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
let salesChart = null, profitChart = null;

function renderTopTable(items){
  const tbody=document.getElementById('topTbody');if(!tbody)return;tbody.innerHTML='';
  if(!items||!items.length){tbody.innerHTML=`<tr><td colspan="4" style="text-align:center;opacity:.7">Немає даних за період</td></tr>`;return;}
  for(const it of items){const tr=document.createElement('tr');tr.innerHTML=`<td>${it.product||''}</td><td>${it.category||''}</td><td style="text-align:center">${Number(it.qty||0).toLocaleString('uk-UA')}</td><td style="text-align:right">${fmtMoney(it.sum)}</td>`;tbody.appendChild(tr);}
}
function renderKpi(kpi){setText('kpiIncome',fmtMoney(kpi?.income));setText('kpiSalesCount',String(kpi?.salesCount??0));setText('kpiRepairsCount',String(kpi?.repairsCount??0));setText('kpiAvgCheck',fmtMoney(kpi?.avgCheck));setText('kpiProfit',fmtMoney(kpi?.profitEstimate));setText('kpiNewClients',String(kpi?.newClients??0));}

function renderCharts(data){
  // Sales line chart
  const salesCtx=document.getElementById('salesChartCanvas');
  const profitCtx=document.getElementById('profitChartCanvas');
  if(!salesCtx||!profitCtx||typeof Chart==='undefined')return;

  // Generate simple daily data from top products for demo
  const topItems=data.topProducts||[];
  const labels=topItems.map(x=>x.product||'—');
  const values=topItems.map(x=>x.sum||0);
  const qtys=topItems.map(x=>x.qty||0);

  if(salesChart)salesChart.destroy();
  salesChart=new Chart(salesCtx,{type:'bar',data:{labels,datasets:[{label:'Сума продажів (₴)',data:values,backgroundColor:'rgba(31,226,106,0.4)',borderColor:'#1fe26a',borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#e6e6e6'}}},scales:{x:{ticks:{color:'#9aa4ad'}},y:{ticks:{color:'#9aa4ad'}}}}});

  if(profitChart)profitChart.destroy();
  profitChart=new Chart(profitCtx,{type:'line',data:{labels,datasets:[{label:'Кількість',data:qtys,borderColor:'#1f8ee2',backgroundColor:'rgba(31,142,226,0.2)',fill:true,tension:0.3}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:'#e6e6e6'}}},scales:{x:{ticks:{color:'#9aa4ad'}},y:{ticks:{color:'#9aa4ad'}}}}});
}

async function loadAnalytics(){
  const from=document.getElementById('fromDate')?.value||'';const to=document.getElementById('toDate')?.value||'';const type=getMode();
  const url=new URL('/api/Analytics/summary',API);if(from)url.searchParams.set('from',from);if(to)url.searchParams.set('to',to);url.searchParams.set('type',type);
  renderKpi({});renderTopTable([]);
  let out;
  try{out=await apiFetch(url.href,{headers:{'Authorization':`Bearer ${token}`}});}catch(e){return;}
  const{res}=out;
  if(res.status===401){showToast('error','Сесія завершилась');localStorage.removeItem('token');location.href='index.html';return;}
  if(!res.ok)return;
  const data=await res.json();lastData=data;
  renderKpi(data.kpi);renderTopTable(data.topProducts);renderCharts(data);
}

// CSV export
function exportCSV(){
  if(!lastData)return;const kpi=lastData.kpi||{};const top=lastData.topProducts||[];
  let csv='KPI\nПоказник,Значення\n';
  csv+=`Дохід,${kpi.income||0}\nПродажів,${kpi.salesCount||0}\nРемонтів,${kpi.repairsCount||0}\nСер. чек,${kpi.avgCheck||0}\nПрибуток,${kpi.profitEstimate||0}\nНових клієнтів,${kpi.newClients||0}\n\n`;
  csv+='ТОП-10 товарів\nПродукт,Категорія,Кількість,Сума\n';
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

setDefaultRange();
document.getElementById('applyBtn')?.addEventListener('click',loadAnalytics);
document.getElementById('resetBtn')?.addEventListener('click',()=>{document.getElementById('fromDate').value='';document.getElementById('toDate').value='';const sel=document.querySelector('.dropdown-menu select');if(sel)sel.selectedIndex=0;setDefaultRange();loadAnalytics();});
document.getElementById('fromDate')?.addEventListener('change',loadAnalytics);
document.getElementById('toDate')?.addEventListener('change',loadAnalytics);
document.querySelector('.dropdown-menu select')?.addEventListener('change',loadAnalytics);
document.getElementById('btnExportCSV')?.addEventListener('click',exportCSV);
document.getElementById('btnExportPDF')?.addEventListener('click',exportPDF);
loadAnalytics();
