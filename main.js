const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { exec } = require("child_process");
const { loadCookiesFromFile, getOutputFile, fetchManifestUrl, downloadVideo } = require('./vidoge.js');

const playwright = require("playwright");

const fs = require("fs");

async function ensurePlaywrightBrowser() {
  // Location where playwright stores its browsers
  const browserDir = path.join(app.getPath("userData"), "playwright-browsers");

  // Make playwright use a custom location (so it’s bundled with user data, not node_modules)
  process.env.PLAYWRIGHT_BROWSERS_PATH = browserDir;

  let isFirefoxInstalled = false;

  // Check for presence of versioned folder (e.g., 'firefox-1715')
  if (fs.existsSync(browserDir)) {
    const contents = fs.readdirSync(browserDir);
    isFirefoxInstalled = contents.some(name => name.startsWith('firefox-'));
  }

  // If missing, install it
  if (!isFirefoxInstalled) {
    const result = await dialog.showMessageBox({
      type: "info",
      buttons: ["Download", "Cancel"],
      defaultId: 0,
      message: "Playwright Firefox browser not found. Download now?",
      detail: "This may take a few minutes (about 200MB).",
    });
    
    if (result.response === 0) {
      console.log("Downloading Playwright Firefox...");

      // FIX: Execute the bundled Playwright CLI script directly using Node.
      // This path is relative to your main.js file and works both in dev and packaged modes.
      const playwrightCliPath = path.join(__dirname, 'node_modules', 'playwright', 'cli.js');
      
      const installCmd = `node "${playwrightCliPath}" install firefox`;
      
      await new Promise((resolve, reject) => {
        // Run the command. Setting cwd is often helpful but may not be strictly necessary here.
        const proc = exec(installCmd, (error, stdout, stderr) => {
          if (error) {
            console.error(`Playwright install error: ${stderr}`);
            reject(new Error(`Failed to install Firefox: ${error.message}`));
            return;
          }
          resolve();
        });

        // Optional: Pipe output to the console for live feedback
        proc.stdout.pipe(process.stdout);
        proc.stderr.pipe(process.stderr);
      });
      
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
