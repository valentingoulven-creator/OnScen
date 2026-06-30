/** Apptel : API partagée avec app/ ; seul core.ts est surchargé (API_BASE natif). */
export { api, ApiRequestError } from '../../../../web/app/src/lib/api/index';
export {
  API_BASE,
  AUTH_TOKEN_HEADER,
  headers,
  normalizeFetchNetworkError,
  parseApiError,
  request,
} from './api/core';
