const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectCookiesFile: () => ipcRenderer.invoke('select-cookies-file'),
  selectOutputFile: () => ipcRenderer.invoke('select-output-file'),
  startDownload: (args) => ipcRenderer.invoke('start-download', args),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (event, msg) => callback(msg)),
});
