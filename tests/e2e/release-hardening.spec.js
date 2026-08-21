import { expect, test } from '@playwright/test';

async function expectNoHorizontalOverflow(page) {
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
}

for (const viewport of [
	{ label: 'mobile', width: 390, height: 844 },
	{ label: 'desktop', width: 1440, height: 900 }
]) {
	test(`${viewport.label} release keeps public navigation, closed books, and staff recovery usable`, async ({
		page
	}) => {
		await page.setViewportSize(viewport);
		await page.goto('/');
		await expect(
			page.getByRole('heading', { level: 1, name: 'Come build something with us.' })
		).toBeVisible();
		await expectNoHorizontalOverflow(page);

		await page.goto('/books');
		await expect(page).toHaveURL('/');
		await expect(page.getByRole('heading', { name: 'Book Delivery', exact: true })).toBeVisible();
		await expect(
			page
				.getByRole('region', { name: 'Book Delivery' })
				.getByText('coming next semester', { exact: true })
		).toBeVisible();

		await page.goto('/staff/sign-in?state=reauthenticate');
		await expect(page.getByRole('heading', { level: 1, name: 'Staff access' })).toBeVisible();
		await expect(page.getByRole('alert')).toHaveText(
			'Your staff session is no longer active. Sign in again.'
		);
		await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Back to the club site' })).toBeVisible();
		await expectNoHorizontalOverflow(page);
	});
}

test('release responses expose CSP and private route policies', async ({ request }) => {
	const publicResponse = await request.get('/');
	expect(publicResponse.status()).toBe(200);
	const publicHtml = await publicResponse.text();
	const publicCsp = publicHtml.match(
		/<meta http-equiv="content-security-policy" content="([^"]+)">/
	)?.[1];
	expect(publicCsp).toContain("default-src 'self'");
	expect(publicCsp).toContain("style-src 'self'");
	expect(publicCsp).toContain("style-src-attr 'unsafe-hashes'");
	expect(publicCsp).not.toContain('unsafe-inline');
	expect(publicCsp).not.toContain('unsafe-eval');

	const staffResponse = await request.get('/staff/sign-in?state=reauthenticate');
	expect(staffResponse.status()).toBe(200);
	expect(staffResponse.headers()['cache-control']).toBe('private, no-store');
	expect(staffResponse.headers()['pragma']).toBe('no-cache');
	expect(staffResponse.headers()['referrer-policy']).toBe('no-referrer');
	expect(staffResponse.headers()['x-robots-tag']).toBe('noindex, nofollow');
	expect(staffResponse.headers()['content-security-policy']).toContain("frame-ancestors 'none'");

	const cronResponse = await request.get('/api/cron/book-delivery');
	expect(cronResponse.status()).toBe(503);
	expect(cronResponse.headers()['cache-control']).toBe('private, no-store');
	expect(cronResponse.headers()['x-robots-tag']).toBe('noindex, nofollow');
	expect(await cronResponse.json()).toEqual({ error: 'Scheduled work is unavailable' });
});

test('production CSP permits only the framework styles required for the application shell', async ({
	page
}) => {
	const cspErrors = [];
	page.on('console', (message) => {
		if (message.type() === 'error' && message.text().includes('Content Security Policy')) {
			cspErrors.push(message.text());
		}
	});

	await page.goto('/');
	const applicationShell = page.locator('body > div').first();
	await expect(applicationShell).toHaveCSS('display', 'contents');

	const announcer = page.locator('#svelte-announcer');
	await expect(announcer).toHaveCSS('position', 'absolute');
	await expect(announcer).toHaveCSS('width', '1px');
	expect(cspErrors).toEqual([]);
});
