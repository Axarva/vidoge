const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { loadCookiesFromFile, getOutputFile, fetchManifestUrl, downloadVideo } = require('./vidoge.js');

const { install, browsers } = require("playwright");
const fs = require("fs");

async function ensurePlaywrightBrowser() {
  // Location where playwright stores its browsers
  const browserDir = path.join(app.getPath("userData"), "playwright-browsers");

  // Make playwright use a custom location (so it’s bundled with user data, not node_modules)
  process.env.PLAYWRIGHT_BROWSERS_PATH = browserDir;

  // Firefox version key (this will depend on your playwright version)
  const firefoxPath = path.join(browserDir, browsers["firefox"].directoryName);

  // If missing, install it
  if (!fs.existsSync(firefoxPath)) {
    const result = await dialog.showMessageBox({
      type: "info",
      buttons: ["Download", "Cancel"],
      defaultId: 0,
      message: "Playwright Firefox browser not found. Download now?",
      detail: "This may take a few minutes (about 200MB).",
    });
    if (result.response === 0) {
      console.log("Downloading Playwright Firefox...");
      await install({ browsers: ["firefox"] });
      console.log("Firefox installed!");
    } else {
      app.quit();
    }
  }
}


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

app.whenReady().then(async() => { await ensurePlaywrightBrowser(); createWindow();});

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
