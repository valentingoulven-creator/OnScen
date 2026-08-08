/**
 * Entry point for the Windows msdev.exe executable.
 * Starts OnScen in msdev mode and opens the default browser.
 */
import { startOnScen } from './bootstrap';

startOnScen({ forceMsdev: true, openBrowser: true }).catch((err) => {
  console.error('Failed to start OnScen msdev:', err);
  process.exit(1);
});
