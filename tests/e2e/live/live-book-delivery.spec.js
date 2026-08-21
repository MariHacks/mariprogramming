import { expect, test } from '@playwright/test';
import { Client } from 'pg';

const APP_ORIGIN = process.env.LIVE_E2E_BASE_URL;
const CHECKOUT_HOST = 'checkout.mariprogramming.dev';

if (!/^http:\/\/127\.0\.0\.1:\d{1,5}$/u.test(APP_ORIGIN ?? '')) {
	throw new Error('The live browser suite requires a loopback application origin');
}

async function checkoutDatabaseState() {
	const client = new Client({ connectionString: process.env.DATABASE_URL });
	await client.connect();
	try {
		return (
			await client.query(`SELECT
				(SELECT count(*)::int FROM rate_limit_buckets) AS rate_buckets,
				(SELECT count(*)::int FROM orders) AS orders,
				(SELECT count(*)::int FROM checkout_attempts) AS attempts,
				(SELECT string_agg(status, ',' ORDER BY status) FROM checkout_attempts) AS statuses`)
		).rows[0];
	} finally {
		await client.end();
	}
}

test('persists a live guest checkout and exposes it only through an authenticated staff route', async ({
	context,
	page
}) => {
	const blockedOutboundRequests = [];
	await context.route('**/*', async (route) => {
		const requestUrl = new URL(route.request().url());
		if (requestUrl.origin === APP_ORIGIN) {
			await route.continue();
			return;
		}
		if (requestUrl.hostname === CHECKOUT_HOST) {
			await route.fulfill({
				status: 200,
				contentType: 'text/html; charset=utf-8',
				body: '<!doctype html><html><body><h1>Local Stripe handoff</h1></body></html>'
			});
			return;
		}
		blockedOutboundRequests.push(requestUrl.href);
		await route.abort('blockedbyclient');
	});

	await page.goto('/books');
	await expect(page.getByRole('heading', { level: 1, name: 'Choose your course' })).toBeVisible();
	const course = page.getByRole('link', { name: /CSC 205 Data Structures/u });
	await expect(course).toContainText('Prof. Ada Lovelace');
	await course.click();

	await expect(page).toHaveURL('/books/prof-ada-lovelace/20000000-0000-4000-8000-000000000001');
	await expect(
		page.getByRole('checkbox', { name: 'Select Data Structures and Algorithm Analysis' })
	).toBeChecked();
	const cleanCode = page.getByRole('checkbox', { name: 'Select Clean Code' });
	await cleanCode.uncheck();
	await page.getByRole('button', { name: 'Add to cart' }).click();
	await page.getByRole('link', { name: 'Go to cart' }).click();

	await expect(page.getByRole('heading', { level: 1, name: 'Your cart' })).toBeVisible();
	await expect(
		page.getByRole('heading', { level: 3, name: 'Data Structures and Algorithm Analysis' })
	).toBeVisible();
	await expect(page.getByText('Clean Code', { exact: true })).toHaveCount(0);
	await page.getByRole('link', { name: 'Continue to order review' }).click();

	await expect(page.getByRole('heading', { level: 1, name: 'Order review' })).toBeVisible();
	await page.getByRole('textbox', { name: 'Name for pickup' }).fill('Live Student');
	await page.getByRole('textbox', { name: 'Email for receipt' }).fill('live.student@example.com');
	const checkoutResponse = page.waitForResponse(
		(response) => response.url() === `${APP_ORIGIN}/api/book-checkout`
	);
	await page.getByRole('button', { name: 'Continue to secure payment' }).click();
	const response = await checkoutResponse;
	if (response.status() !== 200) {
		await context.addCookies([
			{
				name: 'mari-staff.session_token',
				value: 'live-e2e-authorized',
				url: APP_ORIGIN,
				httpOnly: true,
				sameSite: 'Lax'
			}
		]);
		const cookies = await context.cookies(APP_ORIGIN);
		const databaseState = await checkoutDatabaseState();
		await page.goto(`${APP_ORIGIN}/staff?payment=all&fulfillment=all&page=1`);
		throw new Error(
			`Checkout returned ${response.status()}; database state: ${JSON.stringify(databaseState)}; cookie names: ${cookies.map(({ name }) => name).join(',')}; protected ledger state: ${await page.locator('body').innerText()}`
		);
	}
	expect(response.status()).toBe(200);
	await expect(page).toHaveURL(
		/^https:\/\/checkout\.mariprogramming\.dev\/session\/cs_test_[a-f0-9]{32}$/u
	);
	await expect(page.getByRole('heading', { name: 'Local Stripe handoff' })).toBeVisible();
	expect(await checkoutDatabaseState()).toEqual({
		rate_buckets: 2,
		orders: 1,
		attempts: 1,
		statuses: 'ready'
	});

	await page.goto(`${APP_ORIGIN}/staff?payment=all&fulfillment=all&page=1`);
	await expect(page).toHaveURL(`${APP_ORIGIN}/staff/sign-in?state=reauthenticate`);
	await expect(page.getByRole('heading', { level: 1, name: 'Staff access' })).toBeVisible();

	await context.addCookies([
		{
			name: 'mari-staff.session_token',
			value: 'live-e2e-authorized',
			url: APP_ORIGIN,
			httpOnly: true,
			sameSite: 'Lax'
		}
	]);
	await page.goto(`${APP_ORIGIN}/staff?payment=all&fulfillment=all&page=1`);
	await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
	await expect(page.getByText('1 order', { exact: true })).toBeVisible();
	await expect(page.getByText('l**********t@example.com', { exact: true })).toBeVisible();
	await expect(
		page.getByLabel('Actionable queue').getByText('Pending', { exact: true })
	).toBeVisible();

	expect(blockedOutboundRequests).toEqual(
		expect.arrayContaining([expect.stringMatching(/^https:\/\/www\.google\.com\/maps(?:[/?])/u)])
	);
	expect(blockedOutboundRequests).not.toEqual(
		expect.arrayContaining([
			expect.stringMatching(/stripe\.com|googleapis\.com|accounts\.google\.com/u)
		])
	);
});
