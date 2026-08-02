import { expect, test } from '@playwright/test';

async function expectNoCartControls(page) {
	await expect(page.getByRole('link', { name: /cart/i })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /cart/i })).toHaveCount(0);
	await expect(page.locator('a[href="/books/cart"], [aria-label*="cart" i]')).toHaveCount(0);
}

async function expectNoHorizontalOverflow(page) {
	const dimensions = await page.evaluate(() => ({
		viewportWidth: document.documentElement.clientWidth,
		documentWidth: document.documentElement.scrollWidth,
		bodyWidth: document.body.scrollWidth
	}));

	expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
	expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
}

test.describe('Book Delivery cart boundary', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('keeps cart navigation inside Book Delivery and starts with a teacher-first catalogue', async ({
		page
	}) => {
		await page.goto('/');
		await expectNoCartControls(page);

		await page.goto('/about-us');
		await expectNoCartControls(page);

		await page.goto('/books');
		await expect(
			page.getByRole('heading', { level: 1, name: 'Start with your teacher' })
		).toBeVisible();

		const bookDeliveryNavigation = page.getByRole('navigation', {
			name: 'Book Delivery navigation'
		});
		const cartLink = bookDeliveryNavigation.getByRole('link', { name: 'Cart, 0 items' });

		await expect(bookDeliveryNavigation).toHaveCount(1);
		await expect(cartLink).toHaveCount(1);
		await expect(cartLink).toHaveAttribute('href', '/books/cart');
		await expect(page.locator('a[href="/books/cart"]')).toHaveCount(1);
		await expectNoHorizontalOverflow(page);
	});

	test('adds only the still-selected books from a fresh teacher list by keyboard', async ({
		page
	}) => {
		await page.goto('/books/mme-tremblay');
		await expect(
			page.getByRole('heading', { level: 1, name: 'Books for Mme Tremblay' })
		).toBeVisible();
		await expectNoHorizontalOverflow(page);
		await expect(page.getByRole('region', { name: 'Course book checklist' })).toHaveAttribute(
			'aria-busy',
			'false'
		);

		const antigone = page.getByRole('checkbox', { name: 'Select Antigone' });
		await expect(antigone).toBeChecked();
		await antigone.focus();
		await expect(antigone).toBeFocused();
		await page.keyboard.press('Space');
		await expect(antigone).not.toBeChecked();
		await expect(page.getByText('2 titles selected', { exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Add 2 books to cart' }).click();

		const cartLink = page
			.getByRole('navigation', { name: 'Book Delivery navigation' })
			.getByRole('link', { name: 'Cart, 2 items' });
		await expect(cartLink).toBeVisible();
		await cartLink.click();

		await expect(page).toHaveURL('/books/cart');
		await expect(
			page.getByRole('heading', { level: 1, name: 'Your book delivery cart' })
		).toBeVisible();
		await expect(page.getByRole('heading', { level: 3, name: 'Le Petit Prince' })).toBeVisible();
		await expect(page.getByRole('heading', { level: 3, name: 'Bescherelle' })).toBeVisible();
		await expect(page.getByText('Antigone', { exact: true })).toHaveCount(0);
		await expectNoHorizontalOverflow(page);
	});
});

test.describe('Book Delivery at a narrow width', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('keeps the catalogue, teacher list, and populated cart within the viewport', async ({
		page
	}) => {
		await page.goto('/books');
		await expect(
			page.getByRole('heading', { level: 1, name: 'Start with your teacher' })
		).toBeVisible();
		await expect(
			page
				.getByRole('navigation', { name: 'Book Delivery navigation' })
				.getByRole('link', { name: 'Cart, 0 items' })
		).toBeVisible();
		await expectNoHorizontalOverflow(page);

		await page
			.getByRole('link', { name: /Mme Tremblay[\s\S]*French 101[\s\S]*French 102/i })
			.click();
		await expect(
			page.getByRole('heading', { level: 1, name: 'Books for Mme Tremblay' })
		).toBeVisible();
		await expectNoHorizontalOverflow(page);

		await page.getByRole('button', { name: 'Add 3 books to cart' }).click();
		await page
			.getByRole('navigation', { name: 'Book Delivery navigation' })
			.getByRole('link', { name: 'Cart, 3 items' })
			.click();

		await expect(page).toHaveURL('/books/cart');
		await expect(
			page.getByRole('heading', { level: 1, name: 'Your book delivery cart' })
		).toBeVisible();
		await expect(page.getByRole('region', { name: 'Renaud-Bray' })).toBeVisible();
		await expect(page.getByRole('complementary', { name: 'Order summary' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Continue to order review' })).toBeVisible();
		await expectNoHorizontalOverflow(page);
	});
});
