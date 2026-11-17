const { app, BrowserWindow, shell } = require('electron');
const path = require('node:path');
function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 720, minHeight: 520,
    backgroundColor: '#0b0c0f',
    icon: path.join(__dirname, '..', 'web', 'assets', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    title: 'Cyberpunk Diary',
    titleBarStyle: 'default',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadFile(path.join(__dirname, '..', 'web', 'index.html'));
  win.once('ready-to-show', () => { win.show(); win.maximize(); });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}
app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
