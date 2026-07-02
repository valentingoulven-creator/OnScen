'use strict';
require('/opt/soundly/node_modules/dotenv').config({ path: '/opt/soundly/.env' });
const { Pool } = require('/opt/soundly/node_modules/pg');

const VAL_ID = 'user_1781025111633_ipv5l';

(async () => {
  const { loadPersistedStoreAsync } = require('/opt/soundly/dist/lib/persist');
  const { probeYoutubeHostSession, getValidYoutubeHostToken } = require('/opt/soundly/dist/lib/youtubeOAuth');
  const { isRealYoutubeAccount, getPlatformAccounts } = require('/opt/soundly/dist/lib/platformConnect');
  const { decryptPlatformTokens } = require('/opt/soundly/dist/lib/tokenEncryption');

  await loadPersistedStoreAsync();
  const { db } = require('/opt/soundly/dist/models/schema');
  const user = db.users.get(VAL_ID);
  if (!user) {
    console.log('User not found');
    process.exit(1);
  }

  const yt = getPlatformAccounts(user).find((a) => a.platform === 'youtube');
  const dec = yt ? decryptPlatformTokens(yt) : null;

  console.log('=== Val YouTube ===');
  console.log('connectedPlatforms:', user.connectedPlatforms);
  console.log('isRealYoutube:', isRealYoutubeAccount(user));
  console.log('channelId:', dec?.externalUserId);
  console.log('displayName:', dec?.displayName);
  console.log('tokenExpiresAt:', dec?.accessTokenExpiresAt, dec?.accessTokenExpiresAt ? new Date(dec.accessTokenExpiresAt).toISOString() : null);
  console.log('hasRefreshToken:', Boolean(dec?.refreshToken));
  console.log('oauthScopes:', dec?.oauthScopes);

  const session = await probeYoutubeHostSession(user);
  console.log('probeYoutubeHostSession:', session);

  const token = await getValidYoutubeHostToken(user);
  console.log('getValidYoutubeHostToken:', token.ok ? 'OK' : token);

  if (token.ok) {
    const ch = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
      { headers: { Authorization: `Bearer ${token.accessToken}` }, signal: AbortSignal.timeout(8000) }
    );
    console.log('channels API status:', ch.status);
    if (ch.ok) {
      const body = await ch.json();
      console.log('channel title:', body.items?.[0]?.snippet?.title);
    } else {
      console.log('channels API error:', await ch.text());
    }
  }

  const salons = [...db.salons.values()].filter((s) => s.hostId === VAL_ID);
  console.log('=== Active salons ===', salons.length);
  for (const s of salons.slice(0, 3)) {
    console.log({
      id: s.id,
      title: s.title,
      trackId: s.playbackState?.trackId,
      isPlaying: s.playbackState?.isPlaying,
      showVideo: s.playbackState?.showVideo,
      platform: s.platform,
    });
  }

  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
