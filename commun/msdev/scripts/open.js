const { exec } = require('child_process');
const https = require('https');
const http = require('http');

function probe(url, allowInsecure) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const opts = url.startsWith('https') ? { rejectUnauthorized: !allowInsecure } : {};
    const req = lib.get(url, opts, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

(async () => {
  const envUrl = process.env.WEB_APP_URL;
  if (envUrl) {
    open(envUrl);
    return;
  }
  const httpsOk = await probe('https://localhost:4080/', true);
  const url = httpsOk
    ? 'https://localhost:4080'
    : (await probe('http://localhost:4080/'))
      ? 'http://localhost:4080'
      : 'https://localhost:4080';
  open(url);
})();

function open(url) {
  const cmd =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;

  exec(cmd, (err) => {
    if (err) {
      console.error('Could not open browser. Open manually:', url);
      process.exit(1);
    }
    console.log('Opened:', url);
  });
}
