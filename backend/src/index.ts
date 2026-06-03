import { startMeloSong } from './bootstrap';

const isMsdev =
  process.env.MSENV === 'msdev' ||
  process.env.APP_ENV === 'msdev' ||
  process.argv.includes('--msdev');

startMeloSong({ forceMsdev: isMsdev, openBrowser: false }).catch((err) => {
  console.error('Failed to start MeloSong:', err);
  process.exit(1);
});
