#!/usr/bin/env node
/** Split app/src/lib/api.ts into domain modules under app/src/lib/api/ */
import fs from 'fs';
import path from 'path';

const root = path.resolve('app/src/lib');
const srcPath = path.join(root, 'api.ts');
const outDir = path.join(root, 'api');
const src = fs.readFileSync(srcPath, 'utf8');

const bodyMatch = src.match(/export const api = \{([\s\S]*)\};\s*$/);
if (!bodyMatch) {
  console.error('Could not parse api object');
  process.exit(1);
}
const body = bodyMatch[1];

const methodRe = /^\s{2}([a-zA-Z][a-zA-Z0-9]*):/gm;
const methods = [];
let m;
while ((m = methodRe.exec(body)) !== null) {
  methods.push({ name: m[1], start: m.index });
}
for (let i = 0; i < methods.length - 1; i++) {
  methods[i].end = methods[i + 1].start;
}
methods[methods.length - 1].end = body.length;

function chunkFor(name) {
  const hit = methods.find((x) => x.name === name);
  if (!hit) return null;
  let text = body.slice(hit.start, hit.end).trimEnd();
  if (text.endsWith(',')) text = text.slice(0, -1);
  return text;
}

const domains = {
  auth: [
    'login', 'register', 'completeOnboarding', 'getOAuthProviders', 'exchangeOAuthCode',
    'me', 'acceptTerms', 'logout', 'toggleGhost', 'checkUsername', 'changePassword',
    'setup2FA', 'verify2FA', 'disable2FA', 'get2FAStatus', 'validate2FA',
    'deleteAccount', 'exportMyData', 'updateProfile', 'getUserProfile',
    'webauthnRegisterOptions', 'webauthnRegisterVerify', 'webauthnLoginOptions',
    'webauthnLoginVerify', 'webauthnGetCredentials', 'webauthnDeleteCredential',
  ],
  access: [
    'getAccessConfig', 'getAccessAdminStatus', 'getAccessAdminOverview', 'getAccessAdminUsers',
    'getAccessAdminUser', 'patchAccessPolicy', 'approveAccessUser', 'blockAccessUser',
    'unblockAccessUser', 'promoteAccessUser', 'demoteAccessUser', 'assignAdminPlatformPlan',
    'createAccessInvite', 'setAccessInviteDisabled', 'deleteAccessInvite',
    'submitSupportContact', 'getMySupportMessages', 'getAdminSupportMessages',
    'replyAdminSupportMessage', 'resolveAdminSupportMessage', 'replySupportContact', 'resolveSupportContact',
  ],
  admin: [
    'getAdminSalons', 'getAdminLives', 'getAdminEvents', 'adminBlockSalon', 'adminUnblockSalon',
    'adminDeleteSalon', 'adminBlockLive', 'adminUnblockLive', 'adminDeleteLive',
    'adminBlockEvent', 'adminUnblockEvent', 'adminDeleteEvent', 'getAdminReels',
    'adminBlockReel', 'adminUnblockReel', 'adminDeleteReel',
    'adminGetReports', 'adminPatchReport', 'adminDeleteReport',
    'getAnalyticsSummary', 'getCloudflareUsage', 'getDonationsSummary', 'getVpsMetrics', 'getVpsSyslog',
  ],
  sponsors: [
    'getAdminSponsors', 'createAdminSponsor', 'updateAdminSponsor', 'toggleAdminSponsor',
    'reorderAdminSponsors', 'deleteAdminSponsor', 'uploadAdminSponsorLogo', 'uploadAdminSponsorBanner',
    'getMapSponsors', 'getFeedSponsors', 'getStoriesSponsors', 'getReelsSponsors',
    'getStoriesViewerSponsors', 'getSalonSponsors', 'getAdminSponsorsConfig', 'patchAdminSponsorsConfig',
  ],
  legal: ['getLegalPublisher', 'submitContentReport'],
  geo: ['updateGeo', 'nearby'],
  music: ['getMusicHome'],
  salons: [
    'listSalons', 'getSalon', 'salonChangeTrack', 'salonAddToQueue', 'salonLoadPlaylist',
    'createSalon', 'joinSalon', 'deleteSalon', 'updateSalonSettings', 'addSalonGuest',
    'removeSalonGuest', 'validateSalonGuests', 'getSalonQueue', 'reorderSalonQueue',
    'getSalonProposals', 'getSalonParticipants', 'setSalonParticipantVip', 'proposeSalonTrack',
    'acceptSalonProposal', 'rejectSalonProposal', 'upvoteSalonProposal', 'salonPlaybackSkip',
    'salonPlayQueueItem', 'salonChat',
  ],
  platforms: [
    'resolveSalonTrack', 'searchYoutube', 'salonLoadYoutubePlaylist',
    'getYoutubePlaylists', 'getYoutubeOAuthUrl', 'getInstagramOAuthUrl', 'getPlatformStatus',
    'connectPlatform', 'disconnectPlatform',
    'getMsdevDualIp', 'msdevLoginByIp', 'msdevRebuild',
  ],
  lives: [
    'getLives', 'getLive', 'getLiveParticipants', 'startLive', 'stopLive', 'getLivePlayback',
    'getLiveIceServers', 'getLiveStreamCapabilities', 'provisionCloudflareStream', 'getCloudflareIngest',
    'getLiveKitToken', 'startEgress', 'stopEgress', 'liveChat', 'getUserLives',
  ],
  dm: [
    'getDmPresence', 'getConversations', 'getDmUnreadCount', 'markDmThreadRead', 'getDmContacts',
    'blockUser', 'unblockUser', 'getBlockedUsers', 'getMutedUserIds', 'muteUser', 'unmuteUser',
    'getDmThread', 'hideDmConversation', 'sendDm', 'reactToDmMessage', 'getDmRequests',
    'acceptDmRequest', 'refuseDmRequest', 'deleteDmMessage', 'createMessageGroup', 'getGroupThread',
    'sendGroupMessage', 'markGroupThreadRead', 'deleteGroupMessage', 'addGroupMember', 'removeGroupMember',
    'deleteChatMessage',
  ],
  gifts: ['giftCatalog', 'getLiveGifts', 'sendGift'],
  donations: [
    'getDonationsConfig', 'simulateDonation', 'createDonationIntent',
    'getStripeConnectStatus', 'startStripeConnectOnboard',
  ],
  subscriptions: [
    'getSubscriptionsConfig', 'getPlatformPlan', 'getSubscriptionStatus', 'simulateSubscription',
    'createSubscriptionCheckout', 'createSubscriptionPortal',
  ],
  users: [
    'updatePrivacySettings', 'acceptLiveTerms', 'getHostRating', 'rateHost', 'searchUsers', 'globalSearch',
    'followUser', 'unfollowUser', 'getMyFollowing', 'addFavorite', 'removeFavorite',
    'getMyFavorites', 'getFavoriteStatus', 'setFavoriteNotifications', 'getCreatorStats',
    'getPushVapidPublicKey', 'subscribePush', 'unsubscribePush',
  ],
  notifications: [
    'sendHeart', 'getMatchStatus', 'getMatches', 'getNotifications', 'markNotificationsRead',
  ],
  reels: [
    'getReelsFeed', 'recordReelView', 'getUserReels', 'getUserPrivateReels', 'getMyPrivateReels',
    'getReel', 'getUserCreatedReels', 'createReel', 'deleteReel', 'publishReel', 'getReelStats',
    'toggleReelHeart', 'getReelComments', 'postReelComment', 'shareReel',
  ],
  compositions: [
    'getMyCompositions', 'createComposition', 'deleteComposition', 'toggleCompositionUpvote',
    'getMyAlbums', 'getUserAlbums', 'createAlbum', 'deleteAlbum', 'uploadTrackToAlbum',
    'uploadLooseTrack', 'getAlbumTracks',
  ],
  feed: [
    'getFeedPosts', 'createFeedPost', 'likeFeedPost', 'unlikeFeedPost', 'getFeedPostComments',
    'postFeedComment', 'reshareFeedPost', 'addFeedPostFavorite', 'removeFeedPostFavorite', 'getFavoritedFeedPosts',
  ],
  stories: ['getStories', 'getMyStory', 'createStory', 'deleteStory'],
  news: ['getFeaturedSounds', 'getWeeklyTopSongs', 'getNews', 'getTrendingUsers'],
};

const headerByFile = {
  auth: `import i18n from '../../i18n';
import { ApiRequestError, request, API_BASE as API, headers, parseApiError, normalizeFetchNetworkError } from './core';
`,
  platforms: `import i18n from '../../i18n';
import {
  readCachedPlatformStatus,
  writeCachedPlatformStatus,
  type PlatformStatusResponse,
} from '../platformStatusCache';
import { ApiRequestError, request } from './core';
`,
  lives: `import { request, API_BASE as API, headers, parseApiError, normalizeFetchNetworkError } from './core';
`,
  reels: `import { serializeFeedAlgoForApi, type ReelFeedAlgorithmPreferences } from '../reelFeedAlgorithm';
import { request } from './core';
`,
};

fs.mkdirSync(outDir, { recursive: true });

const used = new Set();
for (const [file, names] of Object.entries(domains)) {
  const chunks = [];
  for (const name of names) {
    const c = chunkFor(name);
    if (!c) {
      console.warn(`Missing: ${name} (${file})`);
      continue;
    }
    used.add(name);
    chunks.push(c);
  }
  if (!chunks.length) continue;

  let header = headerByFile[file] ?? `import { request } from './core';\n`;

  const content = `${header}
export const ${file}Api = {
${chunks.join(',\n\n')}
} as const;
`;
  fs.writeFileSync(path.join(outDir, `${file}.ts`), content);
  console.log(`${file}.ts — ${chunks.length} methods`);
}

const allNames = methods.map((x) => x.name);
const missing = allNames.filter((n) => !used.has(n));
if (missing.length) {
  console.error('Unassigned:', missing.join(', '));
  process.exit(1);
}

const files = Object.keys(domains).filter((f) => fs.existsSync(path.join(outDir, `${f}.ts`)));
const index = `${files.map((f) => `import { ${f}Api } from './${f}';`).join('\n')}

export {
  API_BASE,
  AUTH_TOKEN_HEADER,
  ApiRequestError,
  headers,
  normalizeFetchNetworkError,
  parseApiError,
  request,
} from './core';

export const api = {
${files.map((f) => `  ...${f}Api,`).join('\n')}
} as const;
`;
fs.writeFileSync(path.join(outDir, 'index.ts'), index);

fs.writeFileSync(
  srcPath,
  `export { api, ApiRequestError } from './api/index';
export {
  API_BASE,
  AUTH_TOKEN_HEADER,
  headers,
  normalizeFetchNetworkError,
  parseApiError,
  request,
} from './api/core';
`
);

console.log('Done — api.ts is now a thin re-export.');
