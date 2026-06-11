window.API_BASE = "https://contact-backend-production-c5a3.up.railway.app";

// Підстраховка: затираємо стару закешовану адресу localhost,
// щоб застосунок не стукав у неіснуючий локальний бекенд.
try { localStorage.setItem("apiBase", window.API_BASE); } catch (e) {}
