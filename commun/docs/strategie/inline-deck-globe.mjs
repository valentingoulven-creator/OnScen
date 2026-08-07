import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, 'SOUNDY-PRESENTATION-PRODUIT.html');
const globePath = join(__dirname, 'deck-globe.js');
const globe = readFileSync(globePath, 'utf8');
let html = readFileSync(htmlPath, 'utf8');

const inlineBlock = `<script type="module">\n${globe}\n</script>`;
const inlineRe =
  /<script type="module">[\s\S]*?import Globe from 'https:\/\/esm\.sh\/globe\.gl[\s\S]*?<\/script>(?=\s*<\/body>)/;

if (inlineRe.test(html)) {
  html = html.replace(inlineRe, inlineBlock);
} else {
  const externalTag = '<script type="module" src="./deck-globe.js"></script>';
  if (!html.includes(externalTag)) {
    console.error('Impossible de trouver le bloc deck-globe (inline ou externe).');
    process.exit(1);
  }
  html = html.replace(externalTag, inlineBlock);
}

writeFileSync(htmlPath, html);
console.log('deck-globe synchronisé dans SOUNDY-PRESENTATION-PRODUIT.html');
