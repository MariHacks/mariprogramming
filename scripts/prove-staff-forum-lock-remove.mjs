/**
 * Staff forum Lock + Remove live proof (team@marihacks.com via Better Auth mint).
 * Usage: node scripts/prove-staff-forum-lock-remove.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:5174
 *
 * Fail conditions:
 * - Lock does not show "Thread locked." / reply composer still present
 * - Remove does not yield "That thread is not available." / title still listed
 */
import { chromium } from '@playwright/test';
import { makeSignature } from 'better-auth/crypto';
import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const baseURL = process.argv[2] || 'http://127.0.0.1:5174';
const outDir = path.join(root, '.artifacts/verify-mariTools/forum-lock-remove');
const tmpRoot = path.join(root, '.artifacts/verify-mariTools/_capture-tmp-forum-lock-remove');
const STAFF_EMAIL = 'team@marihacks.com';
const VIDEO_NAME = 'staff-forum-lock-remove.webm';

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} t0
 * @param {Array<{t:number,label:string}>} log
 * @param {string} label
 * @param {number} [dwellMs]
 */
async function mark(page, t0, log, label, dwellMs = 700) {
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
		hud.textContent = `${location.pathname}${location.search} · ${text}`;
	}, label);
	await sleep(dwellMs);
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

async function mintStaffStorageState() {
	await loadEnvLocal(path.join(root, '.env.local'));
	const secret = process.env.BETTER_AUTH_SECRET;
	const databaseUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
	if (!secret || !databaseUrl) throw new Error('BETTER_AUTH_SECRET or DATABASE_URL missing');

	const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
	try {
		const user = await pool.query(
			`select id, email from "user" where lower(email) = lower($1) limit 1`,
			[STAFF_EMAIL]
		);
		if (!user.rows[0]) throw new Error(`${STAFF_EMAIL} not in user table`);
		const token = `forumLock${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
		const id = `forumLockS${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
		await pool.query(
			`insert into session (id, token, user_id, expires_at, created_at, updated_at)
			 values ($1, $2, $3, now() + interval '7 days', now(), now())`,
			[id, token, user.rows[0].id]
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
			origins: []
		};
	} finally {
		await pool.end();
	}
}

/** @param {string} dir */
async function listWebms(dir) {
	const names = await readdir(dir);
	const out = [];
	for (const name of names) {
		if (!name.endsWith('.webm')) continue;
		const p = path.join(dir, name);
		const s = await stat(p);
		out.push({ path: p, size: s.size });
	}
	return out.sort((a, b) => b.size - a.size);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} title
 * @param {string} body
 */
async function postThread(page, title, body) {
	await page.goto('/tools/forum', { waitUntil: 'networkidle' });
	await page.locator('#composer input[name="title"]').fill(title);
	await page.locator('#composer select[name="category"]').selectOption('student-life');
	await page.locator('#composer textarea[name="body"]').fill(body);
	await page.getByRole('button', { name: 'Post thread' }).click();
	await page.waitForURL(/\/tools\/forum\/[0-9a-f-]+$/i, { timeout: 20000 });
	return page.url();
}

async function main() {
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(tmpRoot, { recursive: true });
	await mkdir(outDir, { recursive: true });

	const storageState = await mintStaffStorageState();
	await writeFile(path.join(outDir, 'storageState.json'), JSON.stringify(storageState, null, 2));

	const videoDir = path.join(tmpRoot, 'video');
	await mkdir(videoDir, { recursive: true });

	const browser = await chromium.launch({ channel: 'chrome', headless: true });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL,
		storageState
	});
	const page = await context.newPage();
	const log = /** @type {Array<{t:number,label:string}>} */ ([]);
	const bugs = /** @type {string[]} */ ([]);
	const checks = /** @type {Array<{id:string,pass:boolean,detail:string}>} */ ([]);
	const t0 = Date.now();
	const stamp = Date.now().toString(36);
	const lockTitle = `Lock proof ${stamp}`;
	const removeTitle = `Remove proof ${stamp}`;

	try {
		await page.goto('/tools/forum', { waitUntil: 'networkidle' });
		if (/sign-in|reauthenticate/i.test(page.url())) {
			bugs.push(`staff session rejected (${page.url()})`);
			checks.push({ id: 'staff-session', pass: false, detail: page.url() });
		} else {
			checks.push({ id: 'staff-session', pass: true, detail: STAFF_EMAIL });
			await mark(page, t0, log, 'staff forum index');
		}

		await postThread(page, lockTitle, 'Disposable OP for staff Lock camera proof.');
		await mark(page, t0, log, `opened lock target "${lockTitle}"`);

		const staffMod = page.locator('section.reply-editor').filter({ hasText: 'Staff moderation' });
		if ((await staffMod.count()) < 1) {
			bugs.push('Staff moderation block missing');
			checks.push({ id: 'staff-controls', pass: false, detail: 'Lock/Remove UI absent' });
		} else {
			checks.push({ id: 'staff-controls', pass: true, detail: 'Staff moderation visible' });
			await staffMod.scrollIntoViewIfNeeded();
			await mark(page, t0, log, 'Staff moderation on camera', 900);

			const lockBtn = staffMod.getByRole('button', { name: 'Lock thread' });
			await Promise.all([
				page.waitForLoadState('domcontentloaded'),
				lockBtn.click()
			]);
			const lockedBanner = page.locator('header.thread-header p', {
				hasText: /^Thread locked\.$/
			});
			await lockedBanner.waitFor({ state: 'visible', timeout: 15000 });
			await mark(page, t0, log, 'locked banner visible', 1000);

			const lockedVisible = await lockedBanner.isVisible();
			const replyComposer = page.locator('section.reply-editor textarea[name="body"]');
			const replyGone = (await replyComposer.count()) === 0;
			const lockPass = lockedVisible && replyGone;
			checks.push({
				id: 'lock-hides-reply',
				pass: lockPass,
				detail: lockPass
					? 'locked banner on; reply composer gone'
					: `locked=${lockedVisible} replyGone=${replyGone}`
			});
			if (!lockPass) bugs.push('Lock did not leave thread read-only');
			await mark(
				page,
				t0,
				log,
				lockPass ? 'PASS: lock read-only' : 'FAIL: lock did not stick',
				1100
			);
			await page.screenshot({
				path: path.join(outDir, 'after-lock.png'),
				fullPage: false
			});
		}

		await postThread(page, removeTitle, 'Disposable OP for staff Remove camera proof.');
		await mark(page, t0, log, `opened remove target "${removeTitle}"`);

		const staffMod2 = page.locator('section.reply-editor').filter({ hasText: 'Staff moderation' });
		if ((await staffMod2.count()) < 1) {
			bugs.push('Staff moderation missing on remove target');
			checks.push({ id: 'remove-controls', pass: false, detail: 'moderation block absent' });
		} else {
			await staffMod2.scrollIntoViewIfNeeded();
			const removeBtn = staffMod2.getByRole('button', { name: 'Remove thread' });
			await mark(page, t0, log, 'Remove thread on camera', 900);
			await Promise.all([
				page.waitForLoadState('domcontentloaded'),
				removeBtn.click()
			]);
			const notAvailable = page.locator('section.page-thread > p', {
				hasText: /^That thread is not available\.$/
			});
			await notAvailable.waitFor({ state: 'visible', timeout: 15000 });
			const goneOnPage = await notAvailable.isVisible();
			checks.push({
				id: 'remove-not-found',
				pass: goneOnPage,
				detail: goneOnPage ? 'not-available message shown' : 'thread page still rendered'
			});
			if (!goneOnPage) bugs.push('Remove did not clear thread page');
			await mark(
				page,
				t0,
				log,
				goneOnPage ? 'PASS: thread gone' : 'FAIL: remove left thread',
				1000
			);
			await page.screenshot({
				path: path.join(outDir, 'after-remove.png'),
				fullPage: false
			});

			await page.goto('/tools/forum', { waitUntil: 'networkidle' });
			const listed = await page.getByText(removeTitle).count();
			const indexGone = listed === 0;
			checks.push({
				id: 'remove-off-index',
				pass: indexGone,
				detail: indexGone
					? 'title absent from forum index'
					: `title still listed (${listed})`
			});
			if (!indexGone) bugs.push('removed thread still on forum index');
			await mark(
				page,
				t0,
				log,
				indexGone ? 'PASS: gone from index' : 'FAIL: still on index',
				1200
			);
			await page.screenshot({
				path: path.join(outDir, 'forum-index-after-remove.png'),
				fullPage: false
			});
		}

		await sleep(800);
	} finally {
		await context.close();
		await browser.close();
	}

	const videos = await listWebms(videoDir);
	const mainVideo = videos[0];
	if (!mainVideo) throw new Error('No webm recorded');
	const dest = path.join(outDir, VIDEO_NAME);
	await copyFile(mainVideo.path, dest);

	const pass = bugs.length === 0 && checks.every((c) => c.pass);
	const scorecard = {
		result: pass ? 'PASS' : 'FAIL',
		baseURL,
		session: STAFF_EMAIL,
		video: path.relative(root, dest),
		checks,
		bugs,
		moments: log
	};
	await writeFile(path.join(outDir, 'scorecard.json'), JSON.stringify(scorecard, null, 2));
	const notes = `# Staff forum Lock + Remove

Result: **${scorecard.result}**
Session: ${STAFF_EMAIL}
Base: ${baseURL}
Video: \`${scorecard.video}\`

## Scorecard
${checks.map((c) => `- ${c.pass ? 'PASS' : 'FAIL'} \`${c.id}\`: ${c.detail}`).join('\n')}
${bugs.length ? `\n## Bugs\n${bugs.map((b) => `- ${b}`).join('\n')}` : ''}

## On-camera moments
${log.map((e) => `- **${e.t.toFixed(2)}s** ${e.label}`).join('\n')}
`;
	await writeFile(path.join(outDir, 'NOTES.md'), notes, 'utf8');
	await rm(tmpRoot, { recursive: true, force: true });
	console.log(notes);
	if (!pass) process.exitCode = 1;
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
