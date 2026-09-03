import { expect, test } from '@playwright/test';
import { CANONICAL_OMNIVOX_SCHEDULE } from '../../src/lib/maritools/schedule/fixture.js';

test('My Schedule reads the compact Omnivox list', async ({ page }) => {
	await page.addInitScript(() => {
		localStorage.setItem('maritools.omnivox-tutorial.dismissed', '1');
	});
	await page.goto('/tools/schedule', { waitUntil: 'networkidle' });
	await expect(page.getByRole('heading', { name: /Week of/ })).toBeVisible();
	await expect(page.getByLabel('Term')).toHaveCount(0);
	await expect(
		page.getByRole('navigation', { name: 'MariTools' }).getByRole('link', { name: 'Schedule' })
	).toHaveAttribute('aria-current', 'page');
	await expect(page.getByRole('link', { name: 'Sign up' })).toHaveAttribute(
		'href',
		'/tools/account'
	);
	await page.getByRole('button', { name: 'Import Omnivox' }).first().click();
	await page.getByLabel('Omnivox course list').fill(CANONICAL_OMNIVOX_SCHEDULE);
	await page.getByRole('button', { name: 'Read schedule' }).click();
	const calendar = page.getByLabel('Weekly course schedule');
	await expect(calendar).toBeVisible();
	await expect(page.getByRole('heading', { name: /Week of/ })).toBeVisible();
	await expect(calendar.getByText('PHE-103-A1').first()).toBeVisible();
	await expect(calendar.getByText('420-SNT-MS').first()).toBeVisible();
	await expect(calendar.getByText('603-103-MQ').first()).toBeVisible();
	await expect(calendar.getByText('202-SN2-RE').first()).toBeVisible();
});

for (const viewport of [
	{ label: 'short desktop', width: 1024, height: 650 },
	{ label: 'mobile', width: 390, height: 700 },
	{ label: 'landscape', width: 844, height: 390 }
]) {
	test(`${viewport.label} keeps the tutorial actions inside the popup`, async ({
		page
	}, testInfo) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height });
		await page.addInitScript(() => {
			localStorage.setItem('maritools.omnivox-tutorial.dismissed', '1');
		});
		await page.goto('/tools/schedule', { waitUntil: 'networkidle' });
		await page.getByRole('button', { name: 'Import Omnivox' }).first().click();
		await page.getByRole('button', { name: 'Show tutorial again' }).click();

		const tutorial = page.getByRole('dialog');
		const actions = tutorial.locator('.tutorial-stage footer');
		await expect(tutorial).toBeVisible();
		await page.screenshot({ path: testInfo.outputPath('tutorial.png') });
		for (let step = 1; step <= 9; step += 1) {
			await expect(actions).toBeInViewport({ ratio: 1 });
			for (const name of ['Back', 'Skip tutorial', step === 9 ? 'Done' : 'Next']) {
				await expect(tutorial.getByRole('button', { name, exact: true })).toBeInViewport({
					ratio: 1
				});
			}
			await tutorial
				.getByRole('button', { name: step === 9 ? 'Done' : 'Next', exact: true })
				.click();
		}
		await expect(tutorial).toHaveCount(0);
	});
}
