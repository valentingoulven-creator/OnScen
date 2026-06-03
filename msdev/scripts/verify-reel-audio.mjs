#!/usr/bin/env node
/** Vérifie présence piste audio (atom soun/mp4a) dans MP4 ou accessibilité MP3. */
import https from 'node:https';
import http from 'node:http';

function fetchBuffer(url, maxBytes = 8_000_000) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    lib
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0 MeloSong/1.0', Referer: 'https://mixkit.co/' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchBuffer(res.headers.location, maxBytes).then(resolve, reject);
          return;
        }
        const chunks = [];
        let size = 0;
        res.on('data', (c) => {
          size += c.length;
          if (size <= maxBytes) chunks.push(c);
          else res.destroy();
        });
        res.on('end', () =>
          resolve({ status: res.statusCode, buf: Buffer.concat(chunks), type: res.headers['content-type'] })
        );
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

function hasAudioAtom(buf) {
  const s = buf.toString('latin1');
  return /soun|mp4a|SoundHandler/.test(s);
}

async function check(label, url) {
  try {
    const { status, buf, type } = await fetchBuffer(url);
    const audio = url.endsWith('.mp3') ? status === 200 && buf.length > 1000 : hasAudioAtom(buf);
    console.log(`${audio ? 'OK' : 'NO_AUDIO'} [${status}] ${label} (${type}, ${buf.length}b)`);
    return audio;
  } catch (e) {
    console.log(`FAIL ${label}: ${e.message}`);
    return false;
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: node verify-reel-audio.mjs <url> [url...]');
  process.exit(1);
}

let ok = 0;
for (const url of args) {
  if (await check(url, url)) ok++;
}
process.exit(ok === args.length ? 0 : 1);
