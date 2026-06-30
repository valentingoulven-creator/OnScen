/**
 * Entry point for the Windows msdev.exe executable.
 * Starts MeloSong in msdev mode and opens the default browser.
 */
import { startMeloSong } from './bootstrap';

startMeloSong({ forceMsdev: true, openBrowser: true }).catch((err) => {
  console.error('Failed to start MeloSong msdev:', err);
  process.exit(1);
});
