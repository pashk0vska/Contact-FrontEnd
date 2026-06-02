<<<<<<< HEAD
﻿const { app, BrowserWindow, shell } = require('electron');

function createWindow(){
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true
  });
  win.loadFile('renderer/index.html');
  // зовнішні посилання (Конфігуратор ПК) відкривати у системному браузері
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.once('ready-to-show', () => {
    win.maximize();   // розгортаємо
    win.show();       // показуємо без “мигання” розміру
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
=======
﻿const { app, BrowserWindow } = require('electron');

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
>>>>>>> 32b556b46fa6ebd6d481b68147b0781037af91e8
