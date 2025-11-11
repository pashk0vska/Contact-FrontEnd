const logout = document.getElementById('logout');
        if (logout) logout.addEventListener('click', ()=>{ localStorage.removeItem('token'); location.href='index.html'; });