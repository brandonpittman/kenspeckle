import { expect, test } from '@playwright/test';

// The unit suite drives a fake `start`; nothing else runs this package against a real
// document.startViewTransition. Both naming forms are exercised here — imperative on /a, attachment
// on /b — because the imperative one has no consumer in any app.
const named = (page: import('@playwright/test').Page) =>
	page.locator('.hero').evaluate((el: HTMLElement) => el.style.viewTransitionName);

test('names an element only while a navigation transition runs', async ({ page }) => {
	// The library bails out entirely under reduced motion, so pin the query.
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.goto('/demo/transition/a');
	await expect(page.locator('.hero')).toBeVisible();

	expect(await named(page)).toBe('');

	await page.getByRole('link', { name: 'to b' }).click();
	await expect(page.locator('h1')).toHaveText('B');

	// Captured inside onStart, after the claim and before the old snapshot.
	expect(await page.evaluate(() => window.__vtStart)).toBe('hero');
	expect(await page.evaluate(() => window.__vtAttr)).toBe('forward');

	await expect.poll(() => page.evaluate(() => window.__vtSettle)).toBeDefined();
	expect(await page.evaluate(() => window.__vtSettleAttr)).toBe('(absent)');
	expect(await named(page)).toBe('');
});

test('reverses direction on a browser back', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.goto('/demo/transition/a');
	await page.getByRole('link', { name: 'to b' }).click();
	await expect(page.locator('h1')).toHaveText('B');

	await page.goBack();
	await expect(page.locator('h1')).toHaveText('A');

	expect(await page.evaluate(() => window.__vtAttr)).toBe('retreat');
});
