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

	test('opens one teacher-course card into a checklist containing only that course', async ({
		page
	}) => {
		await page.goto('/books');

		const french101Card = page.getByRole('link', {
			name: 'FRE-101 French 101'
		});
		await expect(french101Card).toHaveAttribute('href', '/books/mme-tremblay/french-101');
		await french101Card.click();

		await expect(page).toHaveURL('/books/mme-tremblay/french-101');
		await expect(page.getByRole('heading', { level: 1, name: /FRE-101 French 101/ })).toBeVisible();
		await expect(page.getByRole('checkbox', { name: 'Select Le Petit Prince' })).toBeChecked();
		await expect(page.getByRole('checkbox', { name: 'Select Bescherelle' })).toBeChecked();
		await expect(page.getByRole('checkbox', { name: 'Select Antigone' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Add 2 books to cart' })).toBeEnabled();
	});

	test('keeps cart navigation inside Book Delivery and starts with a course catalogue', async ({
		page
	}) => {
		await page.goto('/');
		await expectNoCartControls(page);

		await page.goto('/about-us');
		await expectNoCartControls(page);

		await page.goto('/books');
		await expect(page.getByRole('heading', { level: 1, name: 'Choose your course' })).toBeVisible();

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

	test('recovers a legacy teacher-only route at the course catalogue', async ({ page }) => {
		await page.goto('/books/mme-tremblay');

		await expect(page).toHaveURL('/books');
		await expect(page.getByRole('heading', { level: 1, name: 'Choose your course' })).toBeVisible();
	});

	test('keeps the server-rendered course checklist inert without JavaScript', async ({
		browser,
		baseURL
	}) => {
		const context = await browser.newContext({ javaScriptEnabled: false });

		try {
			const page = await context.newPage();
			await page.goto(`${baseURL}/books/mme-tremblay/french-101`);

			await expect(page.getByRole('region', { name: 'Books for this course' })).toHaveAttribute(
				'aria-busy',
				'true'
			);

			const petitPrince = page.getByRole('checkbox', { name: 'Select Le Petit Prince' });
			await expect(petitPrince).toBeChecked();
			await expect(petitPrince).toBeDisabled();
			await expect(
				page.getByRole('button', { name: 'Increase quantity for Le Petit Prince' })
			).toBeDisabled();
			await expect(page.getByRole('button', { name: 'Add 2 books to cart' })).toBeDisabled();

			const checkedBeforeSpace = await petitPrince.evaluate((checkbox) => checkbox.checked);
			await petitPrince.press('Space');
			expect(await petitPrince.evaluate((checkbox) => checkbox.checked)).toBe(checkedBeforeSpace);
		} finally {
			await context.close();
		}
	});

	test('adds only the still-selected books from a fresh course list by keyboard', async ({
		page
	}) => {
		await page.goto('/books/mme-tremblay/french-101');
		await expect(page.getByRole('heading', { level: 1, name: 'FRE-101 French 101' })).toBeVisible();
		await expectNoHorizontalOverflow(page);
		await expect(page.getByRole('region', { name: 'Books for this course' })).toHaveAttribute(
			'aria-busy',
			'false'
		);

		const bescherelle = page.getByRole('checkbox', { name: 'Select Bescherelle' });
		await expect(bescherelle).toBeChecked();
		await bescherelle.focus();
		await expect(bescherelle).toBeFocused();
		await page.keyboard.press('Space');
		await expect(bescherelle).not.toBeChecked();
		await expect(page.getByText('1 title selected', { exact: true })).toBeVisible();

		await page.getByRole('button', { name: 'Add 1 book to cart' }).click();

		const cartLink = page
			.getByRole('navigation', { name: 'Book Delivery navigation' })
			.getByRole('link', { name: 'Cart, 1 item' });
		await expect(cartLink).toBeVisible();
		await cartLink.click();

		await expect(page).toHaveURL('/books/cart');
		await expect(page.getByRole('heading', { level: 1, name: 'Your cart' })).toBeVisible();
		await expect(page.getByRole('heading', { level: 3, name: 'Le Petit Prince' })).toBeVisible();
		await expect(page.getByText('Bescherelle', { exact: true })).toHaveCount(0);
		await expect(page.getByText('Antigone', { exact: true })).toHaveCount(0);
		await expectNoHorizontalOverflow(page);
	});
});

test.describe('Book Delivery at a narrow width', () => {
	test.use({ viewport: { width: 390, height: 844 } });

	test('keeps the catalogue, course list, and populated cart within the viewport', async ({
		page
	}) => {
		await page.goto('/books');
		await expect(page.getByRole('heading', { level: 1, name: 'Choose your course' })).toBeVisible();
		await expect(
			page
				.getByRole('navigation', { name: 'Book Delivery navigation' })
				.getByRole('link', { name: 'Cart, 0 items' })
		).toBeVisible();
		await expectNoHorizontalOverflow(page);

		await page.getByRole('link', { name: 'FRE-101 French 101' }).click();
		await expect(page.getByRole('heading', { level: 1, name: 'FRE-101 French 101' })).toBeVisible();
		await expectNoHorizontalOverflow(page);

		await page.getByRole('button', { name: 'Add 2 books to cart' }).click();
		await page
			.getByRole('navigation', { name: 'Book Delivery navigation' })
			.getByRole('link', { name: 'Cart, 2 items' })
			.click();

		await expect(page).toHaveURL('/books/cart');
		await expect(page.getByRole('heading', { level: 1, name: 'Your cart' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Renaud-Bray' })).toBeVisible();
		await expect(page.getByRole('complementary', { name: 'Order summary' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Continue to order review' })).toBeVisible();
		await expectNoHorizontalOverflow(page);
	});
});
