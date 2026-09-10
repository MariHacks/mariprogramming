/**
 * PBL studio honest-tape proofs for the four cursor/step/run fixes.
 * Pattern: recordVideo dir → context.close() → rename webm. Never video.saveAs.
 *
 * Usage: node scripts/prove-pbl-studio-fixes.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:4180
 */
import { chromium } from '@playwright/test';
import { makeSignature } from 'better-auth/crypto';
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const baseURL = process.argv[2] || 'http://127.0.0.1:4180';
const outDir = path.join(root, 'artifacts/pbl-studio-proof');
const backupDir = '/Users/sony0627/Programming/mariprogramming-backups/pbl-proofs';
const tmpRoot = path.join(root, 'artifacts/_pbl-studio-proof-tmp');
const NICK_EMAIL = 'nick.zhicheng@gmail.com';
const TEAMMATE_EMAIL = 'pbl-proof-teammate@mari.local';
const VIEWPORT = { width: 1400, height: 900 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
		process.env[key] = value; // force override poisoned shell env
	}
}

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
		let el = document.getElementById('pbl-proof-banner');
		if (!el) {
			el = document.createElement('div');
			el.id = 'pbl-proof-banner';
			el.setAttribute(
				'style',
				[
					'position:fixed',
					'top:8px',
					'left:50%',
					'transform:translateX(-50%)',
					'z-index:2147483647',
					'background:#061431',
					'color:#fff',
					'padding:8px 14px',
					'border-radius:8px',
					'font:700 13px/1.3 system-ui,sans-serif',
					'box-shadow:0 4px 16px rgb(0 0 0 / 35%)',
					'pointer-events:none',
					'max-width:90vw'
				].join(';')
			);
			document.body.appendChild(el);
		}
		el.textContent = text;
	}, label);
	await sleep(900);
}

/** @param {string} dir */
async function listWebms(dir) {
	const names = await readdir(dir).catch(() => []);
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
 * @param {import('pg').Pool} pool
 * @param {string} email
 * @param {{ name?: string, displayName?: string, role?: string, studentId?: string }} profile
 */
async function ensureUser(pool, email, profile) {
	const existing = await pool.query('select id from "user" where email = $1 limit 1', [email]);
	let userId = existing.rows[0]?.id;
	if (!userId) {
		userId = `proofUser${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
		await pool.query(
			`insert into "user" (id, name, email, email_verified, created_at, updated_at)
			 values ($1, $2, $3, true, now(), now())`,
			[userId, profile.name || 'Proof Teammate', email]
		);
	}
	const sp = await pool.query('select user_id from mt_student_profiles where user_id = $1', [userId]);
	if (!sp.rows[0]) {
		await pool.query(
			`insert into mt_student_profiles
			 (user_id, student_id, display_name, role, nim_disclosure_accepted_at, version, created_at, updated_at, username, first_name, last_name)
			 values ($1, $2, $3, $4, now(), 1, now(), now(), $5, $6, $7)`,
			[
				userId,
				profile.studentId || '2599999',
				profile.displayName || 'teammate',
				profile.role || 'student',
				(profile.displayName || 'teammate').toLowerCase().replace(/\s+/g, ''),
				'Proof',
				'Teammate'
			]
		);
	} else {
		await pool.query(
			`update mt_student_profiles
			 set display_name = coalesce($2, display_name),
			     role = coalesce($3, role),
			     nim_disclosure_accepted_at = coalesce(nim_disclosure_accepted_at, now()),
			     updated_at = now()
			 where user_id = $1`,
			[userId, profile.displayName || null, profile.role || null]
		);
	}
	const acct = await pool.query(
		`select id from account where user_id = $1 and provider_id = 'google' limit 1`,
		[userId]
	);
	if (!acct.rows[0]) {
		const accountId = `proof-google-${userId}`.slice(0, 200);
		await pool.query(
			`insert into account (
				id, account_id, provider_id, user_id, access_token, created_at, updated_at
			) values ($1, $2, 'google', $3, 'proof-token', now(), now())`,
			[`acct${userId}`.slice(0, 64), accountId, userId]
		);
	}
	return userId;
}

/** @param {import('pg').Pool} pool @param {string} userId */
async function mintStorageState(pool, userId) {
	const secret = process.env.BETTER_AUTH_SECRET;
	if (!secret) throw new Error('BETTER_AUTH_SECRET missing');
	const token = `proofTok${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
	const id = `proofSess${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
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
}

/**
 * @param {import('@playwright/test').Browser} browser
 * @param {import('@playwright/test').BrowserContextOptions['storageState']} storageState
 */
async function openRecorded(browser, storageState) {
	const videoDir = path.join(tmpRoot, `vid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
	await mkdir(videoDir, { recursive: true });
	const context = await browser.newContext({
		viewport: VIEWPORT,
		recordVideo: { dir: videoDir, size: VIEWPORT },
		baseURL,
		storageState
	});
	const page = await context.newPage();
	return { context, page, videoDir };
}

/**
 * Close context first (finalizes webm), then rename — never saveAs.
 * @param {import('@playwright/test').BrowserContext} context
 * @param {string} videoDir
 * @param {string} destPath
 */
async function finalizeVideo(context, videoDir, destPath) {
	await context.close();
	await sleep(400);
	const videos = await listWebms(videoDir);
	if (!videos[0]) throw new Error(`No webm in ${videoDir}`);
	await mkdir(path.dirname(destPath), { recursive: true });
	await rename(videos[0].path, destPath);
	return destPath;
}

/** @param {import('@playwright/test').Page} page */
function pythonBox(page) {
	return page.getByRole('textbox', { name: 'Python' });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} text
 */
async function fillPython(page, text) {
	const editor = pythonBox(page);
	await editor.click();
	await page.keyboard.press('Meta+A');
	await sleep(80);
	await page.keyboard.insertText(text);
}

/** @param {import('@playwright/test').Page} page */
async function editorText(page) {
	return page.evaluate(() => {
		const cm = document.querySelector('.cm-content');
		return cm ? cm.textContent || '' : '';
	});
}

/** @param {import('@playwright/test').Page} page */
async function remoteCaretStats(page) {
	return page.evaluate(() => {
		const carets = [...document.querySelectorAll('.cm-ySelectionCaret')];
		const infos = [...document.querySelectorAll('.cm-ySelectionInfo')];
		return {
			caretCount: carets.length,
			infoCount: infos.length,
			labels: infos.map((el) => (el.textContent || '').trim()).filter(Boolean)
		};
	});
}

/**
 * @param {import('@playwright/test').APIRequestContext} request
 * @param {import('@playwright/test').BrowserContextOptions['storageState']} storageState
 * @param {string} teamName
 */
async function createRoomViaApi(request, storageState, teamName) {
	const cookie = storageState.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
	const res = await request.post(`${baseURL}/api/pbl/rooms`, {
		headers: {
			accept: 'application/json',
			'content-type': 'application/json',
			cookie
		},
		data: { pblId: 'science', teamName }
	});
	const payload = await res.json().catch(() => ({}));
	if (!res.ok()) {
		throw new Error(`create room failed ${res.status()}: ${JSON.stringify(payload)}`);
	}
	return /** @type {{ code: string }} */ (payload).code;
}

async function main() {
	await loadEnvLocal(path.join(root, '.env.local'));
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(tmpRoot, { recursive: true });
	await mkdir(outDir, { recursive: true });
	await mkdir(backupDir, { recursive: true });

	const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
	const results = /** @type {Record<string, { pass: boolean, clip: string, notes: string[] }>} */ ({});

	try {
		const nickId = await ensureUser(pool, NICK_EMAIL, {
			name: 'Zhich Gaming',
			displayName: 'zhich',
			role: 'student',
			studentId: '2530622'
		});
		const teammateId = await ensureUser(pool, TEAMMATE_EMAIL, {
			name: 'PBL Proof Teammate',
			displayName: 'teammate',
			role: 'student',
			studentId: '2599999'
		});
		const nickState = await mintStorageState(pool, nickId);
		const teammateState = await mintStorageState(pool, teammateId);

		const browser = await chromium.launch({ headless: true });
		const apiCtx = await browser.newContext({ storageState: nickState });
		const teamName = `Proof ${Date.now().toString(36)}`;
		const code = await createRoomViaApi(apiCtx.request, nickState, teamName);
		await apiCtx.close();
		console.log('Room', code);

		// Unlock steps 0+1 for A→B→A proof without waiting on Pyodide checks.
		await pool.query(`update pbl_rooms set unlocked_step = greatest(unlocked_step, 1) where code = $1`, [
			code
		]);

		// ---------- 1) Own cursor/name badge NOT shown ----------
		{
			const slug = '01-no-own-cursor-badge';
			const dest = path.join(outDir, `${slug}.webm`);
			const notes = /** @type {string[]} */ ([]);
			const log = /** @type {Array<{t:number,label:string}>} */ ([]);
			const t0 = Date.now();
			const a = await openRecorded(browser, nickState);
			const b = await openRecorded(browser, nickState);
			try {
				await a.page.goto(`/pbl/science/${code}`, { waitUntil: 'domcontentloaded' });
				await b.page.goto(`/pbl/science/${code}`, { waitUntil: 'domcontentloaded' });
				await expectVisible(a.page, 'Python');
				await expectVisible(b.page, 'Python');
				await mark(a.page, t0, log, '1) Two tabs same user — own remote badge must stay hidden');
				await pythonBox(a.page).click();
				await a.page.keyboard.press('End');
				await fillPython(a.page, 'print("own-cursor-check")\n');
				await pythonBox(b.page).click();
				await b.page.keyboard.press('Home');
				await sleep(1500);
				const statsA = await remoteCaretStats(a.page);
				const statsB = await remoteCaretStats(b.page);
				await mark(
					a.page,
					t0,
					log,
					`Tab A carets=${statsA.caretCount} labels=${JSON.stringify(statsA.labels)}`
				);
				await mark(
					b.page,
					t0,
					log,
					`Tab B carets=${statsB.caretCount} labels=${JSON.stringify(statsB.labels)}`
				);
				const ownShown =
					statsA.labels.some((l) => /zhich|Zhich/i.test(l)) ||
					statsB.labels.some((l) => /zhich|Zhich/i.test(l));
				if (ownShown) notes.push('Own name badge visible as remote caret');
				if (statsA.caretCount > 0 || statsB.caretCount > 0) {
					// Same user only — any remote caret is a self leak.
					notes.push(`Unexpected remote carets with only self tabs (A=${statsA.caretCount} B=${statsB.caretCount})`);
				}
				await sleep(800);
				results[slug] = { pass: notes.length === 0, clip: dest, notes };
			} finally {
				await finalizeVideo(a.context, a.videoDir, dest);
				await b.context.close().catch(() => {});
				const bVideos = await listWebms(b.videoDir);
				if (bVideos[0]) {
					await copyFile(bVideos[0].path, path.join(outDir, `${slug}-tabB.webm`));
				}
			}
			console.log(slug, results[slug].pass ? 'PASS' : 'FAIL', results[slug].notes);
		}

		// ---------- 2) No stacked duplicate teammate cursors ----------
		{
			const slug = '02-no-stacked-teammate-cursors';
			const dest = path.join(outDir, `${slug}.webm`);
			const notes = /** @type {string[]} */ ([]);
			const log = /** @type {Array<{t:number,label:string}>} */ ([]);
			const t0 = Date.now();
			const host = await openRecorded(browser, nickState);
			const t1 = await openRecorded(browser, teammateState);
			const t2 = await openRecorded(browser, teammateState);
			try {
				await host.page.goto(`/pbl/science/${code}`, { waitUntil: 'domcontentloaded' });
				await t1.page.goto(`/pbl/science/${code}`, { waitUntil: 'domcontentloaded' });
				await t2.page.goto(`/pbl/science/${code}`, { waitUntil: 'domcontentloaded' });
				await expectVisible(host.page, 'Python');
				await expectVisible(t1.page, 'Python');
				await expectVisible(t2.page, 'Python');
				// Wait until teammate actually joined (auth + join POST).
				for (let i = 0; i < 40; i += 1) {
					const text = await host.page.locator('body').innerText();
					if (/2\/10|teammate/i.test(text)) break;
					await sleep(250);
				}
				await mark(host.page, t0, log, '2) Teammate in TWO tabs — host must show ONE caret');
				await fillPython(host.page, 'print("host")\nprint("line2")\nprint("line3")\n');
				await sleep(800);
				await pythonBox(t1.page).click();
				await t1.page.keyboard.type(' ');
				await t1.page.keyboard.press('Backspace');
				await t1.page.keyboard.press('Home');
				await pythonBox(t2.page).click();
				await t2.page.keyboard.type(' ');
				await t2.page.keyboard.press('Backspace');
				await t2.page.keyboard.press('End');
				await t2.page.keyboard.press('ArrowUp');
				let stats = { caretCount: 0, infoCount: 0, labels: [] };
				for (let i = 0; i < 40; i += 1) {
					stats = await remoteCaretStats(host.page);
					if (stats.caretCount >= 1) break;
					await sleep(250);
				}
				// Keep both teammate tabs alive and moving so duplicate clientIDs would stack
				// without dedupe — then re-check for a short window.
				for (let i = 0; i < 8; i += 1) {
					await pythonBox(t1.page).click();
					await t1.page.keyboard.press(i % 2 === 0 ? 'ArrowRight' : 'ArrowLeft');
					await pythonBox(t2.page).click();
					await t2.page.keyboard.press(i % 2 === 0 ? 'ArrowLeft' : 'ArrowRight');
					await sleep(400);
					stats = await remoteCaretStats(host.page);
					if (stats.caretCount > 1) break;
				}
				await mark(
					host.page,
					t0,
					log,
					`Host remote carets=${stats.caretCount} labels=${JSON.stringify(stats.labels)}`
				);
				const teammateLabels = stats.labels.filter((l) => /teammate|Proof/i.test(l));
				if (stats.caretCount < 1) {
					notes.push('Expected at least 1 remote teammate caret, got 0');
				} else if (stats.caretCount !== 1) {
					notes.push(`Expected exactly 1 remote caret after dedupe, got ${stats.caretCount}`);
				}
				if (teammateLabels.length > 1) {
					notes.push(`Stacked teammate badges: ${JSON.stringify(teammateLabels)}`);
				}
				if (stats.labels.some((l) => /zhich/i.test(l))) {
					notes.push('Host saw own name as remote badge');
				}
				await sleep(800);
				results[slug] = { pass: notes.length === 0, clip: dest, notes };
			} finally {
				await finalizeVideo(host.context, host.videoDir, dest);
				await t1.context.close().catch(() => {});
				await t2.context.close().catch(() => {});
			}
			console.log(slug, results[slug].pass ? 'PASS' : 'FAIL', results[slug].notes);
		}

		// ---------- 3) Run does not duplicate full source ----------
		{
			const slug = '03-run-no-source-duplication';
			const dest = path.join(outDir, `${slug}.webm`);
			const notes = /** @type {string[]} */ ([]);
			const log = /** @type {Array<{t:number,label:string}>} */ ([]);
			const t0 = Date.now();
			const rec = await openRecorded(browser, nickState);
			try {
				await rec.page.goto(`/pbl/science/${code}`, { waitUntil: 'domcontentloaded' });
				await expectVisible(rec.page, 'Python');
				const unique = 'print("RUN_UNIQUE_MARKER_XYZ")\n';
				await mark(rec.page, t0, log, '3) Fill unique source then Run — must not double');
				await fillPython(rec.page, unique);
				await sleep(400);
				const before = await editorText(rec.page);
				await rec.page.getByRole('button', { name: 'Run' }).click();
				await sleep(2500);
				const after = await editorText(rec.page);
				await mark(
					rec.page,
					t0,
					log,
					`beforeLen=${before.length} afterLen=${after.length}`
				);
				const count = (after.match(/RUN_UNIQUE_MARKER_XYZ/g) || []).length;
				if (count !== 1) notes.push(`Marker count after Run = ${count} (want 1)`);
				if (after.includes(unique + unique.trim()) || after.length >= before.length * 2 - 2) {
					notes.push('Editor source appears duplicated after Run');
				}
				results[slug] = { pass: notes.length === 0, clip: dest, notes };
			} finally {
				await finalizeVideo(rec.context, rec.videoDir, dest);
			}
			console.log(slug, results[slug].pass ? 'PASS' : 'FAIL', results[slug].notes);
		}

		// ---------- 4) Edit A → B → A keeps A's code ----------
		{
			const slug = '04-step-a-b-a-preserves-a';
			const dest = path.join(outDir, `${slug}.webm`);
			const notes = /** @type {string[]} */ ([]);
			const log = /** @type {Array<{t:number,label:string}>} */ ([]);
			const t0 = Date.now();
			const rec = await openRecorded(browser, nickState);
			try {
				await rec.page.goto(`/pbl/science/${code}`, { waitUntil: 'domcontentloaded' });
				await expectVisible(rec.page, 'Python');
				await mark(rec.page, t0, log, '4) Edit step A');
				await rec.page.locator('ol.steps button').nth(0).click();
				await sleep(500);
				await fillPython(rec.page, 'print("STEP_A_ONLY")\n');
				await sleep(1500);
				await mark(rec.page, t0, log, 'Switch to step B and edit');
				await rec.page.locator('ol.steps button').nth(1).click();
				await sleep(1500);
				await fillPython(rec.page, 'print("STEP_B_ONLY")\n');
				await sleep(1500);
				await mark(rec.page, t0, log, 'Return to step A — must keep STEP_A_ONLY');
				await rec.page.locator('ol.steps button').nth(0).click();
				await sleep(2500);
				const text = await editorText(rec.page);
				await mark(rec.page, t0, log, `stepA text=${JSON.stringify(text.slice(0, 80))}`);
				if (!text.includes('STEP_A_ONLY')) notes.push('Missing STEP_A_ONLY after return');
				if (text.includes('STEP_B_ONLY')) notes.push('STEP_B_ONLY bled into step A');
				results[slug] = { pass: notes.length === 0, clip: dest, notes };
			} finally {
				await finalizeVideo(rec.context, rec.videoDir, dest);
			}
			console.log(slug, results[slug].pass ? 'PASS' : 'FAIL', results[slug].notes);
		}

		await browser.close();

		// Copy to backups + write report
		for (const [slug, r] of Object.entries(results)) {
			try {
				await copyFile(r.clip, path.join(backupDir, path.basename(r.clip)));
			} catch {}
		}
		const report = {
			baseURL,
			room: code,
			at: new Date().toISOString(),
			results
		};
		await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
		await writeFile(path.join(backupDir, 'report.json'), JSON.stringify(report, null, 2));
		console.log('\n=== REPORT ===');
		console.log(JSON.stringify(report, null, 2));
		const failed = Object.values(results).filter((r) => !r.pass).length;
		process.exitCode = failed ? 1 : 0;
	} finally {
		await pool.end();
	}
}

/** @param {import('@playwright/test').Page} page @param {string} name */
async function expectVisible(page, name) {
	await page.getByRole('textbox', { name }).waitFor({ state: 'visible', timeout: 60000 });
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
