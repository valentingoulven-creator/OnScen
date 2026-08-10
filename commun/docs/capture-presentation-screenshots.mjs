/**
 * Capture mobile screenshots for OnScen presentations.
 * Compte prod showcase : demo-test@getsoundy.com (CAPTURE_LOGIN_PASSWORD requis).
 *
 * Usage :
 *   $env:CAPTURE_LOGIN_PASSWORD='…'
 *   node commun/docs/capture-presentation-screenshots.mjs
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../web/app/node_modules/@playwright/test/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'presentation-screenshots');
const mobileDir = path.join(outDir, 'mobile');

const BASE = process.env.CAPTURE_BASE_URL ?? process.env.E2E_BASE_URL ?? 'https://getsoundy.com';
const VIEWPORT = { width: 390, height: 844 };
const LOGIN_EMAIL = process.env.CAPTURE_LOGIN_EMAIL ?? 'demo-test@getsoundy.com';
const LOGIN_PASSWORD = process.env.CAPTURE_LOGIN_PASSWORD ?? '';

/** Montpellier — cadrage présentation locale */
const MONTPELLIER = { latitude: 43.6108, longitude: 3.8767 };

const INIT_STORAGE = `
  localStorage.setItem('soundy_cookie_consent_v1', 'all');
  sessionStorage.setItem('soundy_platform_prompt_dismissed', '1');
  sessionStorage.removeItem('soundy_disable_globe');
  localStorage.setItem('soundy_map_style', 'flat');
`;

const HIDE_CLUTTER_CSS = `
  div.rounded-xl.border-purple-500\\/30.bg-purple-500\\/10:has(p) { display: none !important; }
`;

async function dismissCookieBanner(page) {
  const acceptAll = page.getByRole('button', { name: /tout accepter/i });
  const essential = page.getByRole('button', { name: /essentiels uniquement/i });
  if (await acceptAll.count()) {
    await acceptAll.first().click({ timeout: 5000 }).catch(() => {});
  } else if (await essential.count()) {
    await essential.first().click({ timeout: 5000 }).catch(() => {});
  }
  await page.waitForTimeout(400);
}

async function hideYoutubePrompt(page) {
  const dismissBtn = page.getByRole('button', { name: 'Masquer' });
  if (await dismissBtn.count()) {
    await dismissBtn.first().click({ timeout: 2000 }).catch(() => {});
  }
  await page.evaluate(() => {
    sessionStorage.setItem('soundy_platform_prompt_dismissed', '1');
    for (const el of document.querySelectorAll('.rounded-xl')) {
      const t = el.textContent ?? '';
      if (t.includes('Connecte YouTube') || t.includes('YouTube est requis')) {
        el.remove();
      }
    }
  });
}

async function prepareScreenshot(page) {
  await hideYoutubePrompt(page);
  await page.waitForTimeout(600);
}

async function login(page) {
  const response = await page.request.post(`${BASE}/api/auth/login`, {
    data: { email: LOGIN_EMAIL, password: LOGIN_PASSWORD },
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Login échoué (${response.status()}) : ${body.slice(0, 200)}`);
  }

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 90_000 });
  await dismissCookieBanner(page);
  await page.waitForSelector('[data-tab="map"]', { timeout: 45_000 });
  await page.waitForTimeout(2500);
  await hideYoutubePrompt(page);
}

async function closeOverlays(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const closeBtn = page.getByRole('button', { name: /fermer|close|retour/i }).first();
  if (await closeBtn.count()) await closeBtn.click({ timeout: 2000 }).catch(() => {});
  await page.waitForTimeout(600);
}

async function goToMap(page) {
  await closeOverlays(page);
  if ((await page.locator('[data-tab="map"]').getAttribute('aria-current')) !== 'page') {
    await page.locator('[data-tab="map"]').click();
    await page.waitForTimeout(2800);
  }
  await recenterOnUser(page);
  await prepareScreenshot(page);
}

async function recenterOnUser(page) {
  const btn = page.locator('.ms-map-recenter-fab button').first();
  if (await btn.count()) await btn.click();
  await page.waitForTimeout(2800);
}

async function zoomInMap(page, times = 10) {
  const zoomIn = page.getByRole('button', { name: 'Zoom avant' });
  for (let i = 0; i < times; i++) {
    if (await zoomIn.count()) await zoomIn.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(280);
  }
  await page.waitForTimeout(1800);
}

async function ensureFlatMap(page) {
  const flatBtn = page.getByRole('button', { name: 'Vue carte sombre' });
  if (await flatBtn.count()) await flatBtn.click();
  await page.waitForTimeout(2200);
}

async function ensureGlobeMap(page) {
  await page.evaluate(() => {
    sessionStorage.removeItem('soundy_disable_globe');
  });

  const flatBtn = page.getByRole('button', { name: 'Vue carte sombre' });
  const globeBtn = page.getByRole('button', { name: 'Vue globe satellite' });

  if (await flatBtn.count()) {
    /* Déjà en vue globe */
    await page.waitForTimeout(2000);
  } else if (await globeBtn.count()) {
    await globeBtn.click();
    await page.waitForTimeout(6000);
  } else {
    await page.locator('.ms-map-globe-row button').filter({ hasText: '🌐' }).click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(6000);
  }

  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2000);
}

async function activateSingleMapFilter(page, label) {
  for (const name of ['Lives', 'Salon', 'Évènement']) {
    const btn = page.locator('.ms-map-filter-stack button').filter({ hasText: name }).first();
    if (!(await btn.count())) continue;
    const pressed = await btn.getAttribute('aria-pressed');
    if (name === label) {
      if (pressed !== 'true') await btn.click();
    } else if (pressed === 'true') {
      await btn.click();
    }
  }
  await page.waitForTimeout(2200);
}

async function openEventsBrowse(page) {
  await activateSingleMapFilter(page, 'Évènement');
  const browseBtn = page.locator('.ms-map-globe-row button').first();
  if (await browseBtn.count()) await browseBtn.click();
  await page.waitForTimeout(2500);
}

const CAPTURES = [
  {
    name: '01-actualite.png',
    setup: async (page) => {
      await page.locator('[data-tab="actualite"]').click();
      await page.waitForTimeout(3500);
      await prepareScreenshot(page);
    },
  },
  {
    name: '10-carte-grise.png',
    setup: async (page) => {
      await goToMap(page);
      await ensureFlatMap(page);
      await activateSingleMapFilter(page, 'Évènement');
      await zoomInMap(page, 6);
      await recenterOnUser(page);
      await prepareScreenshot(page);
    },
  },
  {
    name: '15-evenements-dates.png',
    setup: async (page) => {
      await goToMap(page);
      await ensureFlatMap(page);
      await openEventsBrowse(page);
      await prepareScreenshot(page);
    },
  },
  {
    name: '11-globe-3d.png',
    setup: async (page) => {
      await goToMap(page);
      await ensureGlobeMap(page);
      await activateSingleMapFilter(page, 'Lives');
      await zoomInMap(page, 8);
      await recenterOnUser(page);
      await page.waitForTimeout(2500);
      await prepareScreenshot(page);
    },
  },
  {
    name: '12-reels.png',
    setup: async (page) => {
      await page.locator('[data-tab="reels"]').click();
      await page.waitForTimeout(2000);
      await page.locator('video, .ms-reels-slide img, [data-reel-id] img').first()
        .waitFor({ state: 'visible', timeout: 12_000 })
        .catch(() => {});
      await page.waitForTimeout(2500);
      await prepareScreenshot(page);
    },
  },
  {
    name: '13-musique.png',
    setup: async (page) => {
      await page.locator('[data-tab="music"]').click();
      await page.waitForTimeout(3000);
      await prepareScreenshot(page);
    },
  },
];

async function main() {
  if (!LOGIN_PASSWORD) {
    throw new Error(
      'CAPTURE_LOGIN_PASSWORD requis (compte prod : demo-test@getsoundy.com — voir seed_demo_showcase.js)',
    );
  }

  await mkdir(outDir, { recursive: true });
  await mkdir(mobileDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
    ],
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    locale: 'fr-FR',
    geolocation: MONTPELLIER,
    permissions: ['geolocation'],
  });
  await context.addInitScript(INIT_STORAGE);
  const page = await context.newPage();
  await page.addStyleTag({ content: HIDE_CLUTTER_CSS });

  try {
    await login(page);

    for (const cap of CAPTURES) {
      await cap.setup(page);
      const desktopPath = path.join(outDir, cap.name);
      const mobilePath = path.join(mobileDir, cap.name);
      await page.screenshot({ path: desktopPath, fullPage: false });
      await page.screenshot({ path: mobilePath, fullPage: false });
      console.log(`✓ ${cap.name}`);
    }
  } finally {
    await browser.close();
  }

  console.log(`Done — ${CAPTURES.length} captures (${BASE}, ${LOGIN_EMAIL}, Montpellier) → ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
