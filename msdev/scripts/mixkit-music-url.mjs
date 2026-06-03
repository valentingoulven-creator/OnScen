import https from 'node:https';

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://mixkit.co/' } }, (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve(d));
      })
      .on('error', reject);
  });
}

const slug = process.argv[2] || 'trap-electro-vibes';
const html = await fetchText(`https://mixkit.co/free-stock-music/${slug}/`);
const urls = [...new Set(html.match(/https:\/\/assets\.mixkit\.co\/music\/[^"'\s]+/g) || [])];
console.log(urls.join('\n'));
