/**
 * Post-process msdev.exe Windows version resources (pkg ships Node.js metadata by default).
 * Requires: npm install in backend/ (resedit devDependency).
 */
const fs = require('fs');
const path = require('path');

const exePath = process.argv[2];
const version = process.argv[3] || '2.0.0';

if (!exePath || !fs.existsSync(exePath)) {
  console.error('Usage: node patch-exe-metadata.cjs <exePath> [version]');
  process.exit(1);
}

const backendModules = path.join(__dirname, '..', '..', 'backend', 'node_modules');
let ResEdit;
try {
  ResEdit = require(require.resolve('resedit', { paths: [backendModules, __dirname] }));
} catch {
  console.warn('resedit not installed — skip metadata patch (npm install in backend/)');
  process.exit(0);
}

const lang = 1033;
const codepage = 1200;
const [major, minor, patch] = version.split('.').map((n) => Number(n) || 0);

const exeData = fs.readFileSync(exePath);
const exe = ResEdit.NtExecutable.from(exeData);
const res = ResEdit.NtExecutableResource.from(exe);
const viList = ResEdit.Resource.VersionInfo.fromEntries(res.entries);
const vi = viList[0];

vi.setFileVersion(major, minor, patch, 0, lang);
vi.setProductVersion(major, minor, patch, 0, lang);
vi.setStringValues(
  { lang, codepage },
  {
    FileDescription: 'Soundy — serveur local msdev (Windows)',
    ProductName: 'Soundy msdev',
    CompanyName: 'Soundy',
    ProductVersion: version,
    FileVersion: version,
    OriginalFilename: path.basename(exePath),
    LegalCopyright: `Copyright ${new Date().getFullYear()} Soundy`,
    InternalName: 'msdev',
  }
);

vi.outputToResourceEntries(res.entries);
res.outputResource(exe);
const tmp = `${exePath}.metadata.tmp`;
fs.writeFileSync(tmp, Buffer.from(exe.generate()));
fs.renameSync(tmp, exePath);
console.log(`Metadata applied: ${exePath} (v${version})`);
