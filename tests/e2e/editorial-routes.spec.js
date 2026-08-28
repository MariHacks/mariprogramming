import { expect, test } from '@playwright/test';

const routes = [
	{ path: '/about-us', heading: 'About the club' },
	{ path: '/events', heading: 'Events' },
	{ path: '/our-workshops', heading: 'Workshop archive' },
	{ path: '/resources', heading: 'Resources' },
	{ path: '/mini-competitions', heading: 'Mini-Competitions' }
];

for (const viewport of [
	{ width: 320, height: 800 },
	{ width: 390, height: 844 },
	{ width: 768, height: 1024 },
	{ width: 1024, height: 900 },
	{ width: 1440, height: 900 }
]) {
	test.describe(`${viewport.width}px editorial routes`, () => {
		test.use({ viewport });

		test('keeps every page readable and every visible action large enough', async ({ page }) => {
			for (const route of routes) {
				await page.goto(route.path);
				await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
				const metrics = await page.evaluate(() => {
					const competitionWord = document.querySelector('[data-heading-word="competitions"]');
					let competitionWordLines = 1;
					if (location.pathname === '/mini-competitions' && competitionWord?.firstChild) {
						const range = document.createRange();
						range.selectNodeContents(competitionWord);
						competitionWordLines = range.getClientRects().length;
					}
					const targets = [...document.querySelectorAll('a[href], button:not([disabled])')]
						.filter((element) => element.getClientRects().length > 0)
						.map((element) => ({
							name: element.getAttribute('aria-label') || element.textContent?.trim() || '',
							width: element.getBoundingClientRect().width,
							height: element.getBoundingClientRect().height
						}));
					return {
						overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
						h1Count: document.querySelectorAll('h1').length,
						competitionWordPresent:
							location.pathname !== '/mini-competitions' || competitionWord !== null,
						competitionWordLines,
						shortTargets: targets.filter(({ width, height }) => width < 44 || height < 44)
					};
				});

				expect(metrics.overflow, `${route.path} must not overflow`).toBeLessThanOrEqual(0);
				expect(metrics.h1Count).toBe(1);
				expect(metrics.competitionWordPresent).toBe(true);
				expect(metrics.competitionWordLines, 'Competitions must remain one word').toBe(1);
				expect(metrics.shortTargets).toEqual([]);
			}
		});
	});
}

test('Mini-Competitions stays reachable from home and disclosure menus', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/');
	await page.getByRole('link', { name: 'Mini-Competitions status' }).click();
	await expect(page).toHaveURL('/mini-competitions');
	await expect(page.getByText('Coming Soon')).toBeVisible();
	await expect(
		page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', {
			name: 'Mini-Competitions',
			exact: true
		})
	).toHaveCount(0);

	await page.setViewportSize({ width: 768, height: 900 });
	await page.goto('/');
	await page.getByRole('button', { name: 'More', exact: true }).click();
	await page
		.getByRole('navigation', { name: 'Compact navigation' })
		.getByRole('link', { name: 'Mini-Competitions', exact: true })
		.click();
	await expect(page).toHaveURL('/mini-competitions');

	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	await page.getByRole('button', { name: 'Open navigation' }).click();
	await page
		.getByRole('navigation', { name: 'Mobile navigation' })
		.getByRole('link', {
			name: 'Mini-Competitions',
			exact: true
		})
		.click();
	await expect(page).toHaveURL('/mini-competitions');
});

test('all editorial routes expose a keyboard focus path', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });

	for (const route of routes) {
		await page.goto(route.path);
		await page.keyboard.press('Tab');
		await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page.locator('#main-content')).toBeFocused();
	}
});
