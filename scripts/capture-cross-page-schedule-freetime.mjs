/**
 * Cross-page Schedule → Free-time proof.
 * Parse Omnivox on /tools/schedule, then import the same paste on a complementary
 * free-time board; assert week switch keeps paint and reload restores editor state.
 * Usage: node scripts/capture-cross-page-schedule-freetime.mjs [baseUrl]
 */
import { chromium } from '@playwright/test';
import { copyFile, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_OMNIVOX_SCHEDULE } from '../src/lib/maritools/schedule/fixture.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const baseURL = process.argv[2] || 'http://127.0.0.1:5174';
const outDir = path.join(root, '.artifacts/verify-mariTools/cross-page');
const tmpRoot = path.join(root, '.artifacts/verify-mariTools/_capture-tmp-cross-sched');
const BOARD_TITLE = `Cross SchedFT ${Date.now().toString(36)}`;

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
	await page.evaluate((text) => {
		let hud = document.getElementById('verify-hud');
		if (!hud) {
			hud = document.createElement('div');
			hud.id = 'verify-hud';
			hud.setAttribute(
				'style',
				[
					'position:fixed',
					'top:8px',
					'left:8px',
					'z-index:2147483647',
					'background:#0b1220',
					'color:#f8fafc',
					'padding:6px 10px',
					'font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace',
					'max-width:72vw',
					'pointer-events:none',
					'border:1px solid #334155'
				].join(';')
			);
			document.body.appendChild(hud);
		}
		hud.textContent = `${location.pathname} · ${text}`;
	}, label);
	await sleep(750);
}

/** @param {string} dir */
async function listWebms(dir) {
	const names = await readdir(dir);
	const out = [];
	for (const name of names) {
		if (!name.endsWith('.webm')) continue;
		const full = path.join(dir, name);
		out.push({ path: full, size: (await stat(full)).size });
	}
	return out;
}

async function main() {
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(tmpRoot, { recursive: true });
	await mkdir(outDir, { recursive: true });

	const videoDir = path.join(tmpRoot, 'video');
	await mkdir(videoDir, { recursive: true });

	const browser = await chromium.launch({ channel: 'chrome', headless: true });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL
	});
	const page = await context.newPage();
	const log = /** @type {Array<{t:number,label:string}>} */ ([]);
	const bugs = /** @type {string[]} */ ([]);
	const t0 = Date.now();

	await page.addInitScript(() => {
		localStorage.setItem('maritools.omnivox-tutorial.dismissed', '1');
	});

	// A1. Schedule parse
	await page.goto('/tools/schedule', { waitUntil: 'domcontentloaded' });
	await page.evaluate(() => localStorage.setItem('maritools.omnivox-tutorial.dismissed', '1'));
	await page.goto('/tools/schedule', { waitUntil: 'networkidle' });
	await mark(page, t0, log, 'schedule empty');
	const skipTutorial = page.getByRole('button', { name: /Skip|Got it|Close tutorial/i });
	if (await skipTutorial.count()) {
		await skipTutorial.first().click().catch(() => {});
	}
	await page.getByRole('button', { name: 'Import Omnivox' }).first().click();
	const pasteBox = page.getByLabel('Omnivox course list');
	await pasteBox.waitFor({ state: 'visible', timeout: 10000 });
	await pasteBox.fill(CANONICAL_OMNIVOX_SCHEDULE);
	await page.getByRole('button', { name: 'Read schedule' }).click();
	const parseCount = page.locator('.parse-count');
	const calendar = page.getByLabel('Weekly course schedule');
	try {
		await Promise.race([
			parseCount.waitFor({ state: 'visible', timeout: 15000 }),
			calendar.waitFor({ state: 'visible', timeout: 15000 })
		]);
	} catch {
		await page.screenshot({ path: path.join(outDir, 'schedule-parse-fail.png'), fullPage: true });
		bugs.push('schedule parse neither status nor calendar appeared');
	}
	const parseText = (await parseCount.textContent().catch(() => ''))?.trim() ?? '';
	if (parseText && !/classes detected/i.test(parseText)) {
		bugs.push(`schedule parse unexpected: ${parseText}`);
	}
	if ((await calendar.count()) === 0) bugs.push('schedule calendar missing after parse');
	await mark(page, t0, log, `schedule parsed: ${parseText || 'calendar visible'}`);
	await page.screenshot({ path: path.join(outDir, 'schedule-parsed.png'), fullPage: false });

	// A2. Free-time board with complementary slug
	await page.goto('/tools/free-time', { waitUntil: 'networkidle' });
	await mark(page, t0, log, 'free-time index');
	if (await page.getByText(/Boards are unavailable/i).count()) {
		bugs.push('free-time boards unavailable');
	}
	await page.locator('input[name="title"]').fill(BOARD_TITLE);
	await page.getByRole('button', { name: 'Create board' }).click();
	try {
		await page.waitForURL(/\/tools\/free-time\/[^/]+/, { timeout: 20000 });
	} catch {
		const err = (await page.getByRole('alert').textContent().catch(() => '')) ?? '';
		bugs.push(`board create failed: ${err || page.url()}`);
		await page.screenshot({ path: path.join(outDir, 'board-create-fail.png'), fullPage: true });
		throw new Error(`board create failed: ${err || page.url()}`);
	}
	const boardUrl = page.url();
	await mark(page, t0, log, `created board ${boardUrl}`);
	await page.locator('.paint-cell').first().waitFor({ state: 'visible' });

	const importToggle = page.getByRole('button', { name: 'Import Omnivox' });
	await importToggle.scrollIntoViewIfNeeded();
	await importToggle.click();
	const omnivoxBox = page.getByLabel('Omnivox course list');
	await omnivoxBox.scrollIntoViewIfNeeded();
	await omnivoxBox.fill(CANONICAL_OMNIVOX_SCHEDULE);
	const readBtn = page.getByRole('button', { name: 'Read schedule' });
	await readBtn.scrollIntoViewIfNeeded();
	await readBtn.click({ force: true });
	await sleep(500);
	if (await page.getByRole('alert').count()) {
		const err = (await page.getByRole('alert').first().textContent()) ?? '';
		bugs.push(`free-time Omnivox import failed: ${err}`);
	}
	const painted = await page.locator('.paint-cell[aria-pressed="true"]').count();
	if (painted < 10) bugs.push(`import painted too few free cells (${painted})`);
	await mark(page, t0, log, `imported Omnivox into grid (freeCells≈${painted})`);

	const nameField = page.getByPlaceholder('How others will see you');
	await nameField.scrollIntoViewIfNeeded();
	await nameField.fill('CrossSched');
	const saveBtn = page.getByRole('button', { name: 'Save availability' });
	await saveBtn.scrollIntoViewIfNeeded();
	await saveBtn.click();
	try {
		await page.getByText('Availability saved.').waitFor({ state: 'visible', timeout: 15000 });
		await page.getByText('1 saved').waitFor({ state: 'visible', timeout: 10000 });
	} catch {
		const body = await page.locator('body').innerText();
		bugs.push(`save did not confirm (snippet=${body.slice(0, 240)})`);
		await page.screenshot({ path: path.join(outDir, 'save-fail.png'), fullPage: true });
	}
	await mark(page, t0, log, 'saved availability after schedule import');

	const headingBefore = (await page.locator('.utility-bar h1').textContent())?.trim() ?? '';
	await page.getByRole('button', { name: 'Next week' }).click();
	await sleep(500);
	const headingNext = (await page.locator('.utility-bar h1').textContent())?.trim() ?? '';
	if (headingNext === headingBefore) bugs.push('next-week did not change heading');
	const paintedAfterWeek = await page.locator('.paint-cell[aria-pressed="true"]').count();
	if (paintedAfterWeek < 10) bugs.push(`week switch wiped paint (${paintedAfterWeek})`);
	await mark(page, t0, log, `next week "${headingNext}" paint kept (${paintedAfterWeek})`);

	await page.getByRole('button', { name: 'Previous week' }).click();
	await sleep(300);
	await page.getByRole('button', { name: 'Today' }).click();
	await sleep(300);
	const headingToday = (await page.locator('.utility-bar h1').textContent())?.trim() ?? '';
	await mark(page, t0, log, `restored today heading "${headingToday}"`);

	// A3. Reload restore
	const tokenBefore = await page.evaluate(() => {
		const keys = Object.keys(localStorage).filter((k) => k.startsWith('maritools.free-time.'));
		return keys.map((k) => [k, localStorage.getItem(k)]);
	});
	if (tokenBefore.length === 0) bugs.push('no free-time share token in localStorage after save');
	await page.reload({ waitUntil: 'networkidle' });
	await page.locator('.paint-cell').first().waitFor({ state: 'visible' });
	await sleep(800);
	const nameAfter = await page.getByPlaceholder('How others will see you').inputValue();
	const paintedAfterReload = await page.locator('.paint-cell[aria-pressed="true"]').count();
	if (nameAfter !== 'CrossSched') bugs.push(`restore displayName got "${nameAfter}"`);
	if (paintedAfterReload < 10) bugs.push(`restore did not repaint cells (${paintedAfterReload})`);
	await mark(
		page,
		t0,
		log,
		`reload restore name="${nameAfter}" freeCells≈${paintedAfterReload}`
	);
	await page.screenshot({ path: path.join(outDir, 'board-restored.png'), fullPage: false });

	await context.close();
	await browser.close();

	const videos = await listWebms(videoDir);
	videos.sort((a, b) => b.size - a.size);
	if (!videos[0]) throw new Error('no webm');
	const dest = path.join(outDir, 'schedule-freetime.webm');
	await copyFile(videos[0].path, dest);

	const pass = bugs.length === 0;
	const notes = `# Schedule ↔ Free-time cross-page

## Result: ${pass ? 'PASS' : 'FAIL'}
- Board: ${boardUrl}
- Title: ${BOARD_TITLE}
- Base: ${baseURL}

## On-camera moments
${log.map((e) => `- **${e.t.toFixed(2)}s** ${e.label}`).join('\n')}

## Bugs
${bugs.length ? bugs.map((b) => `- ${b}`).join('\n') : '- none'}

## Artifacts
- \`.artifacts/verify-mariTools/cross-page/schedule-freetime.webm\`
- \`schedule-parsed.png\`, \`board-restored.png\`
`;
	await writeFile(path.join(outDir, 'NOTES-schedule-freetime.md'), notes, 'utf8');
	await writeFile(
		path.join(outDir, 'schedule-freetime.json'),
		JSON.stringify({ pass, bugs, log, boardUrl, video: dest }, null, 2),
		'utf8'
	);
	await rm(tmpRoot, { recursive: true, force: true });
	console.log(notes);
	if (!pass) process.exitCode = 1;
}

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
