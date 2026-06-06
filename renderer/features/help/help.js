// Допомога — дата, охорона сесії, пошук по розділах
const token = localStorage.getItem('token');
if (!token) location.href = "../auth/index.html";

const elToday = document.getElementById('today');
if (elToday) elToday.textContent = `Сьогодні: ${new Date().toLocaleDateString('uk-UA', { day: '2-digit', month: 'long', year: 'numeric' })}`;

// Живий пошук: фільтрує акордеони за текстом
(function initHelpSearch() {
  const q = document.getElementById('helpSearch');
  const empty = document.getElementById('helpEmpty');
  const accs = Array.from(document.querySelectorAll('.help-acc'));
  if (!q) return;

  q.addEventListener('input', () => {
    const v = q.value.trim().toLowerCase();
    if (!v) {
      accs.forEach((a, i) => { a.style.display = ''; a.open = (i === 0); });
      if (empty) empty.hidden = true;
      return;
    }
    let shown = 0;
    accs.forEach(a => {
      const hit = a.textContent.toLowerCase().includes(v);
      a.style.display = hit ? '' : 'none';
      a.open = hit;
      if (hit) shown++;
    });
    if (empty) empty.hidden = shown > 0;
  });
})();
