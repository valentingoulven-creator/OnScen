'use strict';
require('dotenv').config({ path: '/opt/onscen/.env' });
process.chdir('/opt/onscen');

(async () => {
  const { loadSalonsLivesFromPostgres } = require('./dist/lib/pgSalonsLives');
  const { getActiveSalonForHost } = require('./dist/lib/profile');
  const { isSalonPublic } = require('./dist/lib/salonAccess');
  const { db } = require('./dist/models/schema');

  await loadSalonsLivesFromPostgres();
  const valId = 'user_1781025111633_ipv5l';
  const hostSalons = [...db.salons.values()].filter((s) => s.hostId === valId);
  console.log('Total Val salons in memory:', hostSalons.length);

  const pubNonGhost = hostSalons.filter(
    (s) => isSalonPublic(s) && !s.isGhostMode && !s.adminBlocked
  );
  console.log('Public non-ghost count:', pubNonGhost.length);
  if (pubNonGhost[0]) {
    console.log('Sample isGhostMode type:', typeof pubNonGhost[0].isGhostMode, pubNonGhost[0].isGhostMode);
  }
  pubNonGhost.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  console.log('Top public non-ghost:', pubNonGhost.slice(0, 3).map((s) => ({
    id: s.id,
    createdAt: s.createdAt,
    isGhostMode: s.isGhostMode,
    lat: s.latitude,
  })));

  const active = getActiveSalonForHost(valId);
  console.log('getActiveSalonForHost:', active?.id, 'ghost:', active?.isGhostMode);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
