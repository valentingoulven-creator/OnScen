'use strict';
require('/opt/onscen/node_modules/dotenv').config({ path: '/opt/onscen/.env' });

const VAL_ID = 'user_1781025111633_ipv5l';

(async () => {
  const { loadPersistedStoreAsync, savePersistedStore } = require('/opt/onscen/dist/lib/persist');
  const { disconnectYoutubeOnAuthFailure } = require('/opt/onscen/dist/lib/youtubeOAuth');

  await loadPersistedStoreAsync();
  const { db } = require('/opt/onscen/dist/models/schema');
  const user = db.users.get(VAL_ID);
  if (!user) {
    console.log('User not found');
    process.exit(1);
  }

  console.log('Before:', user.connectedPlatforms);
  disconnectYoutubeOnAuthFailure(user, 'manual_stale_token_cleanup');
  db.users.set(VAL_ID, user);
  savePersistedStore();
  console.log('After:', user.connectedPlatforms);
  console.log('YouTube disconnected — reconnect via Profil > YouTube');
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
