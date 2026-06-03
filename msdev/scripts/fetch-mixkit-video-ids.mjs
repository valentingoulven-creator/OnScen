#!/usr/bin/env node
/** Extrait des IDs vidéo Mixkit depuis les pages catégories (usage interne msdev). */
import https from 'node:https';

const CATEGORIES = [
  'music',
  'dance',
  'party',
  'concert',
  'night',
  'city',
  'nature',
  'sport',
  'technology',
  'fashion',
  'lifestyle',
  'business',
  'food',
  'travel',
  'art',
];

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0 MeloSong/1.0', Referer: 'https://mixkit.co/' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          fetchText(res.headers.location).then(resolve, reject);
          return;
        }
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => resolve(d));
      })
      .on('error', reject);
  });
}

function extractIds(html) {
  const ids = new Set();
  for (const m of html.matchAll(/assets\.mixkit\.co\/videos\/(\d+)\//g)) ids.add(Number(m[1]));
  for (const m of html.matchAll(/videos\/preview\/(\d+)/g)) ids.add(Number(m[1]));
  for (const m of html.matchAll(/"videoId":(\d+)/g)) ids.add(Number(m[1]));
  return ids;
}

async function headOk(id) {
  const url = `https://assets.mixkit.co/videos/${id}/${id}-720.mp4`;
  return new Promise((resolve) => {
    https
      .get(url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        resolve(res.statusCode === 200);
      })
      .on('error', () => resolve(false));
  });
}

const all = new Set();
for (const cat of CATEGORIES) {
  const html = await fetchText(`https://mixkit.co/free-stock-video/${cat}/`);
  for (const id of extractIds(html)) all.add(id);
  console.error(`category ${cat}: ${all.size} ids so far`);
}

const sorted = [...all].sort((a, b) => a - b);
console.error(`found ${sorted.length} unique ids, verifying mp4...`);

const valid = [];
for (const id of sorted) {
  if (valid.length >= 120) break;
  if (await headOk(id)) valid.push(id);
  if (valid.length % 10 === 0) console.error(`verified ${valid.length}`);
}

console.log(JSON.stringify(valid, null, 2));
