const { exec } = require('child_process');
const url = process.env.WEB_APP_URL || 'http://localhost:4080';

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
