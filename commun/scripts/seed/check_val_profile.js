'use strict';
const http = require('http');
const { Pool } = require('pg');
const dotenv = require('dotenv');
dotenv.config({ path: '/opt/onscen/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function getJson(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: 3000, path }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  const val = await pool.query(`SELECT id, username FROM users WHERE username = 'Val' LIMIT 1`);
  const valId = val.rows[0]?.id;
  console.log('Val id:', valId);
  const profile = await getJson(`/api/users/${encodeURIComponent(valId)}/profile`);
  console.log('Public profile salon:', {
    salonId: profile.salonId,
    salonTitle: profile.salonTitle,
  });
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
