import { expect, test } from '@playwright/test';

const indexRoutes = [
	{ path: '/tools/catalog', pageClass: 'page-catalog' },
	{ path: '/tools/clubs', pageClass: 'page-clubs' },
	{ path: '/tools/forum', pageClass: 'page-forum' },
	{ path: '/tools/semester', pageClass: 'page-semester' }
];

test.describe('MariTools index viewport fill', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	for (const route of indexRoutes) {
		test(`${route.path} fills the viewport below site chrome`, async ({ page }) => {
			await page.goto(route.path, { waitUntil: 'networkidle' });

			const metrics = await page.evaluate((pageClass) => {
				const header = document.querySelector('header');
				const footer = document.querySelector('footer');
				const shell = document.querySelector('.tools-shell');
				const sidebar = document.querySelector('.tools-sidebar');
				const main = document.querySelector('.tools-main');
				const pageSection = document.querySelector(`.${pageClass}`);
				const viewportHeight = window.innerHeight;
				const headerHeight = header?.getBoundingClientRect().height ?? 0;
				const footerHeight = footer?.getBoundingClientRect().height ?? 0;
				const expectedShellHeight = viewportHeight - headerHeight - footerHeight;

				return {
					expectedShellHeight,
					shellHeight: shell?.getBoundingClientRect().height ?? 0,
					mainHeight: main?.getBoundingClientRect().height ?? 0,
					sidebarHeight: sidebar?.getBoundingClientRect().height ?? 0,
					pageHeight: pageSection?.getBoundingClientRect().height ?? 0,
					footerTop: footer?.getBoundingClientRect().top ?? 0,
					shellBottom: shell?.getBoundingClientRect().bottom ?? 0,
					documentHeight: document.documentElement.scrollHeight,
					viewportHeight
				};
			}, route.pageClass);

			expect(metrics.shellHeight).toBeGreaterThanOrEqual(metrics.expectedShellHeight - 1);
			expect(metrics.shellHeight).toBeLessThanOrEqual(metrics.expectedShellHeight + 1);
			expect(metrics.mainHeight).toBeCloseTo(metrics.shellHeight, 0);
			expect(metrics.pageHeight).toBeCloseTo(metrics.shellHeight, 0);
			expect(Math.abs(metrics.footerTop - metrics.shellBottom)).toBeLessThanOrEqual(1);
			expect(metrics.documentHeight).toBeLessThanOrEqual(metrics.viewportHeight + 1);
			expect(metrics.sidebarHeight).toBeCloseTo(metrics.shellHeight, 0);
		});
	}

	test('schedule keeps full-bleed layout below the site chrome', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('maritools.omnivox-tutorial.dismissed', '1');
		});
		await page.goto('/tools/schedule', { waitUntil: 'networkidle' });

		const metrics = await page.evaluate(() => {
			const pageSection = document.querySelector('.page-schedule');

			return {
				padding: getComputedStyle(pageSection).padding,
				pageHeight: pageSection?.getBoundingClientRect().height ?? 0,
				viewportHeight: window.innerHeight
			};
		});

		expect(metrics.padding).toBe('0px');
		expect(metrics.pageHeight).toBeGreaterThanOrEqual(metrics.viewportHeight - 1);
	});
});
