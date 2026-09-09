import { expect, test } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { SCIENCE_STEPS } from '../../src/lib/pbl/science-workshop.js';

const ARTIFACTS = join(process.cwd(), '.artifacts/pbl1-ux');

test.use({
	viewport: { width: 1400, height: 900 }
});

function saveProof(page, name) {
	mkdirSync(ARTIFACTS, { recursive: true });
	return page.screenshot({ path: join(ARTIFACTS, `${name}.png`), fullPage: true });
}

/**
 * Close the context, then rename Playwright's video file.
 * Do not call video.saveAs. That hung at 240s on this machine.
 * @param {import('@playwright/test').BrowserContext} context
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 */
async function keepVideo(context, page, name) {
	const video = page.video();
	await context.close();
	if (!video) return;
	const from = await video.path();
	mkdirSync(ARTIFACTS, { recursive: true });
	renameSync(from, join(ARTIFACTS, `${name}.webm`));
}

/**
 * @param {import('@playwright/test').Browser} browser
 * @param {string} origin
 * @param {{ width?: number, height?: number }} [viewport]
 */
async function recordedPage(browser, origin, viewport = { width: 1400, height: 900 }) {
	mkdirSync(ARTIFACTS, { recursive: true });
	const context = await browser.newContext({
		baseURL: origin,
		recordVideo: { dir: ARTIFACTS, size: viewport },
		viewport
	});
	const page = await context.newPage();
	return { context, page };
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

test.describe.serial('PBL 1 student workshop', () => {
	test('puts the live workshop ahead of the archive', async ({ page, browser }) => {
		test.setTimeout(60000);
		await page.goto('/');
		const origin = new URL(page.url()).origin;
		const { context, page: rec } = await recordedPage(browser, origin);
		await rec.goto('/');
		const primary = rec.getByRole('navigation', { name: 'Primary navigation' });
		await expect(primary.getByRole('link', { name: 'Workshops' })).toHaveAttribute('href', '/pbl');
		await primary.getByRole('link', { name: 'Workshops', exact: true }).click();
		await expect(rec).toHaveURL('/pbl');
		await expect(
			rec.getByRole('heading', { level: 2, name: 'Speedrun Programming in Science' })
		).toBeVisible();
		const archive = rec.getByRole('link', { name: 'Workshop archive' });
		await expect(archive).toHaveAttribute('href', '/our-workshops');
		const workshopBox = await rec
			.getByRole('heading', { level: 2, name: 'Speedrun Programming in Science' })
			.boundingBox();
		const archiveBox = await archive.boundingBox();
		expect(workshopBox && archiveBox && workshopBox.y < archiveBox.y).toBe(true);
		await saveProof(rec, '01-pbl-ahead-of-archive');
		await keepVideo(context, rec, '01-pbl-ahead-of-archive');
	});

	test('shows a beginner what to type, where Run is, and why a check failed', async ({
		page,
		browser
	}) => {
		test.setTimeout(180000);
		await page.goto('/pbl/science');
		const origin = new URL(page.url()).origin;
		const { context, page: rec } = await recordedPage(browser, origin);
		await rec.goto('/pbl/science');
		await rec.getByLabel('Team name').fill('Lab table 3');
		await rec.getByRole('button', { name: 'Create room' }).click();
		await expect(rec).toHaveURL(/\/pbl\/science\/[A-Z0-9]{6}$/);
		await expect(rec.getByRole('heading', { name: 'Get something running' })).toBeVisible({
			timeout: 30000
		});
		await expect(rec.getByText('Press Run.')).toBeVisible();
		await expect(rec.getByRole('button', { name: 'Run' })).toBeVisible();
		await rec.getByRole('button', { name: 'Run' }).click();
		await expect(rec.getByLabel('Program output')).toContainText('Experiment loaded', {
			timeout: 120000
		});
		await expect(rec.getByRole('status')).toContainText('Change the message');
		await expect(rec.getByText(/Not yet/)).toBeVisible();
		await saveProof(rec, '02-beginner-fail-check');
		const editor = rec.getByRole('textbox', { name: 'Python' });
		await editor.fill('print("Lab table 3 is live")\n');
		await rec.getByRole('button', { name: 'Run' }).click();
		await expect(rec.getByLabel('Program output')).toContainText('Lab table 3 is live', {
			timeout: 30000
		});
		await expect(rec.getByRole('status')).toContainText('printed your message');
		await expect(rec.getByText('Open the next step.')).toBeVisible();
		await saveProof(rec, '03-beginner-pass-and-run');
		await rec.getByRole('button', { name: '1', exact: true }).click();
		await expect(
			rec.getByRole('heading', { name: 'Values, variables, types, expressions' })
		).toBeVisible();
		await rec.reload();
		await expect(
			rec.getByRole('heading', { name: 'Values, variables, types, expressions' })
		).toBeVisible({ timeout: 20000 });
		await expect(editor).toHaveValue(/Lab table 3 is live/);
		await saveProof(rec, '04-reload-keeps-step-and-code');
		await keepVideo(context, rec, '02-beginner-run-and-reload');
	});

	test('lets a second device follow without clobbering, then blocks the 11th person', async ({
		page,
		browser,
		request
	}) => {
		test.setTimeout(120000);
		await page.goto('/pbl/science');
		const origin = new URL(page.url()).origin;
		const driver = await recordedPage(browser, origin);
		await driver.page.goto('/pbl/science');
		await driver.page.getByLabel('Team name').fill('Sync table');
		await driver.page.getByRole('button', { name: 'Create room' }).click();
		await expect(driver.page).toHaveURL(/\/pbl\/science\/[A-Z0-9]{6}$/);
		await expect(driver.page.getByRole('heading', { name: 'Get something running' })).toBeVisible({
			timeout: 30000
		});
		const code = driver.page.url().split('/').at(-1);
		await expect(driver.page.getByText('You type. Teammates see this.')).toBeVisible({
			timeout: 20000
		});
		const follow = await recordedPage(browser, origin);
		await follow.page.goto(`/pbl/science/${code}`);
		await expect(follow.page.getByText('Watching. Teammate is typing.')).toBeVisible({
			timeout: 20000
		});
		await expect(follow.page.getByRole('textbox', { name: 'Python' })).toHaveAttribute('readonly');
		await driver.page
			.getByRole('textbox', { name: 'Python' })
			.fill('print("synced from device A")\n');
		await expect(follow.page.getByRole('textbox', { name: 'Python' })).toHaveValue(
			/synced from device A/,
			{ timeout: 15000 }
		);
		await follow.page.getByRole('textbox', { name: 'Python' }).pressSequentially('nope');
		await expect(driver.page.getByRole('textbox', { name: 'Python' })).toHaveValue(
			/synced from device A/,
			{ timeout: 8000 }
		);
		await expect(follow.page.getByRole('textbox', { name: 'Python' })).toHaveValue(
			/synced from device A/,
			{ timeout: 8000 }
		);
		await saveProof(follow.page, '05-follower-readonly');
		await follow.page.getByRole('button', { name: 'Take keyboard' }).click();
		await expect(follow.page.getByText('You type. Teammates see this.')).toBeVisible({
			timeout: 15000
		});
		await follow.page.getByRole('textbox', { name: 'Python' }).fill('print("taken by B")\n');
		await expect(driver.page.getByRole('textbox', { name: 'Python' })).toHaveValue(/taken by B/, {
			timeout: 15000
		});
		await saveProof(driver.page, '06-two-session-handoff');
		await keepVideo(follow.context, follow.page, '05-follower-and-handoff');

		for (let i = 0; i < 8; i += 1) {
			const joined = await joinWithMember(request, code);
			expect(joined.ok(), `join ${i + 3} of 10`).toBeTruthy();
		}
		await driver.page.reload();
		await expect(driver.page.getByText('10/10 on this team')).toBeVisible({ timeout: 20000 });
		const eleventh = await joinWithMember(request, code);
		expect(eleventh.status()).toBe(403);
		expect(await eleventh.json()).toEqual({ error: 'This team is full (10 people).' });
		const overflow = await recordedPage(browser, origin);
		await overflow.page.goto(`/pbl/science/${code}`);
		await expect(overflow.page.getByRole('alert')).toContainText('This team is full (10 people).', {
			timeout: 20000
		});
		await expect(overflow.page.getByRole('textbox', { name: 'Python' })).toHaveCount(0);
		await saveProof(overflow.page, '07-team-full-no-editor');
		await keepVideo(overflow.context, overflow.page, '07-team-full-no-editor');
		await keepVideo(driver.context, driver.page, '06-driver-ten');
	});

	test('opens steps 2 through 11 with a prompt and Run', async ({ page, browser }) => {
		test.setTimeout(120000);
		await page.goto('/pbl/science');
		await page.getByLabel('Team name').fill('All steps');
		await page.getByRole('button', { name: 'Create room' }).click();
		await expect(page).toHaveURL(/\/pbl\/science\/[A-Z0-9]{6}$/);
		await expect(page.getByRole('heading', { name: 'Get something running' })).toBeVisible({
			timeout: 30000
		});
		const code = page.url().split('/').at(-1) ?? '';
		const origin = new URL(page.url()).origin;
		const room = await page.request.get(`/api/pbl/rooms/${code}`);
		const current = await room.json();
		const unlocked = await page.request.put(`/api/pbl/rooms/${code}`, {
			data: {
				version: current.version,
				unlockedStep: 11,
				currentStep: 0
			}
		});
		expect(unlocked.ok()).toBeTruthy();
		const { context, page: rec } = await recordedPage(browser, origin);
		await rec.goto(`/pbl/science/${code}`);
		for (const step of SCIENCE_STEPS.filter((item) => item.id >= 2)) {
			await rec.getByRole('button', { name: String(step.id), exact: true }).click();
			await expect(rec.getByRole('heading', { name: step.title })).toBeVisible();
			await expect(rec.getByRole('button', { name: 'Run' })).toBeVisible();
			await expect(rec.locator('.body')).not.toHaveText('');
		}
		await saveProof(rec, '08-steps-2-to-11');
		await rec.getByRole('link', { name: 'Facilitator view' }).click();
		await expect(rec.getByRole('heading', { name: /Team All steps/ })).toBeVisible();
		await expect(rec.getByText(/Pace/)).toBeVisible();
		await saveProof(rec, '09-facilitator');
		await keepVideo(context, rec, '08-later-steps-and-facilitator');
	});

	test('shows lesson, code, and output panes on a phone-sized screen', async ({
		page,
		browser
	}) => {
		test.setTimeout(60000);
		await page.goto('/pbl/science');
		await page.getByLabel('Team name').fill('Phone follow');
		await page.getByRole('button', { name: 'Create room' }).click();
		await expect(page).toHaveURL(/\/pbl\/science\/[A-Z0-9]{6}$/);
		const code = page.url().split('/').at(-1);
		const origin = new URL(page.url()).origin;
		const { context, page: rec } = await recordedPage(browser, origin, {
			width: 390,
			height: 844
		});
		await rec.goto(`/pbl/science/${code}`);
		await expect(rec.getByRole('heading', { name: 'Get something running' })).toBeVisible({
			timeout: 20000
		});
		const panes = rec.getByRole('navigation', { name: 'Studio sections' });
		await expect(panes.getByRole('button', { name: 'Lesson' })).toBeVisible();
		await panes.getByRole('button', { name: 'Code' }).click();
		await expect(rec.getByRole('textbox', { name: 'Python' })).toBeVisible();
		await panes.getByRole('button', { name: 'Output' }).click();
		await expect(rec.getByLabel('Program output')).toBeVisible();
		await rec.getByRole('button', { name: 'Run' }).click();
		await saveProof(rec, '10-phone-panes');
		await keepVideo(context, rec, '10-phone-panes');
	});
});
