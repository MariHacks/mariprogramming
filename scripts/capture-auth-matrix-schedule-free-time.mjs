/**
 * Guest vs signed-in auth matrix for Schedule + Free-time (auth-sensitive only).
 * Complements deep free-time week testing; does not exercise week-matrix restore.
 *
 * Usage: node scripts/capture-auth-matrix-schedule-free-time.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:5174
 */
import { chromium } from '@playwright/test';
import { makeSignature } from 'better-auth/crypto';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { CANONICAL_OMNIVOX_SCHEDULE } from '../src/lib/maritools/schedule/fixture.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const baseURL = process.argv[2] || 'http://127.0.0.1:5174';
const outRoot = path.join(root, '.artifacts/verify-mariTools/auth-matrix');
const scheduleDir = path.join(outRoot, 'schedule');
const freeDir = path.join(outRoot, 'free-time');
const tmpRoot = path.join(outRoot, '_capture-tmp');
const NICK_EMAIL = 'nick.zhicheng@gmail.com';
const GUEST_NAME = `MayaGuest${Date.now().toString(36).slice(-4)}`;

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
	await sleep(600);
}

/** @param {string} filePath */
async function loadEnvLocal(filePath) {
	const raw = await readFile(filePath, 'utf8');
	for (const line of raw.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eq = trimmed.indexOf('=');
		if (eq <= 0) continue;
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (!(key in process.env)) process.env[key] = value;
	}
}

async function mintNickStorageState() {
	await loadEnvLocal(path.join(root, '.env.local'));
	const secret = process.env.BETTER_AUTH_SECRET;
	const databaseUrl = process.env.DATABASE_URL;
	if (!secret || !databaseUrl) throw new Error('BETTER_AUTH_SECRET or DATABASE_URL missing');

	const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
	try {
		const user = await pool.query('select id, email from "user" where email = $1 limit 1', [
			NICK_EMAIL
		]);
		if (!user.rows[0]) throw new Error(`${NICK_EMAIL} not in user table`);
		const userId = user.rows[0].id;
		const profile = await pool.query(
			`select student_id, display_name, nim_disclosure_accepted_at is not null as nim
			 from mt_student_profiles where user_id = $1`,
			[userId]
		);
		if (!profile.rows[0]?.nim) {
			throw new Error(`${NICK_EMAIL} profile incomplete (need student id + NIM)`);
		}

		const token = `authMx${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
		const id = `authMxSess${Date.now().toString(36)}`;
		await pool.query(
			`insert into session (id, token, user_id, expires_at, created_at, updated_at)
			 values ($1, $2, $3, now() + interval '7 days', now(), now())`,
			[id, token, userId]
		);
		const signed = `${token}.${await makeSignature(token, secret)}`;
		return {
			cookies: [
				{
					name: 'mari-staff.session_token',
					value: signed,
					domain: '127.0.0.1',
					path: '/',
					httpOnly: true,
					secure: false,
					sameSite: 'Lax'
				}
			],
			origins: [],
			displayName: profile.rows[0].display_name || NICK_EMAIL.split('@')[0]
		};
	} finally {
		await pool.end();
	}
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

/**
 * @param {import('@playwright/test').Browser} browser
 * @param {import('@playwright/test').BrowserContextOptions['storageState'] | undefined} storageState
 * @param {string} videoDir
 * @param {(page: import('@playwright/test').Page, t0: number, log: Array<{t:number,label:string}>, bugs: string[]) => Promise<void>} drive
 */
async function withVideo(browser, storageState, videoDir, drive) {
	await mkdir(videoDir, { recursive: true });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL,
		...(storageState ? { storageState } : {})
	});
	const page = await context.newPage();
	const log = /** @type {Array<{t:number,label:string}>} */ ([]);
	const bugs = /** @type {string[]} */ ([]);
	const t0 = Date.now();
	try {
		await drive(page, t0, log, bugs);
	} finally {
		await context.close();
	}
	const videos = await listWebms(videoDir);
	const mainVideo = videos.sort((a, b) => b.size - a.size)[0];
	if (!mainVideo) throw new Error(`No webm in ${videoDir}`);
	return { log, bugs, videoPath: mainVideo.path };
}

async function main() {
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(scheduleDir, { recursive: true });
	await mkdir(freeDir, { recursive: true });
	await mkdir(tmpRoot, { recursive: true });

	const nick = await mintNickStorageState();
	const { displayName: accountName, ...storageState } = nick;
	await writeFile(
		path.join(outRoot, 'storageState.json'),
		JSON.stringify(storageState, null, 2),
		'utf8'
	);

	const browser = await chromium.launch({ channel: 'chrome', headless: true });
	/** @type {Array<{case:string, pass:boolean, video:string, bugs:string[], moments:Array<{t:number,label:string}>}>} */
	const matrix = [];

	{
		const result = await withVideo(
			browser,
			undefined,
			path.join(tmpRoot, 'schedule-guest'),
			async (page, t0, log, bugs) => {
				await page.addInitScript(() => {
					localStorage.setItem('maritools.omnivox-tutorial.dismissed', '1');
				});
				await page.goto('/tools/schedule', { waitUntil: 'networkidle' });
				await mark(page, t0, log, 'guest schedule empty');

				await page.getByRole('button', { name: 'Import Omnivox' }).first().click();
				await page.getByLabel('Omnivox course list').fill(CANONICAL_OMNIVOX_SCHEDULE);
				await page.getByRole('button', { name: 'Read schedule' }).click();
				await page.getByLabel('Weekly course schedule').waitFor({ state: 'visible' });
				await mark(page, t0, log, 'guest parsed calendar without account');

				const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
				await page.getByRole('button', { name: 'Add to Google Calendar' }).click();
				await mark(page, t0, log, 'opened export modal as guest');

				const body = await page.locator('.calendar-modal').innerText();
				if (/Connect Google Calendar/i.test(body)) {
					bugs.push('guest export modal shows Connect Google Calendar (should be gated)');
				}
				if (!/Download for Google Calendar/i.test(body)) {
					bugs.push('guest export modal missing ICS download CTA');
				}

				await page.getByRole('button', { name: 'Download for Google Calendar' }).click();
				const download = await downloadPromise;
				const icsPath = path.join(scheduleDir, 'guest-maritools-schedule.ics');
				await download.saveAs(icsPath);
				const ics = await readFile(icsPath, 'utf8');
				if (!/BEGIN:VCALENDAR/.test(ics)) bugs.push('guest ICS missing VCALENDAR');
				await mark(page, t0, log, `guest ICS downloaded (${ics.length} bytes)`);

				await page.screenshot({
					path: path.join(scheduleDir, 'guest-export-1280.png'),
					fullPage: false
				});
				await sleep(700);
			}
		);
		const dest = path.join(scheduleDir, 'guest.webm');
		await copyFile(result.videoPath, dest);
		matrix.push({
			case: 'schedule/guest',
			pass: result.bugs.length === 0,
			video: dest,
			bugs: result.bugs,
			moments: result.log
		});
	}

	{
		const result = await withVideo(
			browser,
			storageState,
			path.join(tmpRoot, 'schedule-signed-in'),
			async (page, t0, log, bugs) => {
				await page.addInitScript(() => {
					localStorage.setItem('maritools.omnivox-tutorial.dismissed', '1');
				});
				await page.goto('/tools/schedule', { waitUntil: 'networkidle' });
				await mark(page, t0, log, 'signed-in schedule');

				const accountChip = await page.locator('body').innerText();
				if (/Continue with Google/i.test(accountChip) && /Sign out/i.test(accountChip) === false) {
					// header may only show account link; soft check via connect gate below
				}

				await page.getByRole('button', { name: 'Import Omnivox' }).first().click();
				await page.getByLabel('Omnivox course list').fill(CANONICAL_OMNIVOX_SCHEDULE);
				await page.getByRole('button', { name: 'Read schedule' }).click();
				await page.getByLabel('Weekly course schedule').waitFor({ state: 'visible' });
				await mark(page, t0, log, 'signed-in parsed calendar');

				await page.getByRole('button', { name: 'Add to Google Calendar' }).click();
				await page.locator('.calendar-modal').waitFor({ state: 'visible' });
				await mark(page, t0, log, 'opened export modal signed-in');

				const modal = page.locator('.calendar-modal');
				const modalText = await modal.innerText();
				const hasConnect = /Connect Google Calendar/i.test(modalText);
				const hasPush = /Push to Google Calendar/i.test(modalText);

				if (hasConnect) {
					await mark(page, t0, log, 'Connect Google Calendar CTA present (no grant)');
					const href = await page
						.getByRole('link', { name: 'Connect Google Calendar' })
						.getAttribute('href');
					if (href !== '/tools/schedule/google-calendar/connect') {
						bugs.push(`Connect href unexpected: ${href}`);
					}
					const [response] = await Promise.all([
						page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(
							() => null
						),
						page.getByRole('link', { name: 'Connect Google Calendar' }).click()
					]);
					const url = page.url();
					await mark(page, t0, log, `after Connect click → ${url}`);
					const okGate =
						/accounts\.google\.com|google\.com\/o\/oauth|\/tools\/account|gcal=/i.test(url) ||
						Boolean(response);
					if (!okGate && !/authorize|oauth|account/i.test(url)) {
						bugs.push(`Connect did not reach OAuth or account gate (url=${url})`);
					}
				} else if (hasPush) {
					await mark(page, t0, log, 'Push to Google Calendar enabled (grant present)');
					if (!/Push this semester into Google Calendar/i.test(modalText)) {
						bugs.push('connected modal missing push copy');
					}
				} else {
					bugs.push('signed-in modal missing both Connect and Push CTAs');
				}

				await page.screenshot({
					path: path.join(scheduleDir, 'signed-in-export-1280.png'),
					fullPage: false
				});
				await sleep(700);
			}
		);
		const dest = path.join(scheduleDir, 'signed-in.webm');
		await copyFile(result.videoPath, dest);
		matrix.push({
			case: 'schedule/signed-in',
			pass: result.bugs.length === 0,
			video: dest,
			bugs: result.bugs,
			moments: result.log
		});
	}

	const boardTitle = `Auth matrix ${Date.now().toString(36)}`;
	/** @type {string} */
	let boardUrl = '';

	{
		const result = await withVideo(
			browser,
			undefined,
			path.join(tmpRoot, 'free-guest'),
			async (page, t0, log, bugs) => {
				await page.goto('/tools/free-time', { waitUntil: 'networkidle' });
				await page.getByLabel('Board title').fill(boardTitle);
				await page.getByRole('button', { name: 'Create board' }).click();
				await page.waitForURL(/\/tools\/free-time\/[^/]+/);
				boardUrl = page.url();
				await mark(page, t0, log, `guest created board ${boardUrl}`);

				await page.locator('.paint-cell').first().waitFor({ state: 'visible' });
				for (const key of ['Mon-09:00', 'Mon-09:30', 'Tue-11:00']) {
					await page.locator(`.paint-cell[data-cell="${key}"]`).click();
				}
				await page.getByPlaceholder('How others will see you').fill(GUEST_NAME);
				await mark(page, t0, log, `guest display name ${GUEST_NAME}`);

				const editing = await page.locator('.editing-as').innerText();
				if (!/Guest/i.test(editing) || !editing.includes(GUEST_NAME)) {
					bugs.push(`guest editing label wrong: ${editing}`);
				}

				await page.getByRole('button', { name: 'Save availability' }).click();
				await page.getByText('Availability saved.').waitFor({ state: 'visible' });
				await page.getByText(GUEST_NAME).waitFor({ state: 'visible' });
				await mark(page, t0, log, 'guest saved and appears in Members');

				await page.screenshot({
					path: path.join(freeDir, 'guest-member-1280.png'),
					fullPage: false
				});
				await sleep(700);
			}
		);
		const dest = path.join(freeDir, 'guest.webm');
		await copyFile(result.videoPath, dest);
		matrix.push({
			case: 'free-time/guest',
			pass: result.bugs.length === 0,
			video: dest,
			bugs: result.bugs,
			moments: result.log
		});
	}

	{
		const result = await withVideo(
			browser,
			storageState,
			path.join(tmpRoot, 'free-signed-in'),
			async (page, t0, log, bugs) => {
				if (!boardUrl) throw new Error('boardUrl missing from guest pass');
				await page.goto(boardUrl, { waitUntil: 'networkidle' });
				await mark(page, t0, log, 'signed-in opened same board');

				await page.evaluate(() => {
					for (const key of Object.keys(localStorage)) {
						if (key.startsWith('maritools.free-time.')) localStorage.removeItem(key);
					}
				});
				await page.reload({ waitUntil: 'networkidle' });
				await mark(page, t0, log, 'cleared guest share token for signed-in member');

				const nameInput = page.getByPlaceholder('How others will see you');
				await nameInput.waitFor({ state: 'visible' });
				const prefilled = (await nameInput.inputValue()).trim();
				if (!prefilled) {
					bugs.push('signed-in display name not prefilled');
				} else {
					await mark(page, t0, log, `signed-in prefilled as ${prefilled}`);
				}
				const expected = String(accountName || prefilled).trim();
				if (prefilled && expected && prefilled !== expected) {
					log.push({
						t: Number(((Date.now() - t0) / 1000).toFixed(2)),
						label: `note: prefill ${prefilled} vs profile ${expected}`
					});
				}

				const editing = await page.locator('.editing-as').innerText();
				if (/Guest/i.test(editing)) bugs.push(`signed-in still labeled Guest: ${editing}`);
				if (!/signed in/i.test(editing)) {
					bugs.push(`signed-in editing label missing account cue: ${editing}`);
				}

				for (const key of ['Mon-09:00', 'Wed-14:00', 'Wed-14:30']) {
					await page.locator(`.paint-cell[data-cell="${key}"]`).click();
				}
				await page.getByRole('button', { name: 'Save availability' }).click();
				await page.getByText('Availability saved.').waitFor({ state: 'visible' });
				await mark(page, t0, log, 'signed-in saved availability');

				const members = await page.locator('.members').innerText();
				if (!members.includes(GUEST_NAME)) {
					bugs.push(`Members missing guest ${GUEST_NAME}`);
				}
				const accountLabel = prefilled || expected;
				if (!members.includes(accountLabel)) {
					bugs.push(`Members missing signed-in ${accountLabel}`);
				}
				if (!/Account/i.test(members)) {
					bugs.push('Members list missing Account badge for signed-in identity');
				}
				if (members.includes(GUEST_NAME) && members.includes(accountLabel)) {
					await mark(page, t0, log, `Members distinctly list ${GUEST_NAME} + ${accountLabel}`);
				}

				await page.screenshot({
					path: path.join(freeDir, 'signed-in-members-1280.png'),
					fullPage: false
				});
				await sleep(900);
			}
		);
		const dest = path.join(freeDir, 'signed-in.webm');
		await copyFile(result.videoPath, dest);
		matrix.push({
			case: 'free-time/signed-in',
			pass: result.bugs.length === 0,
			video: dest,
			bugs: result.bugs,
			moments: result.log
		});
	}

	await browser.close();

	const notes = `# Auth matrix · Schedule + Free-time

Base: ${baseURL}
Session: ${NICK_EMAIL}
Guest member: ${GUEST_NAME}
Board: ${boardUrl || '(none)'}

## Matrix
${matrix
	.map(
		(m) =>
			`- **${m.case}**: ${m.pass ? 'PASS' : 'FAIL'} → \`${path.relative(root, m.video)}\`${
				m.bugs.length ? `\n  - bugs: ${m.bugs.join('; ')}` : ''
			}`
	)
	.join('\n')}

## On-camera moments
${matrix
	.map(
		(m) =>
			`### ${m.case}\n${m.moments.map((e) => `- **${e.t.toFixed(2)}s** ${e.label}`).join('\n')}`
	)
	.join('\n\n')}
`;

	await writeFile(path.join(outRoot, 'NOTES.md'), notes, 'utf8');
	await writeFile(path.join(outRoot, 'matrix.json'), JSON.stringify(matrix, null, 2), 'utf8');
	await writeFile(path.join(scheduleDir, 'NOTES.md'), notes, 'utf8');
	await writeFile(path.join(freeDir, 'NOTES.md'), notes, 'utf8');
	await rm(tmpRoot, { recursive: true, force: true });
	console.log(notes);
	if (matrix.some((m) => !m.pass)) process.exitCode = 1;
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
