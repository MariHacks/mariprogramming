import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import { resolve } from 'node:path';

const MEMBER_ID = '70000000-0000-4000-8000-000000000099';
const GOOGLE_IMAGE = 'https://lh3.googleusercontent.com/a/live-e2e-avatar=s256-c';
const PHOTO = resolve('static/images/marihacks/organizers-working-640.webp');

test('synthetic Google identity supplies the default avatar and custom upload overrides it', async ({
	context,
	page
}, testInfo) => {
	test.setTimeout(90_000);
	if (
		process.env.LIVE_E2E_MODE !== 'isolated-local' ||
		new URL(process.env.DATABASE_URL).hostname !== '127.0.0.1'
	) {
		throw new Error('Google avatar proof requires the isolated loopback database');
	}
	const db = new Client({ connectionString: process.env.DATABASE_URL });
	await db.connect();
	try {
		await db.query(
			'INSERT INTO "user" (name, email, image, id, email_verified, created_at, updated_at) VALUES ($1, $2, $3, $4, true, now(), now())',
			['Ada Google', 'ada-google@example.test', GOOGLE_IMAGE, MEMBER_ID]
		);
		await context.route(GOOGLE_IMAGE, (route) =>
			route.fulfill({ path: PHOTO, contentType: 'image/webp' })
		);
		await context.addCookies([
			{
				name: 'mari-staff.session_token',
				value: 'live-e2e-avatar',
				url: process.env.LIVE_E2E_BASE_URL,
				httpOnly: true,
				sameSite: 'Lax'
			}
		]);
		await page.goto('/tools/account');
		await expect(page.getByLabel('Username', { exact: true })).toHaveValue('Ada_Google');
		const defaultAvatar = page.locator('[data-signup-tab="information"] img');
		await expect(defaultAvatar).toHaveAttribute('src', GOOGLE_IMAGE);
		await expect(defaultAvatar).toBeVisible();
		await page.setViewportSize({ width: 390, height: 844 });
		await expect(defaultAvatar).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
			true
		);
		await page.screenshot({
			path: testInfo.outputPath('google-avatar-signup-mobile.png'),
			fullPage: true
		});
		await page.setViewportSize({ width: 1600, height: 1000 });
		await page.screenshot({
			path: testInfo.outputPath('google-avatar-signup.png'),
			fullPage: true
		});
		await page.waitForTimeout(1000);
		await page.getByLabel('First name', { exact: true }).fill('Ada');
		await page.getByLabel('Last name', { exact: true }).fill('Google');
		await page.getByLabel('Student number', { exact: true }).fill('2530622');
		await page
			.getByRole('combobox', { name: 'Program', exact: true })
			.selectOption({ label: 'Science, Pure and Applied Science' });
		await page.getByRole('combobox', { name: 'Current year', exact: true }).selectOption('first');
		await page.getByRole('tab', { name: 'Interests and experience' }).click();
		await page.locator('select[name="experienceLevel"]').selectOption('learning');
		await page.locator('input[name="interests"][value="web"]').check();
		await page.getByRole('tab', { name: 'Member form' }).click();
		await page.getByRole('button', { name: 'Join the club' }).click();
		await expect(page.getByRole('heading', { name: 'Ada_Google', exact: true })).toBeVisible();
		await expect(page.locator('.community-avatar img')).toHaveAttribute('src', GOOGLE_IMAGE);
		const persisted = await db.query(
			'SELECT profile_image_data_url FROM mt_student_profiles WHERE user_id = $1',
			[MEMBER_ID]
		);
		expect(persisted.rows[0].profile_image_data_url).toBe(GOOGLE_IMAGE);
		await page.reload();
		await expect(page.locator('.community-avatar img')).toHaveAttribute('src', GOOGLE_IMAGE);
		await page.screenshot({
			path: testInfo.outputPath('google-avatar-profile.png'),
			fullPage: true
		});
		await page.waitForTimeout(1000);
		await page.goto(`/tools/people/${MEMBER_ID}`);
		await expect(page.locator('img').filter({ visible: true }).first()).toBeVisible();
		await expect(page.locator(`img[src="${GOOGLE_IMAGE}"]`).first()).toBeVisible();
		await page.goto('/tools/account');
		await page.waitForTimeout(500);
		await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
		await expect(page.getByRole('form', { name: 'Edit profile' })).toBeVisible();
		await page
			.locator('input[aria-label="Choose profile picture file"]')
			.setInputFiles(PHOTO, { timeout: 5000 });
		await page.getByRole('button', { name: 'Use photo', exact: true }).click();
		await page.getByRole('button', { name: 'Save profile', exact: true }).click();
		await expect(page.locator('.community-avatar img')).toHaveAttribute(
			'src',
			/^data:image\/webp;base64,/
		);
		await page.reload();
		await expect(page.locator('.community-avatar img')).toHaveAttribute(
			'src',
			/^data:image\/webp;base64,/
		);
		await page.screenshot({
			path: testInfo.outputPath('custom-avatar-profile.png'),
			fullPage: true
		});
		await page.waitForTimeout(1000);
	} finally {
		await db.query('DELETE FROM "user" WHERE id = $1', [MEMBER_ID]);
		await db.end();
	}
});
