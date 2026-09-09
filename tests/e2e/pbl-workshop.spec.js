import { expect, test } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ARTIFACTS = join(process.cwd(), '.artifacts/pbl1');

test.use({
	video: { mode: 'on', size: { width: 1400, height: 900 } },
	viewport: { width: 1400, height: 900 }
});

function saveProof(page, name) {
	mkdirSync(ARTIFACTS, { recursive: true });
	return page.screenshot({ path: join(ARTIFACTS, `${name}.png`), fullPage: true });
}

/**
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {string} code
 */
async function joinWithMember(request, code) {
	const memberId = randomBytes(16).toString('hex');
	return request.post(`/api/pbl/rooms/${code}/join`, {
		headers: {
			accept: 'application/json',
			cookie: `pbl_member=${memberId}`
		}
	});
}

test.describe('PBL 1 student workshop', () => {
	test('puts the live workshop ahead of the archive and runs a team studio', async ({
		page,
		browser,
		request
	}) => {
		test.setTimeout(240000);
		mkdirSync(ARTIFACTS, { recursive: true });

		await page.goto('/');
		const primary = page.getByRole('navigation', { name: 'Primary navigation' });
		await expect(primary.getByRole('link', { name: 'Workshops' })).toHaveAttribute('href', '/pbl');
		await primary.getByRole('link', { name: 'Workshops', exact: true }).click();
		await expect(page).toHaveURL('/pbl');
		await expect(
			page.getByRole('heading', { level: 2, name: 'Speedrun Programming in Science' })
		).toBeVisible();
		const archive = page.getByRole('link', { name: 'Workshop archive' });
		await expect(archive).toHaveAttribute('href', '/our-workshops');
		const workshopBox = await page
			.getByRole('heading', { level: 2, name: 'Speedrun Programming in Science' })
			.boundingBox();
		const archiveBox = await archive.boundingBox();
		expect(workshopBox && archiveBox && workshopBox.y < archiveBox.y).toBe(true);
		await saveProof(page, '01-pbl-ahead-of-archive');

		await page.getByRole('link', { name: 'Open PBL 1' }).click();
		await expect(page.getByRole('heading', { name: 'Speedrun Programming in Science' })).toBeVisible();
		await page.getByLabel('Team name').fill('Lab table 3');
		await page.getByRole('button', { name: 'Create room' }).click();
		await expect(page).toHaveURL(/\/pbl\/science\/[A-Z0-9]{6}$/);
		await expect(page.getByRole('heading', { name: 'Get something running' })).toBeVisible({
			timeout: 30000
		});
		await expect(page.getByRole('region', { name: 'Workshop studio' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Python editor' })).toBeVisible();
		const code = page.url().split('/').at(-1);
		await saveProof(page, '02-lesson-and-editor');

		const step1 = page.getByRole('button', { name: '1', exact: true });
		await expect(step1).toBeDisabled();
		await page.getByRole('button', { name: 'Run' }).click();
		await expect(page.getByLabel('Program output')).toContainText('Experiment loaded', {
			timeout: 120000
		});
		await expect(page.getByRole('status')).toContainText('Change the message');
		await expect(step1).toBeDisabled();
		await saveProof(page, '04-locked-until-behavior');

		const editor = page.getByRole('textbox', { name: 'Python' });
		await editor.fill('print("Lab table 3 is live")\n');
		await page.getByRole('button', { name: 'Run' }).click();
		await expect(page.getByLabel('Program output')).toContainText('Lab table 3 is live', {
			timeout: 30000
		});
		await expect(page.getByRole('status')).toContainText('printed your message');
		await saveProof(page, '03-run-output');
		await expect(step1).toBeEnabled({ timeout: 10000 });
		await step1.click();
		await expect(
			page.getByRole('heading', { name: 'Values, variables, types, expressions' })
		).toBeVisible();
		await expect(editor).toHaveValue(/Lab table 3 is live/);
		await saveProof(page, '04-check-unlocks-next');

		await page.getByRole('button', { name: '0', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Syntax' })).toBeDisabled();
		await expect(page.getByRole('button', { name: 'Partial code' })).toBeDisabled();
		await page.getByRole('button', { name: 'Idea' }).click();
		await expect(page.locator('.hint').first()).toBeVisible();
		await expect(page.getByRole('button', { name: 'Syntax' })).toBeEnabled();
		await page.getByRole('button', { name: 'Syntax' }).click();
		await expect(page.locator('.hint')).toHaveCount(2);
		await expect(page.getByRole('button', { name: 'Partial code' })).toBeEnabled();
		await page.getByRole('button', { name: 'Partial code' }).click();
		await expect(page.locator('.hint')).toHaveCount(3);
		await saveProof(page, '05-three-hint-levels');

		const origin = new URL(page.url()).origin;
		const second = await browser.newContext({
			baseURL: origin,
			recordVideo: { dir: ARTIFACTS, size: { width: 1400, height: 900 } },
			viewport: { width: 1400, height: 900 }
		});
		const page2 = await second.newPage();
		await page2.goto(`/pbl/science/${code}`);
		await expect(page2.getByRole('textbox', { name: 'Python' })).toHaveValue(
			/Lab table 3 is live/,
			{ timeout: 20000 }
		);
		await editor.fill('print("synced from device A")\n');
		await expect(page2.getByRole('textbox', { name: 'Python' })).toHaveValue(
			/synced from device A/,
			{ timeout: 15000 }
		);
		await expect(page2.getByRole('heading', { name: 'Get something running' })).toBeVisible();
		await saveProof(page2, '06-two-session-sync');
		const page2Video = page2.video();
		await second.close();
		if (page2Video) {
			await page2Video.saveAs(join(ARTIFACTS, '06-two-session-sync.webm'));
		}

		for (let i = 0; i < 8; i += 1) {
			const joined = await joinWithMember(request, code);
			expect(joined.ok(), `join ${i + 3} of 10`).toBeTruthy();
		}
		await page.reload();
		await expect(page.getByText('10/10 on this team')).toBeVisible({ timeout: 20000 });
		const eleventh = await joinWithMember(request, code);
		expect(eleventh.status()).toBe(403);
		expect(await eleventh.json()).toEqual({ error: 'This team is full (10 people).' });
		const overflow = await browser.newContext({
			baseURL: origin,
			recordVideo: { dir: ARTIFACTS, size: { width: 1400, height: 900 } },
			viewport: { width: 1400, height: 900 }
		});
		const page3 = await overflow.newPage();
		await page3.goto(`/pbl/science/${code}`);
		await expect(page3.getByRole('alert')).toContainText('This team is full (10 people).', {
			timeout: 20000
		});
		await saveProof(page, '07-team-size');
		await saveProof(page3, '07-team-full');
		const page3Video = page3.video();
		await overflow.close();
		if (page3Video) {
			await page3Video.saveAs(join(ARTIFACTS, '07-team-size.webm'));
		}

	});
});
