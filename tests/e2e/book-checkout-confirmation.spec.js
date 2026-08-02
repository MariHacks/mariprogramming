import { expect, test } from '@playwright/test';

const CART_STORAGE_KEY = 'mari-book-cart';
const POPULATED_CART = [
	{ bookId: 'le-petit-prince', quantity: 2 },
	{ bookId: 'antigone', quantity: 1 }
];

/** @param {import('@playwright/test').Page} page */
async function seedBookCart(page) {
	await page.addInitScript(
		({ storageKey, items }) => {
			window.localStorage.setItem(storageKey, JSON.stringify({ items }));
		},
		{ storageKey: CART_STORAGE_KEY, items: POPULATED_CART }
	);
}

/** @param {import('@playwright/test').Page} page */
async function blockThirdPartyMap(page) {
	await page.route(/https:\/\/www\.google\.com\/maps/u, (route) => route.abort());
}

/** @param {import('@playwright/test').Page} page */
async function fillGuestDetails(page) {
	await page.getByRole('textbox', { name: 'Name for pickup' }).fill('  Maya   Chen  ');
	await page
		.getByRole('textbox', { name: 'Email for receipt' })
		.fill('  MAYA.CHEN@MARIANOPOLIS.EDU  ');
}

/** @param {import('@playwright/test').Page} page */
async function expectNoHorizontalOverflow(page) {
	const dimensions = await page.evaluate(() => ({
		viewportWidth: document.documentElement.clientWidth,
		documentWidth: document.documentElement.scrollWidth,
		bodyWidth: document.body.scrollWidth
	}));

	expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
	expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
}

/** @param {import('@playwright/test').Page} page */
async function expectNoBookDeliveryCart(page) {
	await expect(page.getByRole('navigation', { name: 'Book Delivery navigation' })).toHaveCount(0);
	await expect(page.locator('a[href="/books/cart"]')).toHaveCount(0);
	await expect(page.getByRole('link', { name: /cart/i })).toHaveCount(0);
}

/** @param {import('@playwright/test').Page} page */
async function expectNoPickupContext(page) {
	await expect(page.getByRole('region', { name: 'Pickup location' })).toHaveCount(0);
	await expect(page.getByText("Wayne's Front Desk", { exact: true })).toHaveCount(0);
}

test.describe('Book Delivery guest order review', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('keeps invalid guest details local until required contact fields are complete', async ({
		page
	}) => {
		await seedBookCart(page);
		await blockThirdPartyMap(page);

		let checkoutRequests = 0;
		page.on('request', (request) => {
			if (request.url().endsWith('/api/book-checkout') && request.method() === 'POST') {
				checkoutRequests += 1;
			}
		});

		await page.goto('/books/checkout');
		await expect(page.getByRole('heading', { level: 1, name: 'Order review' })).toBeVisible();

		const nameInput = page.getByRole('textbox', { name: 'Name for pickup' });
		const emailInput = page.getByRole('textbox', { name: 'Email for receipt' });
		await page.getByRole('button', { name: 'Continue to secure payment' }).click();

		const validationStatus = page
			.getByRole('status')
			.filter({ hasText: 'Enter the name for pickup.' });
		await expect(validationStatus).toBeVisible();
		await expect(validationStatus).toHaveAttribute('aria-live', 'polite');
		await expect(nameInput).toBeFocused();
		await expect(nameInput).toHaveAttribute('aria-invalid', 'true');
		await expect(emailInput).toHaveAttribute('aria-invalid', 'true');
		expect(checkoutRequests).toBe(0);
	});

	test('sends only trusted guest payload fields and leaves unavailable checkout retryable', async ({
		page
	}) => {
		await seedBookCart(page);
		await blockThirdPartyMap(page);

		let checkoutRequests = 0;
		await page.route('**/api/book-checkout', async (route) => {
			checkoutRequests += 1;
			await route.fulfill({
				status: 503,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'Checkout unavailable' })
			});
		});

		await page.goto('/books/checkout');
		await expect(page.getByRole('heading', { level: 1, name: 'Order review' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Pickup location' })).toBeVisible();
		await expect(page.getByRole('button', { name: /card|e-transfer/i })).toHaveCount(0);
		await expect(page.getByRole('textbox', { name: /card number|cvv|expiry/i })).toHaveCount(0);
		await expect(page.getByText(/e-transfer/i)).toHaveCount(0);

		await fillGuestDetails(page);
		const firstRequest = page.waitForRequest(
			(request) => request.url().endsWith('/api/book-checkout') && request.method() === 'POST'
		);
		await page.getByRole('button', { name: 'Continue to secure payment' }).click();

		const request = await firstRequest;
		expect(request.headers()['content-type']).toContain('application/json');
		expect(JSON.parse(request.postData() ?? '')).toEqual({
			items: POPULATED_CART,
			name: 'Maya Chen',
			email: 'maya.chen@marianopolis.edu'
		});

		const retryStatus = page
			.getByRole('status')
			.filter({ hasText: 'We could not open secure payment. Please try again.' });
		await expect(retryStatus).toBeVisible();
		await expect(retryStatus).toHaveAttribute('aria-live', 'polite');
		await expect(page).toHaveURL(/\/books\/checkout$/);
		await expect(page.getByRole('heading', { name: 'Payment confirmed' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Continue to secure payment' })).toBeEnabled();

		const retryRequest = page.waitForRequest(
			(request) => request.url().endsWith('/api/book-checkout') && request.method() === 'POST'
		);
		await page.getByRole('button', { name: 'Continue to secure payment' }).click();
		await retryRequest;
		expect(checkoutRequests).toBe(2);
		await expect(retryStatus).toBeVisible();
	});

	test('recovers an empty checkout and keeps cart navigation out of club routes', async ({
		page
	}) => {
		await page.goto('/books/checkout');

		await expect(page.getByRole('heading', { level: 1, name: 'Your cart is empty' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Return to cart' })).toHaveAttribute(
			'href',
			'/books/cart'
		);
		await expect(page.getByRole('form', { name: 'Guest details' })).toHaveCount(0);
		await expectNoPickupContext(page);

		await page.goto('/about-us');
		await expectNoBookDeliveryCart(page);
		await expectNoPickupContext(page);
	});

	test('shows pickup context only within a populated Book Delivery order review', async ({
		page
	}) => {
		await blockThirdPartyMap(page);

		for (const path of ['/books', '/books/mme-tremblay', '/about-us']) {
			await page.goto(path);
			await expectNoPickupContext(page);
		}

		await seedBookCart(page);
		await page.goto('/books/checkout');
		await expect(page.getByRole('region', { name: 'Pickup location' })).toBeVisible();
		await expect(page.getByText("Wayne's Front Desk", { exact: true }).last()).toBeVisible();
	});
});

for (const confirmationCase of [
	{ label: 'missing', path: '/books/order-confirmation' },
	{
		label: 'malformed',
		path: '/books/order-confirmation?session_id=not-a-checkout-session'
	}
]) {
	test(`keeps a ${confirmationCase.label} confirmation link in recovery`, async ({ page }) => {
		await seedBookCart(page);
		await page.goto(confirmationCase.path);

		await expect(
			page.getByRole('heading', { level: 1, name: 'Payment not confirmed' })
		).toBeVisible();
		await expect(page.getByRole('status')).toHaveText('Payment not confirmed');
		await expect(page.getByText('Payment confirmed', { exact: true })).toHaveCount(0);
		await expectNoPickupContext(page);

		await page.getByRole('link', { name: 'Return to your cart' }).click();
		await expect(page).toHaveURL('/books/cart');
		await expect(
			page.getByRole('heading', { level: 1, name: 'Your book delivery cart' })
		).toBeVisible();
		await expect(page.getByRole('heading', { level: 3, name: 'Le Petit Prince' })).toBeVisible();
	});
}

for (const viewportCase of [
	{ label: 'desktop 1440px', viewport: { width: 1440, height: 900 } },
	{ label: 'mobile 390px', viewport: { width: 390, height: 844 } }
]) {
	test(`${viewportCase.label} keeps populated order review and recovery confirmation within the viewport`, async ({
		page
	}) => {
		await page.setViewportSize(viewportCase.viewport);
		await seedBookCart(page);
		await blockThirdPartyMap(page);

		await page.goto('/books/checkout');
		await expect(page.getByRole('heading', { level: 1, name: 'Order review' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Pickup location' })).toBeVisible();
		await expectNoHorizontalOverflow(page);

		await page.goto('/books/order-confirmation?session_id=not-a-checkout-session');
		await expect(
			page.getByRole('heading', { level: 1, name: 'Payment not confirmed' })
		).toBeVisible();
		await expectNoPickupContext(page);
		await expectNoHorizontalOverflow(page);
	});
}
