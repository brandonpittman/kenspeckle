import { expect, test } from '@playwright/test';

test.describe('Dropped docs pages', () => {
	test('should return 404 for /docs/document-visible', async ({ page }) => {
		const response = await page.goto('/docs/document-visible');

		expect(response?.status()).toBe(404);
	});
});
