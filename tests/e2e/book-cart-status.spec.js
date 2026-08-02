import { expect, test } from '@playwright/test';

test('cart status stays exposed before quantity and removal feedback', async ({ page }) => {
	await page.addInitScript(() => {
		window.localStorage.setItem(
			'mari-book-cart',
			JSON.stringify({
				items: [
					{ bookId: 'le-petit-prince', quantity: 1 },
					{ bookId: 'antigone', quantity: 1 }
				]
			})
		);
	});
	await page.goto('/books/cart');

	const status = page.locator('[aria-live="polite"][aria-atomic="true"]');

	await expect(status).toBeVisible();
	await expect(status).toHaveText('');

	await page.getByRole('button', { name: 'Increase quantity for Le Petit Prince' }).click();
	await expect(status).toHaveText('Quantity for Le Petit Prince updated to 2.');

	await page.getByRole('button', { name: 'Remove Antigone' }).click();
	await expect(status).toHaveText('Antigone removed from your cart.');
});
