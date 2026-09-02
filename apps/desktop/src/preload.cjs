const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopApp', {
  saveServerUrl: (url) => ipcRenderer.invoke('save-server-url', url),
  retryConnection: () => ipcRenderer.invoke('retry-connection')
});
