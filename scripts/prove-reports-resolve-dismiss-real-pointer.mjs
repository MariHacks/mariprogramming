/**
 * Continuous OS-screen proof of staff report Resolve + Dismiss.
 * Real system cursor (Quartz). No DOM fake red circle. No Playwright recordVideo splice.
 *
 * Usage: node scripts/prove-reports-resolve-dismiss-real-pointer.mjs [baseUrl]
 *
 * Requires: Screen Recording + Accessibility for Terminal/Cursor (ffmpeg + Quartz clicks).
 */
import { chromium } from '@playwright/test';
import { makeSignature } from 'better-auth/crypto';
import { spawn } from 'node:child_process';
import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const baseURL = process.argv[2] || 'http://127.0.0.1:5174';
const outDir = path.join(root, '.artifacts/verify-mariTools/staff-reject-resolve-dismiss');
const tmpRoot = path.join(root, '.artifacts/verify-mariTools/_capture-tmp-reports-real-pointer');
const STAFF_EMAIL = 'team@marihacks.com';
const WIN = Object.freeze({ x: 80, y: 60, w: 1280, h: 800 });

const REPORTS = Object.freeze({
	resolveThread: 'c2222222-2222-4222-8222-222222222222',
	dismissThread: 'c3333333-3333-4333-8333-333333333333',
	resolveReport: 'c4444444-4444-4444-8444-444444444444',
	dismissReport: 'c5555555-5555-4555-8555-555555555555',
	resolveReason: 'proof-resolve spam report',
	dismissReason: 'proof-dismiss off-topic report'
});

/** @param {number} ms */
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
		if (!(key in process.env)) process.env[key] = value;
	}
}

async function mintStaffCookie() {
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
		const token = `proofRp${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
		const id = `proofRpS${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
		await pool.query(
			`insert into session (id, token, user_id, expires_at, created_at, updated_at)
			 values ($1, $2, $3, now() + interval '7 days', now(), now())`,
			[id, token, user.rows[0].id]
		);
		const signed = `${token}.${await makeSignature(token, secret)}`;
		return {
			userId: user.rows[0].id,
			cookie: {
				name: 'mari-staff.session_token',
				value: signed,
				domain: '127.0.0.1',
				path: '/',
				httpOnly: true,
				secure: false,
				sameSite: 'Lax'
			}
		};
	} finally {
		await pool.end();
	}
}

/** @param {string} authorId */
async function seedOpenReports(authorId) {
	await loadEnvLocal(path.join(root, '.env.local'));
	const databaseUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error('DATABASE_URL missing');
	const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		await client.query(
			`delete from mt_forum_reports
			 where status = 'open'
			    or id in ($1, $2)
			    or reason like 'staff-portal-proof%'
			    or reason like 'proof-%'`,
			[REPORTS.resolveReport, REPORTS.dismissReport]
		);
		for (const [threadId, title, body] of [
			[REPORTS.resolveThread, 'Resolve proof thread', 'Seeded for Resolve film.'],
			[REPORTS.dismissThread, 'Dismiss proof thread', 'Seeded for Dismiss film.']
		]) {
			await client.query(
				`insert into mt_forum_threads (
					id, title, body, category, author_user_id, version, created_at, updated_at
				) values ($1, $2, $3, 'student-life', $4, 1, now(), now())
				on conflict (id) do update set
					title = excluded.title,
					body = excluded.body,
					removed_at = null,
					updated_at = now()`,
				[threadId, title, body, authorId]
			);
		}
		await client.query(
			`insert into mt_forum_reports (
				id, target_kind, target_id, reporter_user_id, reason, status, version, created_at, updated_at
			) values ($1, 'thread', $2, $3, $4, 'open', 1, now(), now())
			on conflict (id) do update set
				reason = excluded.reason,
				status = 'open',
				resolved_at = null,
				updated_at = now()`,
			[REPORTS.resolveReport, REPORTS.resolveThread, authorId, REPORTS.resolveReason]
		);
		await client.query(
			`insert into mt_forum_reports (
				id, target_kind, target_id, reporter_user_id, reason, status, version, created_at, updated_at
			) values ($1, 'thread', $2, $3, $4, 'open', 1, now(), now())
			on conflict (id) do update set
				reason = excluded.reason,
				status = 'open',
				resolved_at = null,
				updated_at = now()`,
			[REPORTS.dismissReport, REPORTS.dismissThread, authorId, REPORTS.dismissReason]
		);
		await client.query('COMMIT');
	} catch (error) {
		try {
			await client.query('ROLLBACK');
		} catch {
			// ignore
		}
		throw error;
	} finally {
		client.release();
		await pool.end();
	}
}

/**
 * Real OS cursor move + click via Quartz (points).
 * @param {number} x
 * @param {number} y
 * @param {{ steps?: number, dwellMs?: number }} [opts]
 */
async function osClick(x, y, opts = {}) {
	const steps = opts.steps ?? 48;
	const dwellMs = opts.dwellMs ?? 350;
	const script = `
import Quartz, time, sys
x, y = float(sys.argv[1]), float(sys.argv[2])
steps = int(sys.argv[3])
dwell = float(sys.argv[4]) / 1000.0
ev = Quartz.CGEventCreate(None)
cur = Quartz.CGEventGetLocation(ev)
for i in range(1, steps + 1):
    nx = cur.x + (x - cur.x) * i / steps
    ny = cur.y + (y - cur.y) * i / steps
    e = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventMouseMoved, (nx, ny), Quartz.kCGMouseButtonLeft)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, e)
    time.sleep(0.014)
time.sleep(dwell)
down = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseDown, (x, y), Quartz.kCGMouseButtonLeft)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, down)
time.sleep(0.14)
up = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventLeftMouseUp, (x, y), Quartz.kCGMouseButtonLeft)
Quartz.CGEventPost(Quartz.kCGHIDEventTap, up)
print(f"clicked {x:.1f},{y:.1f}")
`;
	await new Promise((resolve, reject) => {
		const child = spawn('python3', ['-c', script, String(x), String(y), String(steps), String(dwellMs)], {
			stdio: ['ignore', 'pipe', 'pipe']
		});
		let out = '';
		let err = '';
		child.stdout.on('data', (c) => {
			out += String(c);
		});
		child.stderr.on('data', (c) => {
			err += String(c);
		});
		child.on('close', (code) => {
			if (code === 0) {
				console.log('  os', out.trim());
				resolve(undefined);
			} else reject(new Error(`Quartz click failed: ${err || out}`));
		});
	});
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} target
 */
async function screenCenter(page, target) {
	await target.scrollIntoViewIfNeeded();
	await sleep(200);
	const point = await target.evaluate((el) => {
		const r = el.getBoundingClientRect();
		const chromeH = Math.max(0, window.outerHeight - window.innerHeight);
		const chromeW = Math.max(0, window.outerWidth - window.innerWidth);
		return {
			x: window.screenX + chromeW / 2 + r.left + r.width / 2,
			y: window.screenY + chromeH + r.top + r.height / 2,
			label: (el.textContent || '').trim().slice(0, 40)
		};
	});
	return point;
}

/** @param {string} filePath */
async function statExists(filePath) {
	try {
		await access(filePath, fsConstants.F_OK);
		return true;
	} catch {
		return false;
	}
}

/** @param {string} rawPath */
async function detectDisplayScale(rawPath) {
	if (!(await statExists(rawPath))) return 2;
	const dims = await new Promise((resolve) => {
		const ff = spawn('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', rawPath], {
			stdio: ['ignore', 'pipe', 'ignore']
		});
		let out = '';
		ff.stdout.on('data', (c) => {
			out += String(c);
		});
		ff.on('close', () => resolve(out.trim()));
	});
	const [w] = dims.split(',').map((n) => Number(n));
	if (!Number.isFinite(w) || w <= 0) return 2;
	// Logical 1512-wide laptop ≈ 3024 device px → scale 2.
	return w >= 2500 ? 2 : 1;
}

/**
 * @param {string} rawPath
 * @param {string} destWebm
 * @param {{ x: number, y: number, w: number, h: number }} crop
 */
async function cropToWebm(rawPath, destWebm, crop) {
	await new Promise((resolve, reject) => {
		const ff = spawn(
			'ffmpeg',
			[
				'-y',
				'-i',
				rawPath,
				'-vf',
				`crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},fps=30`,
				'-c:v',
				'libvpx-vp9',
				'-b:v',
				'2M',
				'-an',
				destWebm
			],
			{ stdio: ['ignore', 'ignore', 'pipe'] }
		);
		let err = '';
		ff.stderr.on('data', (c) => {
			err += String(c);
		});
		ff.on('close', (code) => {
			if (code === 0) resolve(undefined);
			else reject(new Error(`ffmpeg crop exit ${code}: ${err.slice(-500)}`));
		});
	});
}

/**
 * @param {string} webmPath
 * @param {string} framesDir
 */
async function extractReviewFrames(webmPath, framesDir) {
	await mkdir(framesDir, { recursive: true });
	await new Promise((resolve, reject) => {
		const ff = spawn(
			'ffmpeg',
			['-y', '-i', webmPath, '-vf', 'fps=2', path.join(framesDir, 'frame-%03d.png')],
			{ stdio: ['ignore', 'ignore', 'pipe'] }
		);
		let err = '';
		ff.stderr.on('data', (c) => {
			err += String(c);
		});
		ff.on('close', (code) => {
			if (code === 0) resolve(undefined);
			else reject(new Error(`ffmpeg frames exit ${code}: ${err.slice(-400)}`));
		});
	});
}

async function main() {
	const bugs = /** @type {string[]} */ ([]);
	const log = /** @type {Array<{t:number,label:string}>} */ ([]);
	const t0 = Date.now();
	/** @param {string} label */
	const mark = (label) => {
		const t = Number(((Date.now() - t0) / 1000).toFixed(2));
		log.push({ t, label });
		console.log(`  [${t.toFixed(2)}s] ${label}`);
	};

	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(outDir, { recursive: true });
	await mkdir(tmpRoot, { recursive: true });

	const { userId, cookie } = await mintStaffCookie();
	await seedOpenReports(userId);
	mark('seeded two open reports');

	const rawMov = path.join(tmpRoot, 'screen-raw.mkv');
	const dest = path.join(outDir, 'reports-resolve-dismiss.webm');
	const framesDir = path.join(outDir, 'self-watch-frames');

	const browser = await chromium.launch({
		channel: 'chrome',
		headless: false,
		args: [
			`--window-position=${WIN.x},${WIN.y}`,
			`--window-size=${WIN.w},${WIN.h}`,
			'--disable-features=TranslateUI'
		]
	});

	const context = await browser.newContext({
		viewport: { width: WIN.w, height: WIN.h },
		baseURL
	});
	await context.addCookies([cookie]);
	const page = await context.newPage();

	/** @type {import('node:child_process').ChildProcessWithoutNullStreams | null} */
	let recorder = null;

	try {
		await page.goto('/staff/reports?status=open', { waitUntil: 'networkidle' });
		if (/sign-in|reauthenticate/i.test(page.url())) {
			bugs.push(`staff session rejected (${page.url()})`);
			throw new Error(bugs[0]);
		}
		await page.bringToFront();
		await sleep(800);

		const openCount = await page.locator('li[data-report-reason]').count();
		if (openCount !== 2) bugs.push(`expected 2 open reports, got ${openCount}`);
		const body = await page.locator('body').innerText();
		if (!body.includes(REPORTS.resolveReason)) bugs.push('resolve reason missing');
		if (!body.includes(REPORTS.dismissReason)) bugs.push('dismiss reason missing');
		await page.screenshot({ path: path.join(outDir, 'reports-open.png'), fullPage: false });
		mark('open queue ready');

		// Continuous OS screen capture WITH system cursor. Device 4 = Capture screen 0.
		recorder = spawn(
			'ffmpeg',
			[
				'-y',
				'-f',
				'avfoundation',
				'-capture_cursor',
				'1',
				'-pixel_format',
				'uyvy422',
				'-framerate',
				'30',
				'-i',
				'4:none',
				'-c:v',
				'libx264',
				'-pix_fmt',
				'yuv420p',
				'-preset',
				'ultrafast',
				'-crf',
				'22',
				rawMov
			],
			{ stdio: ['ignore', 'ignore', 'pipe'] }
		);
		let recErr = '';
		recorder.stderr.on('data', (c) => {
			recErr += String(c);
		});
		await sleep(1800);
		if (recorder.exitCode != null) {
			throw new Error(`ffmpeg died early: ${recErr.slice(-800)}`);
		}
		if (!(await statExists(rawMov))) {
			await sleep(500);
		}
		mark('ffmpeg screen+cursor recording started');

		// Resolve
		const resolveRow = page.locator(`li[data-report-reason="${REPORTS.resolveReason}"]`);
		const resolveBtn = resolveRow.getByRole('button', { name: 'Resolve' });
		const resolvePt = await screenCenter(page, resolveBtn);
		mark(`move OS cursor → Resolve (${resolvePt.x.toFixed(0)},${resolvePt.y.toFixed(0)})`);
		const resolveGone = resolveRow.waitFor({ state: 'detached', timeout: 20000 });
		await osClick(resolvePt.x, resolvePt.y, { steps: 56, dwellMs: 450 });
		await resolveGone;
		mark('Resolve click landed — row left Open');
		await sleep(1200);
		await page.screenshot({ path: path.join(outDir, 'reports-after-resolve.png'), fullPage: false });

		const afterResolve = await page.locator('li[data-report-reason]').count();
		if (afterResolve !== 1) bugs.push(`expected 1 open after Resolve, got ${afterResolve}`);

		// Dismiss
		const dismissRow = page.locator(`li[data-report-reason="${REPORTS.dismissReason}"]`);
		const dismissBtn = dismissRow.getByRole('button', { name: 'Dismiss' });
		const dismissPt = await screenCenter(page, dismissBtn);
		mark(`move OS cursor → Dismiss (${dismissPt.x.toFixed(0)},${dismissPt.y.toFixed(0)})`);
		const dismissGone = dismissRow.waitFor({ state: 'detached', timeout: 20000 });
		await osClick(dismissPt.x, dismissPt.y, { steps: 56, dwellMs: 450 });
		await dismissGone;
		mark('Dismiss click landed — Open empty');
		await sleep(1400);
		await page.screenshot({ path: path.join(outDir, 'reports-after-dismiss.png'), fullPage: false });

		const afterDismiss = await page.locator('li[data-report-reason]').count();
		if (afterDismiss !== 0 && !(await page.getByText('No open reports.').count())) {
			bugs.push(`expected empty Open after Dismiss, got ${afterDismiss}`);
		}

		await sleep(800);
		mark('hold end frame');
	} finally {
		if (recorder && recorder.exitCode == null) {
			recorder.kill('SIGINT');
			for (let i = 0; i < 40; i++) {
				await sleep(250);
				if (recorder.exitCode != null) break;
			}
			try {
				recorder.kill('SIGKILL');
			} catch {
				// ignore
			}
			await sleep(800);
		}
		await context.close().catch(() => {});
		await browser.close().catch(() => {});
	}

	if (!(await statExists(rawMov))) {
		bugs.push('screen-raw.mkv missing after ffmpeg stop (Screen Recording permission?)');
	}

	// Retina: avfoundation frames are device pixels. WIN is CSS/points.
	const scale = await detectDisplayScale(rawMov);
	try {
		await cropToWebm(rawMov, dest, {
			x: Math.round(WIN.x * scale),
			y: Math.round(WIN.y * scale),
			w: Math.round(WIN.w * scale),
			h: Math.round(WIN.h * scale)
		});
		mark(`cropped webm scale=${scale} → ${dest}`);
	} catch (error) {
		bugs.push(String(error instanceof Error ? error.message : error));
		try {
			await new Promise((resolve, reject) => {
				const ff = spawn(
					'ffmpeg',
					['-y', '-i', rawMov, '-c:v', 'libvpx-vp9', '-b:v', '2M', '-an', dest],
					{ stdio: ['ignore', 'ignore', 'pipe'] }
				);
				let err = '';
				ff.stderr.on('data', (c) => {
					err += String(c);
				});
				ff.on('close', (code) => {
					if (code === 0) resolve(undefined);
					else reject(new Error(err.slice(-400)));
				});
			});
			bugs.push(`used full-screen encode fallback (crop failed; scale probe=${scale})`);
		} catch (fallbackError) {
			bugs.push(`encode failed: ${fallbackError}`);
		}
	}

	try {
		await rm(framesDir, { recursive: true, force: true });
		await extractReviewFrames(dest, framesDir);
		mark('extracted self-watch frames @ 2fps');
	} catch (error) {
		bugs.push(`frame extract failed: ${error}`);
	}

	const pass = bugs.length === 0;
	const notes = [
		`# Reports Resolve/Dismiss real-pointer: ${pass ? 'PASS' : 'FAIL'}`,
		'',
		'- Mode: continuous OS screen capture (`avfoundation` Capture screen 0) with `-capture_cursor 1`',
		'- Clicks: Quartz CGEvent (real system pointer). No DOM `#proof-cursor`. No Playwright `recordVideo`.',
		`- Base: ${baseURL}`,
		`- Video: \`reports-resolve-dismiss.webm\``,
		`- Resolve reason: ${REPORTS.resolveReason}`,
		`- Dismiss reason: ${REPORTS.dismissReason}`,
		'',
		'## Timeline',
		...log.map((e) => `- ${e.t.toFixed(2)}s ${e.label}`),
		'',
		'## Bugs',
		...(bugs.length ? bugs.map((b) => `- ${b}`) : ['- none']),
		'',
		'## Self-watch gate',
		'- Frames: `self-watch-frames/` (2 fps). Must show real OS cursor, continuous motion, Resolve then Dismiss.',
		'- Parent agent must visually reject spliced frames / fake red circle / missing clicks before claiming PASS.',
		''
	].join('\n');
	await writeFile(path.join(outDir, 'VERDICT-real-pointer.md'), notes);
	await writeFile(path.join(outDir, 'VERDICT.md'), notes);
	await copyFile(dest, path.join(outDir, 'reports-resolve-dismiss-real-pointer.webm')).catch(() => {});

	console.log(pass ? 'PASS' : 'FAIL');
	console.log('Video:', dest);
	console.log('Notes:', path.join(outDir, 'VERDICT-real-pointer.md'));
	if (!pass) {
		console.error(bugs.join('\n'));
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
