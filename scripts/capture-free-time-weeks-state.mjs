/**
 * Free-time guest + account week/state matrix proof.
 * Usage: node scripts/capture-free-time-weeks-state.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:5174
 *
 * Writes:
 *   .artifacts/verify-mariTools/free-time/guest-weeks-state.webm
 *   .artifacts/verify-mariTools/free-time/account-weeks-state.webm
 *   .artifacts/verify-mariTools/free-time/NOTES.md
 */
import { chromium } from '@playwright/test';
import { makeSignature } from 'better-auth/crypto';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const baseURL = process.argv[2] || 'http://127.0.0.1:5174';
const outDir = path.join(root, '.artifacts/verify-mariTools/free-time');
const tmpRoot = path.join(root, '.artifacts/verify-mariTools/_capture-tmp-free-time-weeks');
const NICK_EMAIL = 'nick.zhicheng@gmail.com';

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
		const token = `proofFt${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
		const id = `proofFtSess${Date.now().toString(36)}`;
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
			origins: []
		};
	} finally {
		await pool.end();
	}
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string[]} cells
 */
async function paintCells(page, cells) {
	for (const key of cells) {
		await page.locator(`.paint-cell[data-cell="${key}"]`).click();
	}
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string[]} cells
 */
async function assertSelected(page, cells) {
	for (const key of cells) {
		const pressed = await page.locator(`.paint-cell[data-cell="${key}"]`).getAttribute('aria-pressed');
		if (pressed !== 'true') throw new Error(`expected ${key} selected, got aria-pressed=${pressed}`);
	}
}

/**
 * @param {import('@playwright/test').Browser} browser
 * @param {import('@playwright/test').BrowserContextOptions['storageState'] | undefined} storageState
 * @param {string} videoName
 * @param {{ boardTitle: string, member1: string, member2: string, cells1: string[], cells1b: string[], cells2: string[], expectSignedIn?: boolean }} opts
 */
async function captureMatrix(browser, storageState, videoName, opts) {
	const videoDir = path.join(tmpRoot, `${videoName}-video`);
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
	/** @type {string} */
	let boardUrl = '';

	try {
		await page.goto('/tools/free-time', { waitUntil: 'networkidle' });
		await mark(page, t0, log, 'free-time index');

		await page.getByLabel('Board title').fill(opts.boardTitle);
		await Promise.all([
			page.waitForURL(/\/tools\/free-time\/[^/]+/, { timeout: 30000 }),
			page.getByRole('button', { name: 'Create board' }).click()
		]);
		boardUrl = page.url();
		await mark(page, t0, log, `created board ${boardUrl}`);
		await page.locator('.paint-cell').first().waitFor({ state: 'visible' });

		if (opts.expectSignedIn) {
			const name = await page.getByPlaceholder('How others will see you').inputValue();
			if (!name) bugs.push('signed-in path did not prefill display name');
			await mark(page, t0, log, `signed-in prefill display name="${name}"`);
		}

		for (const key of opts.cells1) {
			await page.locator(`.paint-cell[data-cell="${key}"]`).click();
			await page.locator(`.paint-cell[data-cell="${key}"][aria-pressed="true"]`).waitFor();
		}
		await mark(page, t0, log, `member1 painted ${opts.cells1.length} cells`);
		if (!opts.expectSignedIn) {
			await page.getByPlaceholder('How others will see you').fill(opts.member1);
		} else if (!(await page.getByPlaceholder('How others will see you').inputValue())) {
			await page.getByPlaceholder('How others will see you').fill(opts.member1);
		}
		await page.getByRole('button', { name: 'Save availability' }).click();
		await page.getByText('Availability saved.').waitFor({ state: 'visible' });
		await page.getByText('1 saved').waitFor({ state: 'visible' });
		await mark(page, t0, log, 'Save → Members "1 saved" + Availability saved.');

		const headingBefore = await page.locator('h1').first().textContent();
		await page.getByRole('button', { name: 'Next week' }).click();
		const headingAfter = await page.locator('h1').first().textContent();
		if (headingBefore === headingAfter) bugs.push('week switch did not change heading');
		await assertSelected(page, opts.cells1);
		await mark(
			page,
			t0,
			log,
			`week switch ${headingBefore} → ${headingAfter}; paint retained (${opts.cells1.length})`
		);
		await page.getByRole('button', { name: 'Previous week' }).click();

		await page.reload({ waitUntil: 'networkidle' });
		await page.locator('.paint-cell').first().waitFor({ state: 'visible' });
		await page.waitForFunction(
			(expected) =>
				document.querySelectorAll('.paint-cell.selected').length >= expected &&
				Boolean(document.querySelector('input[name="displayName"]')?.value),
			opts.cells1.length,
			{ timeout: 10000 }
		);
		try {
			await assertSelected(page, opts.cells1);
			const restoredName = await page.getByPlaceholder('How others will see you').inputValue();
			if (!restoredName) bugs.push('reload wiped display name');
			await mark(page, t0, log, `reload restore OK (name="${restoredName}", ${opts.cells1.length} cells)`);
		} catch (error) {
			bugs.push(`reload restore failed: ${error instanceof Error ? error.message : String(error)}`);
			await mark(page, t0, log, 'reload restore FAILED');
		}

		for (const key of opts.cells1) {
			if (!opts.cells1b.includes(key)) {
				await page.locator(`.paint-cell[data-cell="${key}"]`).click();
			}
		}
		for (const key of opts.cells1b) {
			const pressed = await page.locator(`.paint-cell[data-cell="${key}"]`).getAttribute('aria-pressed');
			if (pressed !== 'true') await page.locator(`.paint-cell[data-cell="${key}"]`).click();
		}
		await page.getByRole('button', { name: 'Save availability' }).click();
		await page.getByText('Availability saved.').waitFor({ state: 'visible' });
		await mark(page, t0, log, `modify + save (${opts.cells1b.length} cells)`);

		await page.reload({ waitUntil: 'networkidle' });
		await page.locator('.paint-cell').first().waitFor({ state: 'visible' });
		await page.waitForFunction(
			(expected) => document.querySelectorAll('.paint-cell.selected').length >= expected,
			opts.cells1b.length,
			{ timeout: 10000 }
		);
		try {
			await assertSelected(page, opts.cells1b);
			for (const key of opts.cells1) {
				if (opts.cells1b.includes(key)) continue;
				const pressed = await page.locator(`.paint-cell[data-cell="${key}"]`).getAttribute('aria-pressed');
				if (pressed === 'true') bugs.push(`modify restore still has erased cell ${key}`);
			}
			await mark(page, t0, log, 'reload after modify matches new paint');
		} catch (error) {
			bugs.push(`modify restore failed: ${error instanceof Error ? error.message : String(error)}`);
			await mark(page, t0, log, 'reload after modify FAILED');
		}

		await page.evaluate(() => {
			for (const key of Object.keys(localStorage)) {
				if (key.startsWith('maritools.free-time.')) localStorage.removeItem(key);
			}
		});
		await page.reload({ waitUntil: 'networkidle' });
		await mark(page, t0, log, 'cleared token → second member path');
		await paintCells(page, opts.cells2);
		await page.getByPlaceholder('How others will see you').fill(opts.member2);
		await page.getByRole('button', { name: 'Save availability' }).click();
		await page.getByText('Availability saved.').waitFor({ state: 'visible' });
		await page.getByText('2 saved').waitFor({ state: 'visible' });
		const commonCount = await page.locator('.paint-cell.common').count();
		if (commonCount < 1) bugs.push('no common free cells after second member');
		await mark(page, t0, log, `second member saved; common free cells=${commonCount}`);

		const hint = await page.getByText(/Mon–Fri pattern/i).count();
		if (hint < 1) bugs.push('missing week pattern hint');
	} finally {
		await context.close();
	}

	const videos = await listWebms(videoDir);
	const mainVideo = videos.sort((a, b) => b.size - a.size)[0];
	if (!mainVideo) throw new Error(`No webm for ${videoName}`);
	const dest = path.join(outDir, `${videoName}.webm`);
	await copyFile(mainVideo.path, dest);
	return { log, bugs, boardUrl, dest };
}

async function main() {
	await mkdir(outDir, { recursive: true });
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(tmpRoot, { recursive: true });

	const browser = await chromium.launch({ headless: true });
	const stamp = Date.now();

	console.log('Guest matrix…');
	const guest = await captureMatrix(browser, undefined, 'guest-weeks-state', {
		boardTitle: `Guest weeks ${stamp}`,
		member1: 'GuestAda',
		member2: 'GuestBlake',
		cells1: ['Mon-09:00', 'Mon-09:30', 'Tue-11:00'],
		cells1b: ['Mon-09:00', 'Wed-14:00', 'Wed-14:30'],
		cells2: ['Mon-09:00', 'Wed-14:00', 'Fri-10:00'],
		expectSignedIn: false
	});

	console.log('Account matrix…');
	let account;
	try {
		const storageState = await mintNickStorageState();
		account = await captureMatrix(browser, storageState, 'account-weeks-state', {
			boardTitle: `Account weeks ${stamp}`,
			member1: 'nick.zhicheng',
			member2: 'GuestBlake',
			cells1: ['Mon-10:00', 'Mon-10:30', 'Thu-13:00'],
			cells1b: ['Mon-10:00', 'Fri-15:00', 'Fri-15:30'],
			cells2: ['Mon-10:00', 'Fri-15:00', 'Tue-09:00'],
			expectSignedIn: true
		});
	} catch (error) {
		account = {
			log: [],
			bugs: [`account capture blocked: ${error instanceof Error ? error.message : String(error)}`],
			boardUrl: '',
			dest: ''
		};
		console.error(account.bugs[0]);
	}

	await browser.close();

	const guestPass = guest.bugs.length === 0;
	const accountPass = account.bugs.length === 0;
	const notes = `# Free-time weeks/state verification

## Matrix

| Flow | Guest (username) | Account (signed-in) |
| --- | --- | --- |
| Paint / Save | ${guestPass ? 'PASS' : 'FAIL'} | ${accountPass ? 'PASS' : 'FAIL'} |
| Week switch (labels + paint retained) | ${guestPass ? 'PASS' : 'FAIL'} | ${accountPass ? 'PASS' : 'FAIL'} |
| Reload restore | ${guestPass ? 'PASS' : 'FAIL'} | ${accountPass ? 'PASS' : 'FAIL'} |
| Modify → save → reload | ${guestPass ? 'PASS' : 'FAIL'} | ${accountPass ? 'PASS' : 'FAIL'} |
| Second member / common free | ${guestPass ? 'PASS' : 'FAIL'} | ${accountPass ? 'PASS' : 'FAIL'} |

## Identity notes
- Guest: display name + localStorage share token; label "editing as Guest, …"
- Account: session email local-part prefills display name; label "editing as … (signed in)". Members still keyed by share token (not user id).
- Availability is a Mon–Fri pattern. Week arrows move calendar labels only (no per-week paint store).

## Guest on-camera (guest-weeks-state.webm)
${guest.log.map((e) => `- **${e.t.toFixed(2)}s** ${e.label}`).join('\n') || '- (no frames)'}

## Account on-camera (account-weeks-state.webm)
${account.log.map((e) => `- **${e.t.toFixed(2)}s** ${e.label}`).join('\n') || '- (no frames)'}

## Boards
- Guest: ${guest.boardUrl || '(none)'}
- Account: ${account.boardUrl || '(none)'}

## Artifacts
- \`.artifacts/verify-mariTools/free-time/guest-weeks-state.webm\`
- \`.artifacts/verify-mariTools/free-time/account-weeks-state.webm\`

## Bugs found this run
${[...guest.bugs.map((b) => `- guest: ${b}`), ...account.bugs.map((b) => `- account: ${b}`)].join('\n') || '- none'}

## Base
- ${baseURL}
`;

	await writeFile(path.join(outDir, 'NOTES.md'), notes);
	console.log(notes);
	if (!guestPass || !accountPass) process.exitCode = 1;
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
