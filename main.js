const { app, BrowserWindow } = require('electron');

function createWindow(){
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true
  });
  win.loadFile('renderer/index.html');
  win.once('ready-to-show', () => {
    win.maximize();   // розгортаємо
    win.show();       // показуємо без “мигання” розміру
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
