'use strict';
const http = require('http');
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: '/opt/onscen/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function postJson(path, body, token) {
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let b = '';
        res.on('data', (c) => { b += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(b)); } catch { resolve({ raw: b.slice(0, 200) }); }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(path, token) {
  return new Promise((resolve, reject) => {
    http.get(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      (res) => {
        let b = '';
        res.on('data', (c) => { b += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(b)); } catch { resolve({ raw: b.slice(0, 300) }); }
        });
      }
    ).on('error', reject);
  });
}

(async () => {
  const val = await pool.query(`SELECT id, email FROM users WHERE username = 'Val' LIMIT 1`);
  const valId = val.rows[0].id;

  const login = await postJson('/api/auth/login', {
    email: 'valentin.goulven@gmail.com',
    password: process.env.VAL_PASSWORD || 'dummy',
  });
  if (!login.token) {
    console.log('Login as Val skipped (no password) — using admin');
    const admin = await postJson('/api/auth/login', {
      email: 'admin@getsoundy.com',
      password: 'Bonjour123!',
    });
    login.token = admin.token;
  }

  const profile = await getJson(`/api/auth/profile/${encodeURIComponent(valId)}`, login.token);
  console.log('PROFILE API:', JSON.stringify({
    salonId: profile.user?.salonId,
    salonTitle: profile.user?.salonTitle,
    currentListening: profile.user?.currentListening,
  }, null, 2));

  const active = await pool.query(
    `SELECT id, payload->>'title' title, payload->>'accessMode' mode,
            payload->>'isGhostMode' ghost, payload->>'createdAt' created,
            payload->'playbackState'->>'title' track,
            payload->'playbackState'->>'artist' artist
     FROM salons WHERE host_id = $1
     ORDER BY (payload->>'createdAt')::bigint DESC LIMIT 5`,
    [valId]
  );
  console.log('RECENT SALONS DB:', JSON.stringify(active.rows, null, 2));

  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
