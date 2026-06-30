import { authApi } from './auth';
import { accessApi } from './access';
import { adminApi } from './admin';
import { sponsorsApi } from './sponsors';
import { legalApi } from './legal';
import { geoApi } from './geo';
import { musicApi } from './music';
import { salonsApi } from './salons';
import { platformsApi } from './platforms';
import { livesApi } from './lives';
import { dmApi } from './dm';
import { giftsApi } from './gifts';
import { donationsApi } from './donations';
import { subscriptionsApi } from './subscriptions';
import { usersApi } from './users';
import { notificationsApi } from './notifications';
import { reelsApi } from './reels';
import { compositionsApi } from './compositions';
import { feedApi } from './feed';
import { storiesApi } from './stories';
import { newsApi } from './news';

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
  ...authApi,
  ...accessApi,
  ...adminApi,
  ...sponsorsApi,
  ...legalApi,
  ...geoApi,
  ...musicApi,
  ...salonsApi,
  ...platformsApi,
  ...livesApi,
  ...dmApi,
  ...giftsApi,
  ...donationsApi,
  ...subscriptionsApi,
  ...usersApi,
  ...notificationsApi,
  ...reelsApi,
  ...compositionsApi,
  ...feedApi,
  ...storiesApi,
  ...newsApi,
} as const;
