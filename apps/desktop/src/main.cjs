const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_URL = process.env.VISIT_CONTROL_URL || 'http://localhost';
const normalizeUrl = (value) => {
  const candidate = String(value || '').trim();
  if (!candidate) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
    return ['http:', 'https:'].includes(url.protocol) ? url.href.replace(/\/$/, '') : null;
  } catch { return null; }
};
const configPath = () => path.join(app.getPath('userData'), 'config.json');
const readServerUrl = () => {
  try { return normalizeUrl(JSON.parse(fs.readFileSync(configPath(), 'utf8')).serverUrl) || DEFAULT_URL; }
  catch { return DEFAULT_URL; }
};
const saveServerUrl = (serverUrl) => {
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify({ serverUrl }, null, 2));
};

let mainWindow;
let isClosing = false;

async function clearStoredLogin() {
  const serverUrl = readServerUrl();
  try {
    await mainWindow.webContents.session.clearStorageData({
      origin: serverUrl,
      storages: ['localstorage']
    });
  } catch {}
}

async function logoutAndClose() {
  try {
    if (!mainWindow.webContents.isDestroyed()) {
      await mainWindow.webContents.executeJavaScript(`
        (async () => {
          const token = localStorage.getItem('auth_token');
          if (token && location.protocol.startsWith('http')) {
            await fetch('/api/auth/logout', {
              method: 'POST',
              headers: { Authorization: 'Bearer ' + token },
              signal: AbortSignal.timeout(1500)
            }).catch(() => undefined);
          }
          localStorage.removeItem('auth_token');
          sessionStorage.clear();
        })()
      `);
    }
  } catch {}

  await clearStoredLogin();
}

async function showOffline(serverUrl = readServerUrl()) {
  await mainWindow.loadFile(path.join(__dirname, 'offline.html'), { query: { serverUrl } });
}
async function loadSystem() {
  const serverUrl = readServerUrl();
  try {
    await mainWindow.webContents.session.clearCache();
    await mainWindow.loadURL(serverUrl, { extraHeaders: 'Cache-Control: no-cache\n' });
  } catch { await showOffline(serverUrl); }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1024, minHeight: 700,
    title: 'Controle de Visitantes',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    backgroundColor: '#f1f5f9', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('did-fail-load', (_event, code, _description, url, mainFrame) => {
    if (mainFrame && code !== -3 && /^https?:\/\//i.test(url)) showOffline(url);
  });
  mainWindow.on('close', (event) => {
    if (isClosing) return;
    event.preventDefault();
    isClosing = true;
    logoutAndClose().finally(() => mainWindow.destroy());
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'Sistema', submenu: [
      { label: 'Recarregar', accelerator: 'F5', click: loadSystem },
      { label: 'Endereço configurado', click: () => dialog.showMessageBox(mainWindow, { title: 'Endereço do sistema', message: readServerUrl(), buttons: ['OK'] }) },
      { type: 'separator' }, { role: 'quit', label: 'Sair' }
    ] },
    { label: 'Exibir', submenu: [
      { role: 'togglefullscreen', label: 'Tela cheia' }, { role: 'resetZoom', label: 'Tamanho normal' },
      { role: 'zoomIn', label: 'Aumentar' }, { role: 'zoomOut', label: 'Diminuir' }
    ] }
  ]));
  clearStoredLogin().finally(loadSystem);
}

ipcMain.handle('save-server-url', async (_event, value) => {
  const serverUrl = normalizeUrl(value);
  if (!serverUrl) return { ok: false, message: 'Informe um endereço HTTP ou HTTPS válido.' };
  saveServerUrl(serverUrl);
  try { await mainWindow.loadURL(serverUrl); } catch { await showOffline(serverUrl); }
  return { ok: true };
});
ipcMain.handle('retry-connection', loadSystem);
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
