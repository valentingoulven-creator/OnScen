import { test, expect } from '@playwright/test';

const STAGING = process.env.E2E_BASE_URL ?? 'https://staging.getsoundy.com';
const API = process.env.E2E_API_URL ?? STAGING;

test.describe('Staging smoke — infra', () => {
  test('health OK preproduction', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { status?: string; env?: string; db?: string };
    expect(body.status).toBe('OK');
    expect(body.env).toBe('preproduction');
    expect(body.db).toBe('ok');
  });

  test('index.html référence des assets servis (200)', async ({ request }) => {
    const html = await (await request.get(`${STAGING}/`)).text();
    const assets = [...html.matchAll(/\/assets\/[A-Za-z0-9_.-]+\.(js|css)/g)].map((m) => m[0]);
    expect(assets.length).toBeGreaterThan(0);
    for (const asset of [...new Set(assets)]) {
      const res = await request.get(`${STAGING}${asset}`);
      expect(res.status(), asset).toBe(200);
    }
  });

  test('routes API protégées renvoient 401 (pas 500)', async ({ request }) => {
    for (const path of ['/api/search?q=test', '/api/feed', '/api/geo/nearby?lat=48.85&lng=2.35']) {
      const res = await request.get(`${API}${path}`);
      expect(res.status(), path).toBe(401);
    }
  });
});

test.describe('Staging smoke — pages publiques', () => {
  test('page auth sans erreur console critique', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/auth');
    await expect(page.locator('body')).toBeVisible();
    const critical = errors.filter((e) => !e.includes('ResizeObserver'));
    expect(critical).toEqual([]);
  });

  test('shell app charge (boot loader puis root)', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.waitForTimeout(4000);
    const root = page.locator('#root');
    await expect(root).toBeVisible();
    const critical = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('Loading chunk')
    );
    expect(critical).toEqual([]);
  });

  test('mobile 390px — pas de scroll horizontal sur auth', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/auth');
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return doc.scrollWidth > doc.clientWidth + 2;
    });
    expect(overflow).toBe(false);
  });
});

test.describe('Staging smoke — bundle map/events', () => {
  test('HomePage chunk actif contient MapEventPreviewCard', async ({ request }) => {
    const html = await (await request.get(`${STAGING}/`)).text();
    const indexMatch = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
    expect(indexMatch).toBeTruthy();
    const indexJs = await (await request.get(`${STAGING}${indexMatch![0]}`)).text();
    const homeHash = indexJs.match(/HomePage-[A-Za-z0-9_-]+/)?.[0];
    expect(homeHash, 'HomePage lazy chunk hash in index bundle').toBeTruthy();
    const homeRes = await request.get(`${STAGING}/assets/${homeHash}.js`);
    expect(homeRes.status()).toBe(200);
    const homeJs = await homeRes.text();
    expect(homeJs).toContain('eventPreviewAria');
    expect(homeJs).toMatch(/vendor-map-[A-Za-z0-9_-]+/);
  });

  test('vendor-map lazy chunk servi (200)', async ({ request }) => {
    const html = await (await request.get(`${STAGING}/`)).text();
    const indexMatch = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/);
    expect(indexMatch).toBeTruthy();
    const indexJs = await (await request.get(`${STAGING}${indexMatch![0]}`)).text();
    const homeHash = indexJs.match(/HomePage-[A-Za-z0-9_-]+/)?.[0];
    expect(homeHash).toBeTruthy();
    const homeJs = await (await request.get(`${STAGING}/assets/${homeHash}.js`)).text();
    const mapHash = homeJs.match(/vendor-map-[A-Za-z0-9_-]+/)?.[0];
    expect(mapHash, 'vendor-map hash in HomePage bundle').toBeTruthy();
    expect((await request.get(`${STAGING}/assets/${mapHash}.js`)).status()).toBe(200);
  });
});

const STAGING_EMAIL = process.env.E2E_STAGING_EMAIL ?? 'admin@staging.getsoundy.com';
const STAGING_PASSWORD = process.env.E2E_STAGING_PASSWORD ?? '';

async function loginStaging(request: import('@playwright/test').APIRequestContext) {
  const res = await request.post(`${API}/api/auth/login`, {
    data: { email: STAGING_EMAIL, password: STAGING_PASSWORD, rememberMe: true },
  });
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { token?: string; user?: { username?: string } };
  expect(body.token).toBeTruthy();
  expect(body.user?.username).toBeTruthy();
  return body;
}

async function prepareMapTab(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem('soundy_cookie_consent_v1', 'essential');
    sessionStorage.setItem('soundy_platform_prompt_dismissed', '1');
  });
  const loginRes = await page.request.post(`${API}/api/auth/login`, {
    data: { email: STAGING_EMAIL, password: STAGING_PASSWORD, rememberMe: true },
  });
  expect(loginRes.status()).toBe(200);
  await page.goto('/');
  await page.waitForFunction(() => !document.getElementById('melosong-boot'), null, { timeout: 30_000 });
  await page.locator('[data-tab=map]').click();
  await expect(page.locator('.ms-map-globe-search, .leaflet-container, canvas').first()).toBeVisible({
    timeout: 20_000,
  });
}

test.describe('Staging smoke — session authentifiée', () => {
  test.beforeEach(() => {
    test.skip(!STAGING_PASSWORD, 'E2E_STAGING_PASSWORD requis pour les tests authentifiés');
  });

  test('login API + recherche globale', async ({ request }) => {
    await loginStaging(request);
    const search = await request.get(`${API}/api/search?q=admin`);
    expect(search.status()).toBe(200);
    const payload = (await search.json()) as { users?: unknown[]; events?: unknown[] };
    expect(payload).toBeTruthy();
  });

  test('feed et geo nearby répondent 200', async ({ request }) => {
    await loginStaging(request);
    expect((await request.get(`${API}/api/feed?limit=5`)).status()).toBe(200);
    const geo = await request.get(`${API}/api/geo/nearby?lat=48.8566&lng=2.3522&radiusKm=50`);
    expect(geo.status()).toBe(200);
    const body = (await geo.json()) as { salons?: unknown[]; lives?: unknown[]; people?: unknown[] };
    expect(Array.isArray(body.salons)).toBe(true);
    expect(Array.isArray(body.lives)).toBe(true);
  });

  test('session connectée → onglet Carte visible', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await prepareMapTab(page);
    const critical = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('Loading chunk')
    );
    expect(critical).toEqual([]);
  });

  test('recherche événement sur la carte (390px, pas overflow)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepareMapTab(page);
    const searchInput = page.locator('.ms-map-globe-search__input');
    if (!(await searchInput.isVisible().catch(() => false))) {
      await page.locator('.ms-map-globe-search__toggle').click();
    }
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.fill('paris');
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    expect(overflow).toBe(false);
  });
});
