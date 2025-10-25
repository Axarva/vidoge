const lectureUrlInput = document.getElementById('lectureUrl');
const cookiesPathInput = document.getElementById('cookiesPath');
const outputPathInput = document.getElementById('outputPath');
const logEl = document.getElementById('log');

document.getElementById('selectCookies').addEventListener('click', async () => {
  const file = await window.electronAPI.selectCookiesFile();
  if (file) cookiesPathInput.value = file;
});

document.getElementById('selectOutput').addEventListener('click', async () => {
  const file = await window.electronAPI.selectOutputFile();
  if (file) outputPathInput.value = file;
});

document.getElementById('startDownload').addEventListener('click', async () => {
  logEl.textContent = '';
  const lectureUrl = lectureUrlInput.value;
  const cookiesFile = cookiesPathInput.value;
  const outputFile = outputPathInput.value;

  if (!lectureUrl || !cookiesFile) {
    alert('Lecture URL, cookies file and output file are required.');
    return;
  }

  const result = await window.electronAPI.startDownload({ lectureUrl, cookiesFile, outputFile });

  if (!result.success) {
    logEl.textContent += `Error: ${result.error}\n`;
  }

  window.electronAPI.onDownloadProgress(msg => {
    logEl.textContent += msg + '\n';
    logEl.scrollTop = logEl.scrollHeight;
  });
});