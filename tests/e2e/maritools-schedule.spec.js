import { expect, test } from '@playwright/test';
import { CANONICAL_OMNIVOX_SCHEDULE } from '../../src/lib/maritools/schedule/fixture.js';

test('My Schedule reads the compact Omnivox list', async ({ page }) => {
	await page.goto('/tools/schedule', { waitUntil: 'networkidle' });
	await expect(page.getByRole('heading', { name: 'My schedule' })).toBeVisible();
	await page.getByLabel('Omnivox course list').fill(CANONICAL_OMNIVOX_SCHEDULE);
	await page.getByRole('button', { name: 'Read schedule' }).click();
	await expect(page.getByRole('heading', { name: 'Courses' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Week' })).toBeVisible();
	await expect(page.getByText('PHE-103-A1')).toBeVisible();
	await expect(page.getByText('420-SNT-MS')).toBeVisible();
	await expect(page.getByText('603-103-MQ')).toBeVisible();
	await expect(page.getByText('202-SN2-RE')).toBeVisible();
});
