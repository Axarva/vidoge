import path from 'path';
import os from 'os';
import { app } from 'electron';

export function getFfmpegPath() {
  const platform = os.platform();

  // In dev mode, resourcesPath points inside node_modules/electron,
  // so we fallback to __dirname for local vendor/
  const basePath = app.isPackaged ? process.resourcesPath : path.resolve(__dirname);

  if (platform === 'win32') {
    return path.join(basePath, 'vendor', 'ffmpeg', 'win64', 'ffmpeg-master-latest-win64-lgpl', 'bin', 'ffmpeg.exe');
  } else if (platform === 'darwin') {
    return path.join(basePath, 'vendor', 'ffmpeg', 'macos', 'ffmpeg');
  } else {
    return 'ffmpeg';
  }
}
