/**
 * Builds server.exe at project root (restart msdev on port 4080).
 * Uses Windows csc.exe (.NET Framework) — no npm/ps2exe required.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const csFile = path.join(__dirname, 'server-launcher.cs');
const outExe = path.join(root, 'server.exe');

const cscCandidates = [
  process.env.WINDIR
    ? path.join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')
    : null,
  process.env.WINDIR
    ? path.join(process.env.WINDIR, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe')
    : null,
].filter(Boolean);

if (process.platform !== 'win32') {
  console.error('build:server-exe is Windows-only.');
  process.exit(1);
}
if (!fs.existsSync(csFile)) {
  console.error('Missing', csFile);
  process.exit(1);
}

const csc = cscCandidates.find((p) => fs.existsSync(p));
if (!csc) {
  console.error('csc.exe not found. Use server.bat or: npm run msdev:restart');
  process.exit(1);
}

console.log('Building server.exe (restart launcher)...\n');

try {
  execSync(
    `"${csc}" /nologo /target:exe /out:"${outExe}" "${csFile}"`,
    { stdio: 'inherit', cwd: root }
  );
} catch (err) {
  console.error('\ncsc build failed. Use server.bat (double-click) or: npm run msdev:restart\n');
  process.exit(1);
}

if (!fs.existsSync(outExe)) {
  console.error('server.exe was not created.');
  process.exit(1);
}

try {
  execSync(
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -LiteralPath '${outExe.replace(/'/g, "''")}' -ErrorAction SilentlyContinue"`,
    { stdio: 'inherit' }
  );
} catch {
  // optional
}

console.log('\n✓ server.exe ready:', outExe);
console.log('  Double-click to free port 4080 and restart http://localhost:4080\n');
