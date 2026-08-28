/**
 * Continuous video + screenshot proof for schedule and free-time.
 * Usage: node scripts/capture-maritools-proof.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:5174
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_OMNIVOX_SCHEDULE } from '../src/lib/maritools/schedule/fixture.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const baseURL = process.argv[2] || 'http://127.0.0.1:5174';
const scheduleDir = path.join(root, '.artifacts/verify-mariTools/schedule');
const freeDir = path.join(root, '.artifacts/verify-mariTools/free-time');
const tmpRoot = path.join(root, '.artifacts/verify-mariTools/_capture-tmp');

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} t0
 * @param {Array<{t:number,label:string}>} log
 * @param {string} label
 */
async function mark(page, t0, log, label) {
	const t = Number(((Date.now() - t0) / 1000).toFixed(2));
	log.push({ t, label });
	console.log(`  [${t.toFixed(2)}s] ${label}`);
	await sleep(700);
}

async function main() {
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(tmpRoot, { recursive: true });
	await mkdir(scheduleDir, { recursive: true });
	await mkdir(freeDir, { recursive: true });

	const browser = await chromium.launch({
		channel: 'chrome',
		headless: true
	});

	const scheduleNotes = await captureSchedule(browser);
	const freeNotes = await captureFreeTime(browser);

	await browser.close();

	await writeFile(
		path.join(scheduleDir, 'NOTES.md'),
		scheduleNotes,
		'utf8'
	);
	await writeFile(path.join(freeDir, 'NOTES.md'), freeNotes, 'utf8');
	await rm(tmpRoot, { recursive: true, force: true });
	console.log('\nDone.');
}

/** @param {import('@playwright/test').Browser} browser */
async function captureSchedule(browser) {
	const videoDir = path.join(tmpRoot, 'schedule-video');
	await mkdir(videoDir, { recursive: true });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL
	});
	const page = await context.newPage();
	const log = /** @type {Array<{t:number,label:string}>} */ ([]);
	const bugs = /** @type {string[]} */ ([]);

	await page.addInitScript(() => {
		localStorage.setItem('maritools.omnivox-tutorial.dismissed', '1');
	});

	const t0 = Date.now();
	await page.goto('/tools/schedule', { waitUntil: 'networkidle' });
	await mark(page, t0, log, 'empty schedule first viewport (centered import CTA)');

	const emptyCta = page.getByRole('button', { name: 'Import Omnivox' }).first();
	const emptyCopy = page.getByText('Import your Omnivox schedule');
	const emptyVisible =
		(await emptyCta.isVisible()) && (await emptyCopy.isVisible());
	if (!emptyVisible) bugs.push('empty first viewport missing centered import CTA');

	// CTA must sit in the first viewport (not below the fold)
	const ctaBox = await emptyCta.boundingBox();
	if (!ctaBox || ctaBox.y > 720) {
		bugs.push(`import CTA not in first viewport (y=${ctaBox?.y})`);
	}

	await page.screenshot({ path: path.join(scheduleDir, 'empty-1280.png'), fullPage: false });
	await page.screenshot({ path: path.join(scheduleDir, 'empty-verify.png'), fullPage: false });
	await mark(page, t0, log, 'captured empty-verify.png (CTA in viewport)');

	await emptyCta.click();
	await mark(page, t0, log, 'opened import drawer');

	await page.getByLabel('Omnivox course list').fill(CANONICAL_OMNIVOX_SCHEDULE);
	await mark(page, t0, log, 'pasted canonical Omnivox list');

	await page.getByRole('button', { name: 'Read schedule' }).click();
	const parseCount = page.locator('.parse-count');
	await parseCount.waitFor({ state: 'visible' });
	const parseText = (await parseCount.textContent())?.trim() ?? '';
	const color = await parseCount.evaluate((el) => getComputedStyle(el).color);
	const rgb = color.match(/\d+/g)?.map(Number) ?? [];
	const isGreen = rgb.length >= 3 && rgb[1] > rgb[0] && rgb[1] > rgb[2];
	if (!/classes detected/i.test(parseText)) bugs.push(`parse status text unexpected: ${parseText}`);
	if (!isGreen) bugs.push(`parse-count not success green (color=${color})`);
	await mark(
		page,
		t0,
		log,
		`post-parse status on camera: "${parseText}" color=${color} green=${isGreen}`
	);
	// Hold so green status is readable on camera before drawer may close
	await sleep(1500);

	const calendar = page.getByLabel('Weekly course schedule');
	await calendar.waitFor({ state: 'visible' });
	await mark(page, t0, log, 'calendar populated with courses');
	await page.screenshot({ path: path.join(scheduleDir, 'schedule-final.png'), fullPage: false });
	await sleep(800);

	await page.getByRole('button', { name: 'Show tutorial again' }).click();
	await sleep(600);
	await page.screenshot({ path: path.join(scheduleDir, 'tutorial-1280.png'), fullPage: false });
	await mark(page, t0, log, 'tutorial overlay visible');

	await context.close();

	const mobile = await browser.newContext({
		viewport: { width: 390, height: 844 },
		baseURL
	});
	const mpage = await mobile.newPage();
	await mpage.addInitScript(() => {
		localStorage.setItem('maritools.omnivox-tutorial.dismissed', '1');
	});
	await mpage.goto('/tools/schedule', { waitUntil: 'networkidle' });
	await mpage.screenshot({ path: path.join(scheduleDir, 'empty-390.png'), fullPage: false });
	await mobile.close();

	const videos = await listWebms(videoDir);
	const mainVideo = videos.sort((a, b) => b.size - a.size)[0];
	if (!mainVideo) throw new Error('No schedule webm produced');
	await copyFile(mainVideo.path, path.join(scheduleDir, 'schedule-flow.webm'));

	const notes = `# Schedule verification (recapture)

## Functional: ${bugs.length ? 'FAIL' : 'PASS'}
- Empty first viewport with centered import CTA
- Parse shows \`N classes detected\` in success green, then calendar populated
- Continuous video on \`/tools/schedule\`

## On-camera moments (schedule-flow.webm)
${log.map((e) => `- **${e.t.toFixed(2)}s** ${e.label}`).join('\n')}

## Artifacts
- Video: \`.artifacts/verify-mariTools/schedule/schedule-flow.webm\`
- Screens: \`empty-1280.png\`, \`empty-390.png\`, \`empty-verify.png\`, \`tutorial-1280.png\`, \`schedule-final.png\`

## Bugs found this run
${bugs.length ? bugs.map((b) => `- ${b}`).join('\n') : '- none'}

## Base
- ${baseURL}
- Claimed commit: \`4e645d6\`
`;
	console.log('Schedule bugs:', bugs.length ? bugs : 'none');
	return notes;
}

/** @param {import('@playwright/test').Browser} browser */
async function captureFreeTime(browser) {
	const videoDir = path.join(tmpRoot, 'free-video');
	await mkdir(videoDir, { recursive: true });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL
	});
	const page = await context.newPage();
	const log = /** @type {Array<{t:number,label:string}>} */ ([]);
	const bugs = /** @type {string[]} */ ([]);
	const boardTitle = `Proof board ${Date.now()}`;

	const t0 = Date.now();
	await page.goto('/tools/free-time', { waitUntil: 'networkidle' });
	await mark(page, t0, log, 'free-time index');
	await page.screenshot({ path: path.join(freeDir, 'index-1280.png'), fullPage: false });

	await page.getByLabel('Board title').fill(boardTitle);
	await page.getByRole('button', { name: 'Create board' }).click();
	await page.waitForURL(/\/tools\/free-time\/[^/]+/);
	const boardUrl = page.url();
	await mark(page, t0, log, `created board ${boardUrl}`);
	await page.locator('.paint-cell').first().waitFor({ state: 'visible' });

	const saveButtons = page.getByRole('button', { name: 'Save availability' });
	const saveCount = await saveButtons.count();
	if (saveCount !== 1) bugs.push(`expected 1 Save availability button, found ${saveCount}`);

	// Paint overlapping Monday morning band for member 1
	const cells1 = ['Mon-09:00', 'Mon-09:30', 'Mon-10:00', 'Tue-11:00', 'Tue-11:30'];
	for (const key of cells1) {
		await page.locator(`.paint-cell[data-cell="${key}"]`).click();
	}
	await mark(page, t0, log, `member1 painted ${cells1.length} cells`);

	await page.getByPlaceholder('How others will see you').fill('Alex');
	await saveButtons.click();
	await page.getByText('Availability saved.').waitFor({ state: 'visible' });
	await page.getByText('1 saved').waitFor({ state: 'visible' });
	await mark(page, t0, log, 'Save → Members shows "1 saved" + "Availability saved."');
	await page.screenshot({
		path: path.join(freeDir, 'board-after-save-1280.png'),
		fullPage: false
	});

	// Second member on SAME board: clear share token, new name, overlapping paint
	await page.evaluate(() => {
		for (const k of Object.keys(localStorage)) {
			if (k.startsWith('maritools.free-time.')) localStorage.removeItem(k);
		}
	});
	await page.reload({ waitUntil: 'networkidle' });
	await mark(page, t0, log, 'reloaded same board as second member (token cleared)');

	const saveButtons2 = page.getByRole('button', { name: 'Save availability' });
	if ((await saveButtons2.count()) !== 1) {
		bugs.push(`after reload: expected 1 Save button, found ${await saveButtons2.count()}`);
	}

	const cells2 = ['Mon-09:00', 'Mon-09:30', 'Mon-10:00', 'Wed-14:00', 'Wed-14:30'];
	for (const key of cells2) {
		await page.locator(`.paint-cell[data-cell="${key}"]`).click();
	}
	await page.getByPlaceholder('How others will see you').fill('Blake');
	await saveButtons2.click();
	await page.getByText('Availability saved.').waitFor({ state: 'visible' });
	await page.getByText('2 saved').waitFor({ state: 'visible' });
	await mark(page, t0, log, 'second member saved on same board');

	const common = page.locator('.paint-cell.common');
	await common.first().waitFor({ state: 'visible', timeout: 10000 });
	const commonCount = await common.count();
	if (commonCount < 1) bugs.push('no common free cells after two saves');
	await mark(
		page,
		t0,
		log,
		`green Common free bands visible (${commonCount} cells)`
	);
	await page.screenshot({
		path: path.join(freeDir, 'common-overlap-1280.png'),
		fullPage: false
	});
	await page.screenshot({
		path: path.join(freeDir, 'free-time-final.png'),
		fullPage: false
	});

	// stay on same URL for proof continuity
	if (!page.url().startsWith(boardUrl.split('?')[0])) {
		bugs.push(`board URL changed mid-flow: ${page.url()} vs ${boardUrl}`);
	}

	await context.close();

	// mobile board shot
	const mobile = await browser.newContext({
		viewport: { width: 390, height: 844 },
		baseURL
	});
	const mpage = await mobile.newPage();
	await mpage.goto(boardUrl, { waitUntil: 'networkidle' });
	await mpage.screenshot({ path: path.join(freeDir, 'board-390.png'), fullPage: false });
	await mobile.close();

	const videos = await listWebms(videoDir);
	const mainVideo = videos.sort((a, b) => b.size - a.size)[0];
	if (!mainVideo) throw new Error('No free-time webm produced');
	await copyFile(mainVideo.path, path.join(freeDir, 'free-time-flow.webm'));

	const notes = `# Free-time verification (recapture)

## Functional: ${bugs.length ? 'FAIL' : 'PASS'}
- ONE board continuous: paint → Save → \`1 saved\` + \`Availability saved.\`
- Second member on same board → green Common free bands
- Single Save availability control

## On-camera moments (free-time-flow.webm)
${log.map((e) => `- **${e.t.toFixed(2)}s** ${e.label}`).join('\n')}

## Board
- ${boardUrl}

## Artifacts
- Video: \`.artifacts/verify-mariTools/free-time/free-time-flow.webm\`
- Screens: \`index-1280.png\`, \`board-after-save-1280.png\`, \`common-overlap-1280.png\`, \`board-390.png\`, \`free-time-final.png\`

## Bugs found this run
${bugs.length ? bugs.map((b) => `- ${b}`).join('\n') : '- none'}

## Base
- ${baseURL}
- Claimed commit: \`4e645d6\`
`;
	console.log('Free-time bugs:', bugs.length ? bugs : 'none');
	return notes;
}

/** @param {string} dir */
async function listWebms(dir) {
	const { readdir, stat } = await import('node:fs/promises');
	const names = await readdir(dir);
	const out = [];
	for (const name of names) {
		if (!name.endsWith('.webm')) continue;
		const p = path.join(dir, name);
		const s = await stat(p);
		out.push({ path: p, size: s.size });
	}
	return out;
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
