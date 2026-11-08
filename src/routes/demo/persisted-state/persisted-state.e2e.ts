import { expect, test, type Page } from '@playwright/test';

async function open(page: Page) {
	await page.goto('/demo/persisted-state');
	await expect(page.locator(':root')).toHaveAttribute('hydrated');
}

test.describe('PersistedState demo', () => {
	test('should keep the value across a reload', async ({ page }) => {
		await open(page);
		await page.getByRole('button', { name: 'Increment' }).click();
		await expect(page.getByRole('status')).toHaveText('Count: 1');

		await page.reload();
		await expect(page.locator(':root')).toHaveAttribute('hydrated');

		await expect(page.getByRole('status')).toHaveText('Count: 1');
	});

	test('should show a change on a second page in the same context', async ({ context, page }) => {
		const second = await context.newPage();
		await open(page);
		await open(second);
		await expect(second.getByRole('status')).toHaveText('Count: 0');

		await page.getByRole('button', { name: 'Increment' }).click();

		await expect(second.getByRole('status')).toHaveText('Count: 1');
	});
});
