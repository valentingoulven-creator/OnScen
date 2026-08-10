'use strict';
require('/opt/onscen/node_modules/dotenv').config({ path: '/opt/onscen/.env' });

const VAL_ID = 'user_1781025111633_ipv5l';

(async () => {
  const { loadPersistedStoreAsync } = require('/opt/onscen/dist/lib/persist');
  const { decryptPlatformTokens } = require('/opt/onscen/dist/lib/tokenEncryption');
  const { getPlatformAccounts } = require('/opt/onscen/dist/lib/platformConnect');

  await loadPersistedStoreAsync();
  const { db } = require('/opt/onscen/dist/models/schema');
  const user = db.users.get(VAL_ID);
  const yt = getPlatformAccounts(user).find((a) => a.platform === 'youtube');
  const dec = decryptPlatformTokens(yt);

  console.log('MOCK_PLATFORM_CONNECT_USERNAMES:', process.env.MOCK_PLATFORM_CONNECT_USERNAMES);
  console.log('accessToken starts with mock_:', dec.accessToken?.startsWith('mock_'));
  console.log('expiresAt:', dec.accessTokenExpiresAt, new Date(dec.accessTokenExpiresAt).toISOString());

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET.trim(),
      grant_type: 'refresh_token',
      refresh_token: dec.refreshToken,
    }),
  });
  console.log('refresh status:', tokenRes.status);
  console.log('refresh body:', await tokenRes.text());

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
