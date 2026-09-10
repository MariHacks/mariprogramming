/**
 * Honest Playwright tape: signed-in club user clears every Science PBL step
 * with deliberate mid-run hop-backs. Pattern: recordVideo dir → context.close()
 * → rename webm. NEVER video.saveAs.
 *
 * Usage: node scripts/prove-pbl-full-science-clear.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:4180
 */
import { chromium } from '@playwright/test';
import { makeSignature } from 'better-auth/crypto';
import { copyFile, mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { SCIENCE_STEP_COUNT, SCIENCE_STEPS } from '../src/lib/pbl/science-workshop.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const baseURL = process.argv[2] || 'http://127.0.0.1:4180';
const outDir = path.join(root, 'artifacts/pbl-full-clear');
const backupDir = '/Users/sony0627/Programming/mariprogramming-backups/pbl-proofs';
const tmpRoot = path.join(root, 'artifacts/_pbl-full-clear-tmp');
const NICK_EMAIL = 'nick.zhicheng@gmail.com';
const VIEWPORT = { width: 1400, height: 900 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Reference solutions that pass gradeScienceStep (private proof only). */
const SOLUTIONS = [
	// 0 — custom print (not starter)
	'print("Lab table 3 is live")\n',
	// 1 — bounds from variables
	`reading = 12.1
uncertainty = 0.2
lower_bound = reading - uncertainty
upper_bound = reading + uncertainty
print(lower_bound)
print(upper_bound)
`,
	// 2 — list indexing + slice
	`readings = [12.1, 11.8, 12.3, 48.7, 12.0, 11.9]
print(readings[0])
print(readings[-1])
print(len(readings))
print(readings[0:2])
`,
	// 3 — for + range
	`readings = [12.1, 11.8, 12.3, 48.7, 12.0, 11.9]
for reading in readings:
    print(reading)
for i in range(len(readings)):
    print(i + 1, readings[i])
`,
	// 4 — valid/discard
	`readings = [12.1, 11.8, 12.3, 48.7, 12.0, 11.9]
for reading in readings:
    if 10 <= reading <= 20:
        print(reading, "valid")
    else:
        print(reading, "discard")
`,
	// 5 — filter + average loop
	`readings = [12.1, 11.8, 12.3, 48.7, 12.0, 11.9]
valid_readings = []
for reading in readings:
    if 10 <= reading <= 20:
        valid_readings.append(reading)
total = 0
for value in valid_readings:
    total = total + value
average = total / len(valid_readings)
print(average)
`,
	// 6 — functions
	`readings = [12.1, 11.8, 12.3, 48.7, 12.0, 11.9]

def is_valid(reading, max_value):
    return 10 <= reading <= max_value

def average(values):
    total = 0
    for value in values:
        total = total + value
    return total / len(values)

valid_readings = [r for r in readings if is_valid(r, 20)]
print(average(valid_readings))
`,
	// 7 — input + while + filter (empty-safe for checker trial max=5)
	`readings = [12.1, 11.8, 12.3, 48.7, 12.0, 11.9]
max_value = float(input("Maximum accepted value: "))
while max_value <= 0:
    max_value = float(input("Maximum accepted value: "))
valid_readings = [r for r in readings if 10 <= r <= max_value]
average = sum(valid_readings) / len(valid_readings) if valid_readings else 0
print(average)
`,
	// 8 — math.sqrt stdev
	`import math
readings = [12.1, 11.8, 12.3, 48.7, 12.0, 11.9]
valid_readings = [r for r in readings if 10 <= r <= 20]
average = sum(valid_readings) / len(valid_readings)
standard_deviation = math.sqrt(
    sum((x - average) ** 2 for x in valid_readings) / (len(valid_readings) - 1)
)
print(standard_deviation)
`,
	// 9 — dict + new key
	`import math
readings = [12.1, 11.8, 12.3, 48.7, 12.0, 11.9]
valid_readings = [r for r in readings if 10 <= r <= 20]
average = sum(valid_readings) / len(valid_readings)
standard_deviation = math.sqrt(
    sum((x - average) ** 2 for x in valid_readings) / (len(valid_readings) - 1)
)
summary = {
    "valid_count": len(valid_readings),
    "average": average,
    "standard_deviation": standard_deviation,
}
print(summary["average"])
summary["unit"] = "mm"
`,
	// 10 — f-string + file write
	`import math
readings = [12.1, 11.8, 12.3, 48.7, 12.0, 11.9]
valid_readings = [r for r in readings if 10 <= r <= 20]
average = sum(valid_readings) / len(valid_readings)
standard_deviation = math.sqrt(
    sum((x - average) ** 2 for x in valid_readings) / (len(valid_readings) - 1)
)
report = f"average={average} valid_count={len(valid_readings)} stdev={standard_deviation}"
print(report)
with open("report.txt", "w") as file:
    file.write(report)
`,
	// 11 — final boss with new readings
	`def is_valid(reading, max_value):
    return 10 <= reading <= max_value

def average(values):
    total = 0
    for value in values:
        total = total + value
    return total / len(values)

readings = [12.4, 12.6, 26.1, 12.5, 12.8, 12.3]
max_value = float(input("Maximum valid reading: "))
accepted = [reading for reading in readings if is_valid(reading, max_value)]
summary = {"average": average(accepted), "valid_count": len(accepted)}
print(f"average={summary['average']} valid_count={summary['valid_count']}")
`
];

if (SOLUTIONS.length !== SCIENCE_STEP_COUNT) {
	throw new Error(`SOLUTIONS length ${SOLUTIONS.length} != SCIENCE_STEP_COUNT ${SCIENCE_STEP_COUNT}`);
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
		process.env[key] = value;
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
					'max-width:92vw',
					'text-align:center'
				].join(';')
			);
			document.body.appendChild(el);
		}
		el.textContent = text;
	}, label);
	await sleep(700);
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
			[userId, profile.name || 'Proof User', email]
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
				profile.studentId || '2530622',
				profile.displayName || 'zhich',
				profile.role || 'student',
				(profile.displayName || 'zhich').toLowerCase().replace(/\s+/g, ''),
				'Zhich',
				'Gaming'
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
 * @param {import('@playwright/test').BrowserContext} context
 * @param {string} videoDir
 * @param {string} destPath
 */
async function finalizeVideo(context, videoDir, destPath) {
	await context.close();
	await sleep(500);
	const videos = await listWebms(videoDir);
	if (!videos[0]) throw new Error(`No webm in ${videoDir}`);
	await mkdir(path.dirname(destPath), { recursive: true });
	await rename(videos[0].path, destPath);
	return { path: destPath, size: videos[0].size };
}

/** @param {import('@playwright/test').Page} page */
function pythonBox(page) {
	return page.getByRole('textbox', { name: 'Python' });
}

/** @param {import('@playwright/test').Page} page @param {string} text */
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

/** @param {import('@playwright/test').Page} page @param {number} stepId */
async function selectStep(page, stepId) {
	await page.locator('ol.steps button').nth(stepId).click();
	await sleep(600);
}

/**
 * Wait until the editor shows expected text after a step hop (guards remount races).
 * @param {import('@playwright/test').Page} page
 * @param {(text: string) => boolean} pred
 * @param {number} [timeoutMs]
 */


async function waitForEditor(page, pred, timeoutMs = 12000) {
	const start = Date.now();
	let last = '';
	while (Date.now() - start < timeoutMs) {
		last = await editorText(page);
		if (pred(last)) return last;
		await sleep(250);
	}
	return last;
}

/** @param {import('@playwright/test').Page} page @param {string} text */
async function fillStdin(page, text) {
	// Program input lives on the Testcase tab (hidden while Output is selected).
	await page.getByRole('tab', { name: 'Testcase' }).click();
	await sleep(200);
	const box = page.locator('textarea.stdin');
	await box.waitFor({ state: 'visible', timeout: 10000 });
	await box.fill(text);
	await page.getByRole('tab', { name: 'Output' }).click();
	await sleep(150);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} timeoutMs
 */
async function waitAccepted(page, timeoutMs = 120000) {
	await page.locator('.verdict', { hasText: 'Accepted' }).waitFor({
		state: 'visible',
		timeout: timeoutMs
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
	return /** @type {{ code: string, unlockedStep?: number }} */ (payload);
}

/** @param {import('@playwright/test').Page} page @param {string} name */
async function expectVisible(page, name) {
	await page.getByRole('textbox', { name }).waitFor({ state: 'visible', timeout: 60000 });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} t0
 * @param {Array<{t:number,label:string}>} log
 * @param {number} stepId
 * @param {{ firstRun?: boolean }} [opts]
 */
async function clearStep(page, t0, log, stepId, opts = {}) {
	const title = SCIENCE_STEPS[stepId]?.title || `step ${stepId}`;
	await mark(page, t0, log, `Step ${stepId}: select — ${title}`);
	await selectStep(page, stepId);
	await mark(page, t0, log, `Step ${stepId}: paste solution + Run`);
	await fillPython(page, SOLUTIONS[stepId]);
	if (stepId === 7 || stepId === 11) {
		await fillStdin(page, '20');
	}
	await sleep(300);
	await page.getByRole('button', { name: 'Run' }).click();
	const timeout = opts.firstRun ? 180000 : 90000;
	await waitAccepted(page, timeout);
	await mark(page, t0, log, `Step ${stepId}: Accepted`);
	await sleep(500);
}

async function main() {
	await loadEnvLocal(path.join(root, '.env.local'));
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(tmpRoot, { recursive: true });
	await mkdir(outDir, { recursive: true });
	await mkdir(backupDir, { recursive: true });

	const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
	const timeline = /** @type {Array<{t:number,label:string}>} */ ([]);
	const backForth = /** @type {Array<{at:string,detail:string,ok:boolean}>} */ ([]);
	const cleared = /** @type {number[]} */ ([]);
	/** @type {{ pass: boolean, room: string | null, clip: string | null, error?: string }} */
	const outcome = { pass: false, room: null, clip: null };
	const t0 = Date.now();

	try {
		const nickId = await ensureUser(pool, NICK_EMAIL, {
			name: 'Zhich Gaming',
			displayName: 'zhich',
			role: 'student',
			studentId: '2530622'
		});
		const nickState = await mintStorageState(pool, nickId);
		const browser = await chromium.launch({ headless: true });
		const apiCtx = await browser.newContext({ storageState: nickState });
		const teamName = `FullClear ${Date.now().toString(36)}`;
		const created = await createRoomViaApi(apiCtx.request, nickState, teamName);
		await apiCtx.close();
		const code = created.code;
		outcome.room = code;
		console.log('Room', code, 'unlockedStep=', created.unlockedStep);

		const dest = path.join(outDir, 'full-science-clear.webm');
		const rec = await openRecorded(browser, nickState);
		try {
			await rec.page.goto(`/pbl/science/${code}`, { waitUntil: 'domcontentloaded' });
			await expectVisible(rec.page, 'Python');
			await mark(
				rec.page,
				t0,
				timeline,
				`Signed in as zhich (student) · Science room ${code} · clearing all ${SCIENCE_STEP_COUNT} steps`
			);
			await sleep(800);

			// Clear 0..3
			for (let step = 0; step <= 3; step += 1) {
				await clearStep(rec.page, t0, timeline, step, { firstRun: step === 0 });
				cleared.push(step);
			}

			// Back-and-forth #1: after step 3 → hop to step 1 → confirm code → forward to 4
			await sleep(1200); // let step maps flush before hop
			await mark(rec.page, t0, timeline, 'Hop-back #1: jump to step 1 after clearing step 3');
			await selectStep(rec.page, 1);
			const step1Text = await waitForEditor(
				rec.page,
				(t) => t.includes('uncertainty') && t.includes('12.1') && !t.includes('for i in range')
			);
			const hop1Ok =
				step1Text.includes('uncertainty') &&
				step1Text.includes('12.1') &&
				!step1Text.includes('for i in range');
			backForth.push({
				at: 'after-step-3',
				detail: `jumped to step 1; code preserved=${hop1Ok}; snippet=${JSON.stringify(step1Text.slice(0, 80))}`,
				ok: hop1Ok
			});
			await mark(
				rec.page,
				t0,
				timeline,
				hop1Ok
					? 'Hop-back #1 OK — step 1 still has bounds solution'
					: 'Hop-back #1 WARN — step 1 buffer unexpected'
			);
			await sleep(900);
			await mark(rec.page, t0, timeline, 'Return forward — continue from step 4');
			await selectStep(rec.page, 4);
			await sleep(700);

			// Clear 4..8
			for (let step = 4; step <= 8; step += 1) {
				await clearStep(rec.page, t0, timeline, step);
				cleared.push(step);
			}

			// Back-and-forth #2: near end — jump back 3 steps (8→5) then forward to 9
			await sleep(1200);
			await mark(rec.page, t0, timeline, 'Hop-back #2: jump back 3 steps (8 → 5) then forward');
			await selectStep(rec.page, 5);
			const step5Text = await waitForEditor(
				rec.page,
				(t) => t.includes('valid_readings') && t.includes('append')
			);
			const hop2Ok = step5Text.includes('valid_readings') && step5Text.includes('append');
			backForth.push({
				at: 'after-step-8',
				detail: `jumped to step 5; code preserved=${hop2Ok}; snippet=${JSON.stringify(step5Text.slice(0, 80))}`,
				ok: hop2Ok
			});
			await mark(
				rec.page,
				t0,
				timeline,
				hop2Ok
					? 'Hop-back #2 OK — step 5 still has filter/average code'
					: 'Hop-back #2 WARN — step 5 buffer unexpected'
			);
			await sleep(800);
			await selectStep(rec.page, 6);
			await sleep(500);
			await selectStep(rec.page, 7);
			await sleep(500);
			await mark(rec.page, t0, timeline, 'Forward again to step 9 — continue clear');
			await selectStep(rec.page, 9);
			await sleep(700);

			// Clear 9..11
			for (let step = 9; step < SCIENCE_STEP_COUNT; step += 1) {
				await clearStep(rec.page, t0, timeline, step);
				cleared.push(step);
			}

			await mark(
				rec.page,
				t0,
				timeline,
				`DONE — final step ${SCIENCE_STEP_COUNT - 1} Accepted · all ${SCIENCE_STEP_COUNT} steps cleared`
			);
			await sleep(1500);

			const finishedVisible = await rec.page
				.locator('.finished, .verdict')
				.filter({ hasText: /Finished|Accepted/ })
				.first()
				.isVisible()
				.catch(() => false);

			outcome.pass =
				cleared.length === SCIENCE_STEP_COUNT &&
				backForth.every((h) => h.ok) &&
				finishedVisible !== false;
		} finally {
			const video = await finalizeVideo(rec.context, rec.videoDir, dest);
			outcome.clip = video.path;
			console.log('Video', video.path, 'bytes', video.size);
		}

		await browser.close();

		const durationSec = Number(((Date.now() - t0) / 1000).toFixed(2));
		const report = {
			pass: outcome.pass,
			baseURL,
			room: outcome.room,
			teamName,
			durationSec,
			scienceStepCount: SCIENCE_STEP_COUNT,
			clearedSteps: cleared,
			backForth,
			timeline,
			clip: outcome.clip,
			clipBackup: path.join(backupDir, 'full-science-clear.webm'),
			at: new Date().toISOString(),
			notes: [
				'Student role (no exec unlock-all): unlock advances only by Accepted; hop-backs use unlocked prior steps.',
				'Hop-backs confirm per-step buffers keep prior solutions.',
				'Product fixes shipped with this proof: (1) loadViewStep re-encodes yjs from stepSources text on hop; (2) server does not merge live room yjs into an empty per-step slot; (3) mergeRoomPreferringNewerLastCheck unions local step maps so 409 retries cannot wipe buffers; (4) brief hop pin ignores remount onCollab garbage.'
			]
		};

		if (outcome.clip) {
			await copyFile(outcome.clip, path.join(backupDir, 'full-science-clear.webm'));
		}
		await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
		await writeFile(path.join(backupDir, 'full-science-clear-report.json'), JSON.stringify(report, null, 2));
		console.log('\n=== REPORT ===');
		console.log(JSON.stringify(report, null, 2));
		process.exitCode = outcome.pass ? 0 : 1;
	} catch (err) {
		outcome.pass = false;
		outcome.error = err instanceof Error ? err.stack || err.message : String(err);
		const report = {
			pass: false,
			baseURL,
			room: outcome.room,
			durationSec: Number(((Date.now() - t0) / 1000).toFixed(2)),
			clearedSteps: cleared,
			backForth,
			timeline,
			clip: outcome.clip,
			error: outcome.error,
			at: new Date().toISOString()
		};
		await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2)).catch(() => {});
		await writeFile(
			path.join(backupDir, 'full-science-clear-report.json'),
			JSON.stringify(report, null, 2)
		).catch(() => {});
		console.error(err);
		process.exitCode = 1;
	} finally {
		await pool.end();
	}
}

main();
