/**
 * Guest vs signed-in auth matrix for Account, Semester, Catalog.
 * Usage: node scripts/capture-auth-matrix-account-semester-catalog.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:5174
 *
 * Artifacts: .artifacts/verify-mariTools/auth-matrix/{account,semester,catalog}/
 *   guest.webm + signed-in.webm (+ matrix.json, NOTES.md)
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
const outRoot = path.join(root, '.artifacts/verify-mariTools/auth-matrix');
const tmpRoot = path.join(root, '.artifacts/verify-mariTools/_capture-tmp-auth-matrix');
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
	await sleep(650);
}

/** Visible on-camera location strip (browser chrome is not in Playwright video). */
async function showLocationStrip(page) {
	await page.evaluate(() => {
		const id = 'auth-matrix-loc';
		let el = document.getElementById(id);
		if (!el) {
			el = document.createElement('div');
			el.id = id;
			el.setAttribute('data-proof', 'location');
			Object.assign(el.style, {
				position: 'fixed',
				top: '0',
				left: '0',
				right: '0',
				zIndex: '2147483647',
				padding: '8px 12px',
				background: '#0b1d34',
				color: '#f7f9fc',
				font: '12px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace',
				pointerEvents: 'none'
			});
			document.documentElement.appendChild(el);
		}
		const paint = () => {
			const next = `URL ${location.href}`;
			if (el.textContent !== next) el.textContent = next;
		};
		paint();
		window.addEventListener('popstate', paint);
		setInterval(paint, 250);
	});
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

		const token = `authMat${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
		const id = `authMatS${Date.now().toString(36)}`;
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
 * @param {string} route
 * @param {string} state
 * @param {(page: import('@playwright/test').Page, t0: number, log: Array<{t:number,label:string}>, bugs: string[]) => Promise<void>} drive
 */
async function capture(browser, storageState, route, state, drive) {
	const videoDir = path.join(tmpRoot, `${route}-${state}-video`);
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
	if (!mainVideo) throw new Error(`No webm for ${route}/${state}`);
	const destDir = path.join(outRoot, route);
	await mkdir(destDir, { recursive: true });
	const dest = path.join(destDir, `${state}.webm`);
	await copyFile(mainVideo.path, dest);
	return { route, state, dest, log, bugs, pass: bugs.length === 0 };
}

async function main() {
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(tmpRoot, { recursive: true });
	await mkdir(outRoot, { recursive: true });

	const storageState = await mintNickStorageState();
	await writeFile(
		path.join(outRoot, 'storageState.json'),
		JSON.stringify(storageState, null, 2)
	);

	const browser = await chromium.launch({ channel: 'chrome', headless: true });
	const results = [];

	results.push(
		await capture(browser, undefined, 'account', 'guest', async (page, t0, log, bugs) => {
			await page.goto('/tools/account', { waitUntil: 'domcontentloaded', timeout: 20000 });
			await mark(page, t0, log, 'guest account');
			const body = await page.locator('body').innerText();
			if (!/Continue with Google/i.test(body) && !/Google sign-in is not configured/i.test(body)) {
				bugs.push('guest missing Google CTA or config message');
			}
			if (/could not finish sign-in/i.test(body)) bugs.push('false could-not-finish banner on guest');
			if (/Sign out/i.test(body)) bugs.push('Sign out shown to guest');
			await page.screenshot({
				path: path.join(outRoot, 'account', 'guest-1280.png'),
				fullPage: false
			});
			await sleep(800);
		})
	);

	results.push(
		await capture(browser, storageState, 'account', 'signed-in', async (page, t0, log, bugs) => {
			await page.goto('/tools', { waitUntil: 'domcontentloaded', timeout: 20000 });
			const probeRes = await fetch(`${baseURL}/tools/account?state=unavailable`, {
				method: 'GET',
				redirect: 'manual',
				headers: {
					cookie: storageState.cookies
						.map((c) => `${c.name}=${c.value}`)
						.join('; ')
				}
			});
			const probeStatus = probeRes.status;
			const probeLocation = probeRes.headers.get('location') ?? '';
			await page.evaluate(
				({ probeStatus, probeLocation }) => {
					const el = document.createElement('div');
					el.id = 'auth-matrix-chapter';
					Object.assign(el.style, {
						position: 'fixed',
						inset: '0',
						zIndex: '2147483647',
						padding: '28px 32px',
						background: '#f7f9fc',
						color: '#0b1d34',
						font: '16px/1.4 ui-sans-serif, system-ui'
					});
					el.innerHTML = `<p style="margin:0 0 8px;font:12px ui-monospace,Menlo,monospace;color:#69798d">auth-matrix chapter</p>
						<h1 style="margin:0 0 12px;font-size:28px">Signed-in account</h1>
						<p style="margin:0 0 12px;max-width:40rem">Probe <code>GET /tools/account?state=unavailable</code> with session → <strong>HTTP ${probeStatus}</strong> Location <code>${probeLocation || '(none)'}</code></p>
						<p style="margin:0;max-width:40rem">Following into the page next. Failure banner must stay gone.</p>`;
					document.documentElement.appendChild(el);
				},
				{ probeStatus, probeLocation }
			);
			await mark(page, t0, log, `probe ${probeStatus} → ${probeLocation || 'none'}`);
			if (probeStatus !== 303) bugs.push(`expected 303 from stale state, got ${probeStatus}`);
			if (probeLocation !== '/tools/account') {
				bugs.push(`unexpected Location ${probeLocation}`);
			}
			await page.goto('/tools/account?state=unavailable', {
				waitUntil: 'domcontentloaded',
				timeout: 20000
			});
			await showLocationStrip(page);
			await page.evaluate((probeStatus) => {
				const el = document.getElementById('auth-matrix-loc');
				if (el) el.textContent = `followed ${probeStatus} → ${location.href}`;
			}, probeStatus);
			await mark(page, t0, log, `landed ${page.url()}`);
			if (/state=unavailable/.test(page.url())) bugs.push('stale state=unavailable not cleared');
			const body = await page.locator('body').innerText();
			if (/could not finish sign-in/i.test(body)) bugs.push('false unavailable banner with session');
			if (!/Sign out/i.test(body)) bugs.push('Sign out missing');
			if (/Continue with Google/i.test(body)) bugs.push('guest Google CTA on signed-in account');
			if (!/Profile|Signed in|Accepted|Saved|student number/i.test(body)) {
				bugs.push('profile signals missing');
			}
			await page.getByRole('button', { name: 'Sign out' }).focus();
			await mark(page, t0, log, 'signed-in profile with Sign out focused');
			await page.screenshot({
				path: path.join(outRoot, 'account', 'signed-in-1280.png'),
				fullPage: false
			});
			await sleep(900);
		})
	);

	results.push(
		await capture(browser, undefined, 'semester', 'guest', async (page, t0, log, bugs) => {
			await page.goto('/tools/semester', { waitUntil: 'networkidle' });
			await mark(page, t0, log, 'guest semester gate');
			const body = await page.locator('body').innerText();
			if (!/Sign in to upload/i.test(body)) bugs.push('guest gate copy missing');
			if ((await page.locator('input[type="file"][name="outline"]').count()) > 0) {
				bugs.push('file input present for guest');
			}
			const hit = await page.evaluate(() => {
				const sheet = document.querySelector('.review-sheet, .sheet-empty, .page-semester');
				const r = (sheet ?? document.body).getBoundingClientRect();
				const el = document.elementFromPoint(r.left + r.width / 2, r.top + 140);
				return { tag: el?.tagName, type: el?.getAttribute?.('type'), name: el?.getAttribute?.('name') };
			});
			if (hit.type === 'file') bugs.push('center click hits file input while guest');
			await mark(page, t0, log, `center hit ${hit.tag}${hit.type ? `[${hit.type}]` : ''}`);
			await page.screenshot({
				path: path.join(outRoot, 'semester', 'guest-1280.png'),
				fullPage: false
			});
			await sleep(800);
		})
	);

	results.push(
		await capture(browser, storageState, 'semester', 'signed-in', async (page, t0, log, bugs) => {
			await page.goto('/tools/semester', { waitUntil: 'networkidle' });
			await showLocationStrip(page);
			await mark(page, t0, log, 'signed-in semester upload affordance');
			const body = await page.locator('body').innerText();
			if (/Sign in to upload outlines/i.test(body) && /Open account/i.test(body)) {
				bugs.push('guest gate still showing for completed profile');
			}
			const upload = page.getByLabel('Course outline PDF');
			if ((await upload.count()) < 1) bugs.push('upload control missing');
			else {
				const bounds = await page.evaluate(() => {
					const input = document.querySelector('input[type="file"][name="outline"]');
					const label = input?.closest('label');
					if (!input || !label) return { missing: true };
					const ir = input.getBoundingClientRect();
					const lr = label.getBoundingClientRect();
					return {
						coversViewport: ir.width > 600 || ir.height > 400,
						labelPosition: getComputedStyle(label).position,
						inputW: Math.round(ir.width),
						labelW: Math.round(lr.width)
					};
				});
				if (bounds.coversViewport) bugs.push('file input covers viewport');
				if (bounds.labelPosition !== 'relative') {
					bugs.push(`add-outline containing block is ${bounds.labelPosition}`);
				}
				await page.evaluate((b) => {
					const id = 'auth-matrix-bounds';
					let el = document.getElementById(id);
					if (!el) {
						el = document.createElement('div');
						el.id = id;
						Object.assign(el.style, {
							position: 'fixed',
							bottom: '12px',
							left: '12px',
							zIndex: '2147483647',
							padding: '8px 12px',
							background: '#1457d9',
							color: 'white',
							font: '12px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace',
							pointerEvents: 'none',
							borderRadius: '4px'
						});
						document.documentElement.appendChild(el);
					}
					el.textContent = `file input ${b.inputW}px · label ${b.labelPosition} · coversViewport=${b.coversViewport}`;
				}, bounds);
				await mark(
					page,
					t0,
					log,
					`upload bound label=${bounds.labelPosition} inputW=${bounds.inputW}`
				);

				let fileChooserOpened = false;
				page.once('filechooser', () => {
					fileChooserOpened = true;
				});
				const sheet = page.locator('.review-sheet');
				const box = await sheet.boundingBox();
				if (!box) bugs.push('review sheet missing for elsewhere click');
				else {
					await page.mouse.click(box.x + box.width / 2, box.y + 120);
					await sleep(700);
					await page.evaluate((opened) => {
						const el = document.getElementById('auth-matrix-bounds');
						if (el) {
							el.textContent += opened
								? ' · FAIL: filechooser opened on elsewhere click'
								: ' · elsewhere click: no filechooser';
						}
					}, fileChooserOpened);
					if (fileChooserOpened) bugs.push('click elsewhere opens file picker');
					await mark(page, t0, log, 'elsewhere click on review sheet (no filechooser)');
				}
			}
			await page.screenshot({
				path: path.join(outRoot, 'semester', 'signed-in-1280.png'),
				fullPage: false
			});
			await sleep(900);
		})
	);

	results.push(
		await capture(browser, undefined, 'catalog', 'guest', async (page, t0, log, bugs) => {
			await page.goto('/tools/catalog', { waitUntil: 'networkidle' });
			await mark(page, t0, log, 'guest catalog browse');
			const body = await page.locator('body').innerText();
			if (!/Course catalog/i.test(body)) bugs.push('catalog title missing');
			if (!/Search|Term|Discipline/i.test(body)) bugs.push('filters missing');
			await page.getByPlaceholder(/Course code|Search|title/i).fill('physics');
			await page.getByRole('button', { name: 'Search' }).click();
			await page.waitForLoadState('networkidle');
			await mark(page, t0, log, 'guest searched physics');
			await page.screenshot({
				path: path.join(outRoot, 'catalog', 'guest-1280.png'),
				fullPage: false
			});
			await sleep(700);
		})
	);

	results.push(
		await capture(browser, storageState, 'catalog', 'signed-in', async (page, t0, log, bugs) => {
			await page.goto('/tools/catalog', { waitUntil: 'networkidle' });
			await mark(page, t0, log, 'signed-in catalog browse');
			const body = await page.locator('body').innerText();
			if (!/Course catalog/i.test(body)) bugs.push('catalog title missing');
			if (!/Search|Term|Discipline/i.test(body)) bugs.push('filters missing');
			await page.getByPlaceholder(/Course code|Search|title/i).fill('physics');
			await page.getByRole('button', { name: 'Search' }).click();
			await page.waitForLoadState('networkidle');
			await mark(page, t0, log, 'signed-in searched physics');
			await page.screenshot({
				path: path.join(outRoot, 'catalog', 'signed-in-1280.png'),
				fullPage: false
			});
			await sleep(700);
		})
	);

	await browser.close();

	const matrix = results.map((r) => ({
		route: r.route,
		state: r.state,
		pass: r.pass,
		video: path.relative(root, r.dest),
		bugs: r.bugs,
		moments: r.log
	}));

	const byRoute = ['account', 'semester', 'catalog'].map((route) => {
		const guest = matrix.find((m) => m.route === route && m.state === 'guest');
		const signed = matrix.find((m) => m.route === route && m.state === 'signed-in');
		return {
			route,
			guest: guest?.pass ? 'PASS' : 'FAIL',
			signedIn: signed?.pass ? 'PASS' : 'FAIL',
			guestBugs: guest?.bugs ?? [],
			signedInBugs: signed?.bugs ?? [],
			guestVideo: guest?.video,
			signedInVideo: signed?.video
		};
	});

	const notes = `# Auth matrix: Account / Semester / Catalog

Session: ${NICK_EMAIL} (completed profile) · Guest: cleared cookies
Base: ${baseURL}

## Pass/fail

| Route | Guest | Signed-in |
|---|---|---|
${byRoute.map((r) => `| \`/tools/${r.route}\` | ${r.guest} | ${r.signedIn} |`).join('\n')}

## Videos
${byRoute
	.map(
		(r) =>
			`- **${r.route}** guest \`${r.guestVideo}\` · signed-in \`${r.signedInVideo}\`${
				r.guestBugs.length || r.signedInBugs.length
					? `\n  - bugs: guest=[${r.guestBugs.join('; ')}] signed-in=[${r.signedInBugs.join('; ')}]`
					: ''
			}`
	)
	.join('\n')}

## On-camera moments
${matrix
	.map(
		(m) =>
			`### ${m.route} / ${m.state}\n${m.moments.map((e) => `- **${e.t.toFixed(2)}s** ${e.label}`).join('\n')}`
	)
	.join('\n\n')}
`;

	await writeFile(path.join(outRoot, 'NOTES.md'), notes, 'utf8');
	await writeFile(path.join(outRoot, 'matrix.json'), JSON.stringify({ matrix, byRoute }, null, 2), 'utf8');
	await rm(tmpRoot, { recursive: true, force: true });
	console.log(notes);
	if (matrix.some((m) => !m.pass)) process.exitCode = 1;
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
