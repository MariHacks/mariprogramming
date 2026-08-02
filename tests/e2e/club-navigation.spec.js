import { expect, test } from '@playwright/test';

const clubRoutes = [
	{ label: 'Club', path: '/about-us', heading: 'You can start before you know how to code.' },
	{ label: 'Workshops', path: '/our-workshops', heading: 'Learn from the workshop archive' },
	{ label: 'Events', path: '/events', heading: 'Events, once they’re confirmed' },
	{ label: 'Resources', path: '/resources', heading: 'Choose a learning path for your next step' }
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

	test('reaches every principal route while cart controls stay in Book Delivery', async ({
		page
	}) => {
		await page.goto('/');
		await expect(
			page.getByRole('heading', { level: 1, name: 'Learn programming. Build together.' })
		).toBeVisible();
		await expectNoCartControls(page);

		for (const route of clubRoutes) {
			await page.goto('/');
			await page.getByRole('link', { name: route.label, exact: true }).click();
			await expect(page).toHaveURL(route.path);
			await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
			await expectNoCartControls(page);
		}

		await page.goto('/');
		await page.getByRole('link', { name: 'Book Delivery', exact: true }).click();
		await expect(page).toHaveURL('/books');
		await expect(
			page.getByRole('heading', { level: 1, name: 'Start with your teacher' })
		).toBeVisible();
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

		const clubLink = page.getByRole('link', { name: 'Club', exact: true });
		await page.keyboard.press('Tab');
		await expect(clubLink).toBeFocused();

		const focusRing = await clubLink.evaluate((element) => {
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

	test('opens the menu, reaches Book Delivery, and never overflows horizontally', async ({
		page
	}) => {
		await page.goto('/');
		await expectNoCartControls(page);
		await expectNoHorizontalOverflow(page);

		await page.getByRole('button', { name: 'Open navigation' }).click();
		await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
		await expectNoHorizontalOverflow(page);

		await page.getByRole('link', { name: 'Book Delivery', exact: true }).click();
		await expect(page).toHaveURL('/books');
		await expect(
			page.getByRole('heading', { level: 1, name: 'Start with your teacher' })
		).toBeVisible();
		await expectNoHorizontalOverflow(page);
	});
});

test('current schedule, workshop archive, and resource paths remain useful', async ({ page }) => {
	await page.goto('/events');
	await expect(page.getByRole('heading', { name: 'New events are being planned' })).toBeVisible();
	await expect(page.getByText('Dates will appear here after they are confirmed.')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Follow on Instagram' }).first()).toBeVisible();
	await expect(page.getByRole('link', { name: 'Browse workshop archive' })).toBeVisible();

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
	await expect(
		page.getByRole('heading', { level: 1, name: 'Events, once they’re confirmed' })
	).toBeVisible();
});
