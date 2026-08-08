import './lib/preferIPv4Dns';
import dotenv from 'dotenv';
import { getMsdevEnvPath } from './paths';

const isMsdev =
  process.env.MSENV === 'msdev' ||
  process.env.APP_ENV === 'msdev' ||
  process.argv.includes('--msdev');

if (isMsdev) {
  process.env.MSENV = process.env.MSENV || 'msdev';
  process.env.APP_ENV = process.env.APP_ENV || 'msdev';
  dotenv.config({ path: getMsdevEnvPath() });
} else {
  dotenv.config();
}

void import('./bootstrap')
  .then(({ startOnScen }) => startOnScen({ forceMsdev: isMsdev, openBrowser: false }))
  .catch((err) => {
    console.error('Failed to start OnScen:', err);
    process.exit(1);
  });
