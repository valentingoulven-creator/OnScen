import { test, expect } from '@playwright/test';

test.describe('Smoke — pages publiques', () => {
  test('health API répond (si backend dev actif)', async ({ request }) => {
    const apiBase = process.env.E2E_API_URL ?? 'http://localhost:4080';
    const res = await request.get(`${apiBase}/health`);
    if (res.status() === 503) {
      test.skip(true, 'Backend indisponible — lancer npm run dev');
    }
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { status?: string };
    expect(body.status).toBeTruthy();
  });

  test('page auth charge sans erreur console critique', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/auth');
    await expect(page.locator('body')).toBeVisible();
    const critical = errors.filter((e) => !e.includes('ResizeObserver'));
    expect(critical).toHaveLength(0);
  });
});
