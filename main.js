import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { loadCookiesFromFile, getOutputFile, fetchManifestUrl, downloadVideo } from './vidoge.js';

function createWindow() {
  const win = new BrowserWindow({
    width: 700,
    height: 500,
    webPreferences: {
      preload: path.join(app.getAppPath(), 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

// IPC handlers
ipcMain.handle('select-cookies-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ filters: [{ name: 'Cookies', extensions: ['txt','json'] }]});
  return canceled ? null : filePaths[0];
});

ipcMain.handle('select-output-file', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({ defaultPath: 'video.mp4', filters: [{ name: 'Videos', extensions: ['mp4'] }]});
  return canceled ? null : filePath;
});

ipcMain.handle('start-download', async (event, { lectureUrl, cookiesFile, outputFile }) => {
  try {
    const cookies = loadCookiesFromFile(cookiesFile);
    const safeOutput = getOutputFile(lectureUrl, outputFile);
    const manifestUrl = await fetchManifestUrl(lectureUrl, cookies);

    downloadVideo(manifestUrl, safeOutput, (msg) => {
      event.sender.send('download-progress', msg.toString());
    });

    return { success: true, outputFile: safeOutput };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
