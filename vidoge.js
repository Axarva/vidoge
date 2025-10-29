const fs = require('fs'); // Change import to require
const path = require('path'); // Change import to require
const { exec } = require('child_process'); // Change import to require
const { firefox } = require('playwright'); // Change import to require
const { getFfmpegPath } = require('./ffmpeg-path.js');

function findPlaywrightExecutable() {
  // This path points to the folder bundled by electron-builder via extraResources
  const bundleDir = path.join(process.resourcesPath, 'playwright-browsers-bundle');
  
  if (!fs.existsSync(bundleDir)) {
    throw new Error(`Playwright bundle not found at: ${bundleDir}. Did the CI bundle successfully?`);
  }

  // Find the versioned folder (e.g., 'firefox-1495')
  const contents = fs.readdirSync(bundleDir);
  const versionedFolderName = contents.find(name => name.startsWith('firefox-'));

  if (!versionedFolderName) {
    throw new Error('Playwright Firefox versioned folder not found in bundle.');
  }

  // The final executable path structure:
  // [bundleDir]/[versionedFolderName]/firefox/firefox(.exe)
  const platformExeName = process.platform === 'win32' ? 'firefox.exe' : 'firefox';
  
  return path.join(bundleDir, versionedFolderName, 'firefox', platformExeName);
}


function loadCookiesFromFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Cookies file not found: ${filePath}`);
  }

  if (filePath.endsWith('.json')) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } else if (filePath.endsWith('.txt')) {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    const cookies = lines
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const [domain, flag, path, secure, expiry, name, value] = line.split('\t');
        return {
          domain,
          path,
          name,
          value,
          httpOnly: false,
          secure: secure === 'TRUE',
          expires: Number(expiry) || undefined,
        };
      });
    return cookies;
  } else {
    throw new Error('Invalid cookies file format. Must be .txt or .json');
  }
}

function getOutputFile(lectureUrl, providedName) {
  let outputFile = providedName;
  if (!outputFile) {
    const urlParts = lectureUrl.split('/');
    outputFile = urlParts[urlParts.length - 1].split('?')[0] || 'video.mp4';
    if (!outputFile.endsWith('.mp4')) outputFile += '.mp4';
  }

  const dir = path.dirname(outputFile);
  const ext = path.extname(outputFile);
  const base = path.basename(outputFile, ext);
  let counter = 1;
  let newPath = outputFile;
  while (fs.existsSync(newPath)) {
    newPath = path.join(dir, `${base} (${counter})${ext}`);
    counter++;
  }
  return newPath;
}

async function fetchManifestUrl(lectureUrl, cookies) {
  // const firefoxExecutable = path.join(process.resourcesPath, 'browsers', 'firefox', 'firefox');
  const firefoxExecutable = findPlaywrightExecutable();
  const browser = await firefox.launch({ executablePath: firefoxExecutable, headless: true });
  const page = await context.newPage();

  await context.addCookies(cookies);
  await page.goto(lectureUrl, { waitUntil: 'domcontentloaded' });

  let manifestUrl = null;
  try {
    manifestUrl = await page.waitForResponse(
      resp => resp.url().includes('videomanifest'),
      { timeout: 120_000 }
    ).then(resp => resp.url());
  } catch {
    await browser.close();
    throw new Error('No videomanifest detected. Cookies might be expired or page failed to load.');
  }

  await browser.close();
  return manifestUrl.split('&altManifestMetadata')[0];
}

function downloadVideo(manifestUrl, outputFile, onProgress) {
  const ffmpegPath = getFfmpegPath();
  const ffmpegCmd = `"${ffmpegPath}" -i "${manifestUrl}" -codec copy "${outputFile}"`;
  const proc = exec(ffmpegCmd);

  proc.stdout.on('data', data => onProgress && onProgress(data));
  proc.stderr.on('data', data => onProgress && onProgress(data));

  proc.on('close', code => {
    onProgress && onProgress(`Download finished with exit code ${code}`);
  });
}

module.exports = {
  loadCookiesFromFile,
  getOutputFile,
  fetchManifestUrl,
  downloadVideo,
};
