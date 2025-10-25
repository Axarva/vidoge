import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { firefox } from 'playwright';
import { getFfmpegPath } from './ffmpeg-path.js';

export function loadCookiesFromFile(filePath) {
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

export function getOutputFile(lectureUrl, providedName) {
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

export async function fetchManifestUrl(lectureUrl, cookies) {
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext();
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

export function downloadVideo(manifestUrl, outputFile, onProgress) {
  const ffmpegPath = getFfmpegPath();
  const ffmpegCmd = `"${ffmpegPath}" -i "${manifestUrl}" -codec copy "${outputFile}"`;
  const proc = exec(ffmpegCmd);

  proc.stdout.on('data', data => onProgress && onProgress(data));
  proc.stderr.on('data', data => onProgress && onProgress(data));

  proc.on('close', code => {
    onProgress && onProgress(`Download finished with exit code ${code}`);
  });
}
