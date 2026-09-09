import { expect, test } from '@playwright/test';

const clubRoutes = [
	{ label: 'About', path: '/about-us', heading: 'About the club' },
	{ label: 'Events', path: '/events', heading: 'Events' },
	{ label: 'Workshops', path: '/pbl', heading: 'Workshops' },
	{ label: 'MariTools', path: '/tools', heading: 'MariTools' }
];

async function expectNoCartControls(page) {
	await expect(page.getByRole('link', { name: /cart/i })).toHaveCount(0);
	await expect(page.getByRole('button', { name: /cart/i })).toHaveCount(0);
	await expect(
		page.locator('a[href="/cart"], a[href^="/books/cart"], [aria-label*="cart" i]')
	).toHaveCount(0);
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

test.describe('desktop club navigation', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('reaches every principal route without exposing the closed service', async ({ page }) => {
		await page.goto('/');
		await expect(
			page.getByRole('heading', { level: 1, name: 'Come build something with us.' })
		).toBeVisible();
		await expectNoCartControls(page);
		await expect(page.getByRole('link', { name: 'Book Delivery' })).toHaveCount(0);
		await expect(page.locator('a[href^="/books"]')).toHaveCount(0);

		for (const route of clubRoutes) {
			await page.goto('/');
			await page.getByRole('link', { name: route.label, exact: true }).click();
			await expect(page).toHaveURL(route.path);
			await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
			await expectNoCartControls(page);
		}
	});

	test('shows a visible keyboard focus path into primary navigation', async ({ page }) => {
		await page.goto('/');

		const skipLink = page.getByRole('link', { name: 'Skip to main content' });
		await page.keyboard.press('Tab');
		await expect(skipLink).toBeFocused();
		await expect(skipLink).toBeVisible();

		await page.keyboard.press('Tab');
		await expect(
			page.getByRole('link', { name: 'Marianopolis Programming Club, home' })
		).toBeFocused();

		const aboutLink = page.getByRole('link', { name: 'About', exact: true });
		await page.keyboard.press('Tab');
		await expect(aboutLink).toBeFocused();

		const focusRing = await aboutLink.evaluate((element) => {
			const style = getComputedStyle(element);
			return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
		});

		expect(focusRing.style).not.toBe('none');
		expect(focusRing.width).toBeGreaterThanOrEqual(2);

		await page.keyboard.press('Enter');
		await expect(page).toHaveURL('/about-us');
	});
});

test.describe('mobile club navigation', () => {
	test.use({ viewport: { width: 375, height: 812 } });

	test('opens the menu without exposing the closed service or overflowing', async ({ page }) => {
		await page.goto('/');
		await expectNoCartControls(page);
		await expect(page.locator('a[href^="/books"]')).toHaveCount(0);
		await expectNoHorizontalOverflow(page);

		await page.getByRole('button', { name: 'Open navigation' }).click();
		await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
		await expect(page.getByRole('link', { name: 'Book Delivery' })).toHaveCount(0);
		await expectNoHorizontalOverflow(page);
	});

	test('keeps closed menu links out of the keyboard sequence', async ({ page }) => {
		await page.goto('/');
		const menuButton = page.getByRole('button', { name: 'Open navigation' });

		await menuButton.focus();
		await page.keyboard.press('Enter');
		await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
		await page.keyboard.press('Tab');
		await expect(page.getByRole('link', { name: 'About', exact: true })).toBeFocused();
	});
});

for (const width of [320, 768, 1024]) {
	test(`keeps Book Delivery routes closed while showing the homepage preview at ${width}px`, async ({
		page
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/');
		await expect(page.locator('a[href^="/books"]')).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Book Delivery', exact: true })).toBeVisible();
		await expect(
			page
				.getByRole('region', { name: 'Book Delivery' })
				.getByText('coming next semester', { exact: true })
		).toBeVisible();
		await expectNoHorizontalOverflow(page);

		for (const path of ['/books', '/books/cart']) {
			await page.goto(path);
			await expect(page).toHaveURL('/');
			await expect(
				page.getByRole('heading', { level: 1, name: 'Come build something with us.' })
			).toBeVisible();
			await expectNoHorizontalOverflow(page);
		}
	});
}

test('current schedule, workshop archive, and resource paths remain useful', async ({ page }) => {
	await page.goto('/');
	const primary = page.getByRole('navigation', { name: 'Primary navigation' });
	await expect(primary.getByRole('link', { name: 'Workshops' })).toHaveAttribute(
		'href',
		'/pbl'
	);
	await expect(primary.getByRole('link', { name: 'Resources' })).toHaveCount(0);
	await expect(primary.getByRole('link', { name: 'Mini-Competitions' })).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Sign up' }).first()).toBeVisible();

	await page.goto('/events');
	await expect(page.getByRole('heading', { name: 'No upcoming events are listed' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Follow on Instagram' }).first()).toBeVisible();
	await expect(page.getByRole('link', { name: 'Browse workshops' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Browse resources' })).toBeVisible();

	await page.goto('/our-workshops');
	await expect(page.getByRole('heading', { name: 'Python foundations' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Intro to Python' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Open Intro to Python Slides' })).toBeVisible();

	await page.goto('/resources');
	await expect(page.getByRole('heading', { name: 'Learn the foundations' })).toBeVisible();
	await expect(
		page.getByRole('link', { name: 'Open freeCodeCamp for Learn the foundations' })
	).toBeVisible();
});

test('an unknown club route recovers and the legacy roadmap redirects', async ({ page }) => {
	await page.goto('/not-a-current-club-route');
	await expect(page).toHaveURL('/not-a-current-club-route');
	await expect(
		page.getByRole('heading', { level: 1, name: 'We couldn’t find that page.' })
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Return to club home' })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Recovery routes' })).toBeVisible();
	await expectNoCartControls(page);

	await page.goto('/roadmap');
	await expect(page).toHaveURL('/events');
	await expect(page.getByRole('heading', { level: 1, name: 'Events' })).toBeVisible();
});
