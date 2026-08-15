export function buildAppleAppSiteAssociation(teamId: string): {
  applinks: { apps: string[]; details: Array<{ appID: string; paths: string[] }> };
  webcredentials: { apps: string[] };
} {
  const appID = `${teamId.trim()}.com.soundy.app`;
  return {
    applinks: {
      apps: [],
      details: [
        {
          appID,
          paths: ['/', '/salon/*', '/live/*', '/profile/*', '/reels/*', '/tel/*', '/auth/*'],
        },
      ],
    },
    webcredentials: { apps: [appID] },
  };
}
