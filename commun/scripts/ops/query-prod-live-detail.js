process.chdir('/opt/soundly');
require('dotenv').config({ path: '/opt/soundly/.env' });
const { Pool } = require('/opt/soundly/node_modules/pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const id = process.argv[2] || 'prod-seed-salon-beat-castel';
p.query('SELECT id, is_active, payload FROM lives WHERE id = $1', [id])
  .then((r) => {
    if (!r.rows[0]) {
      console.log('Live not found:', id);
      return p.end();
    }
    const live = r.rows[0].payload;
    console.log(JSON.stringify({
      id: r.rows[0].id,
      is_active: r.rows[0].is_active,
      payloadKeys: Object.keys(live || {}),
      presentationDemoStream: live?.presentationDemoStream,
      streamMode: live?.streamMode,
      cloudflarePlaybackUrl: live?.cloudflarePlaybackUrl,
      tipsEnabled: live?.tipsEnabled,
      viewersCount: live?.viewersCount,
      donationOptions: live?.donationOptions?.length,
      donationGoals: live?.donationGoals?.length,
    }, null, 2));
    return p.end();
  })
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
