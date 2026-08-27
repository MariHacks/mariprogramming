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
