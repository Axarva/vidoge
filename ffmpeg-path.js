import path from 'path';
import os from 'os';

export function getFfmpegPath() {
  const platform = os.platform();

  if (platform === 'win32') {
    return path.join(__dirname, 'vendor', 'ffmpeg', 'win64', 'ffmpeg-master-latest-win64-lgpl', 'bin', 'ffmpeg.exe');
  } else if (platform === 'darwin') {
    return path.join(__dirname, 'vendor', 'ffmpeg', 'macos', 'ffmpeg');
  } else {
    // For Linux, assume ffmpeg is installed system-wide
    return 'ffmpeg';
  }
}