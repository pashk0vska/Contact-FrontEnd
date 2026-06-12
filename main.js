const { app, BrowserWindow, shell } = require('electron');

function createWindow(){
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true
  });
  win.loadFile('renderer/features/auth/index.html');

  // Обробник відкриття нових вікон:
  // • http(s) (Конфігуратор ПК) → відкриваємо у системному браузері;
  // • blob:/data:/about:blank (PDF-чеки, акти, звіти) → відкриваємо прев'ю-вікном усередині застосунку.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        width: 900,
        height: 1000,
        autoHideMenuBar: true,
        title: 'Документ'
      }
    };
  });

  win.once('ready-to-show', () => {
    win.maximize();   // розгортаємо
    win.show();       // показуємо без "мигання" розміру
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
