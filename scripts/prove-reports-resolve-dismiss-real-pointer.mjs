/**
 * Continuous native macOS screen recording of staff Lock → Resolve → Dismiss.
 *
 * Uses `screencapture -V -k` (one continuous take, system cursor).
 * Quartz moves the real OS pointer onto each button; Playwright `locator.click`
 * lands the action (Quartz HID clicks need Accessibility we don't have).
 * No Playwright recordVideo. No DOM cursor.
 *
 * Usage: node scripts/prove-reports-resolve-dismiss-real-pointer.mjs [baseUrl]
 */
import { chromium } from '@playwright/test';
import { makeSignature } from 'better-auth/crypto';
import { spawn } from 'node:child_process';
import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const baseURL = process.argv[2] || 'http://127.0.0.1:5174';
const outDir = path.join(root, '.artifacts/verify-mariTools/staff-reject-resolve-dismiss');
const tmpRoot = path.join(root, '.artifacts/verify-mariTools/_capture-tmp-reports-real-pointer');
const STAFF_EMAIL = 'team@marihacks.com';
const WIN = Object.freeze({ x: 40, y: 40, w: 1280, h: 820 });
/** Whole take length for screencapture -V (seconds). Covers Lock + Resolve + Dismiss. */
const RECORD_SECONDS = 55;

const REPORTS = Object.freeze({
	lockThread: 'c1111111-1111-4111-8111-111111111111',
	resolveThread: 'c2222222-2222-4222-8222-222222222222',
	dismissThread: 'c3333333-3333-4333-8333-333333333333',
	lockReport: 'c6666666-6666-4666-8666-666666666666',
	resolveReport: 'c4444444-4444-4444-8444-444444444444',
	dismissReport: 'c5555555-5555-4555-8555-555555555555',
	lockReason: 'proof-lock spam in lounge',
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

/** @param {string} filePath */
async function exists(filePath) {
	try {
		await access(filePath, fsConstants.F_OK);
		return true;
	} catch {
		return false;
	}
}

/** @param {string} filePath */
async function sha256File(filePath) {
	const hash = createHash('sha256');
	const data = await readFile(filePath);
	hash.update(data);
	return hash.digest('hex');
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
			`insert into mt_student_profiles (
				user_id, student_id, display_name, role, version, created_at, updated_at
			) values ($1, $2, $3, 'student', 1, now(), now())
			on conflict (user_id) do update set
				display_name = excluded.display_name,
				updated_at = now()`,
			[authorId, `proof-${authorId.slice(0, 8)}`, 'Alex Rivera']
		);
		await client.query(
			`delete from mt_forum_reports
			 where status = 'open'
			    or id in ($1, $2, $3)
			    or reason like 'staff-portal-proof%'
			    or reason like 'proof-%'`,
			[REPORTS.lockReport, REPORTS.resolveReport, REPORTS.dismissReport]
		);
		for (const [threadId, title, body] of [
			[REPORTS.lockThread, 'Spam in the lounge thread', 'Seeded for Lock film.'],
			[REPORTS.resolveThread, 'Homework dump in #help', 'Seeded for Resolve film.'],
			[REPORTS.dismissThread, 'Off-topic weekend plans', 'Seeded for Dismiss film.']
		]) {
			await client.query(
				`insert into mt_forum_threads (
					id, title, body, category, author_user_id, version, created_at, updated_at,
					locked_at, removed_at
				) values ($1, $2, $3, 'student-life', $4, 1, now(), now(), null, null)
				on conflict (id) do update set
					title = excluded.title,
					body = excluded.body,
					author_user_id = excluded.author_user_id,
					locked_at = null,
					removed_at = null,
					updated_at = now()`,
				[threadId, title, body, authorId]
			);
		}
		for (const [reportId, threadId, reason] of [
			[REPORTS.lockReport, REPORTS.lockThread, REPORTS.lockReason],
			[REPORTS.resolveReport, REPORTS.resolveThread, REPORTS.resolveReason],
			[REPORTS.dismissReport, REPORTS.dismissThread, REPORTS.dismissReason]
		]) {
			await client.query(
				`insert into mt_forum_reports (
					id, target_kind, target_id, reporter_user_id, reason, status, version, created_at, updated_at
				) values ($1, 'thread', $2, $3, $4, 'open', 1, now(), now())
				on conflict (id) do update set
					reason = excluded.reason,
					status = 'open',
					resolved_at = null,
					updated_at = now()`,
				[reportId, threadId, authorId, reason]
			);
		}
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
 * Slow continuous OS pointer move (no click).
 * @param {number} x
 * @param {number} y
 * @param {{ steps?: number }} [opts]
 */
async function osMove(x, y, opts = {}) {
	const steps = opts.steps ?? 40;
	const script = `
import Quartz, time, sys
x, y = float(sys.argv[1]), float(sys.argv[2])
steps = int(sys.argv[3])
ev = Quartz.CGEventCreate(None)
cur = Quartz.CGEventGetLocation(ev)
for i in range(1, steps + 1):
    t = i / steps
    e = t * t * (3 - 2 * t)
    nx = cur.x + (x - cur.x) * e
    ny = cur.y + (y - cur.y) * e
    me = Quartz.CGEventCreateMouseEvent(None, Quartz.kCGEventMouseMoved, (nx, ny), Quartz.kCGMouseButtonLeft)
    Quartz.CGEventPost(Quartz.kCGHIDEventTap, me)
    time.sleep(0.016)
print(f"moved {x:.1f},{y:.1f}")
`;
	await new Promise((resolve, reject) => {
		const child = spawn('python3', ['-c', script, String(x), String(y), String(steps)], {
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
			} else reject(new Error(`Quartz move failed: ${err || out}`));
		});
	});
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} target
 */
async function screenCenter(page, target) {
	await target.scrollIntoViewIfNeeded();
	await sleep(300);
	const box = await target.boundingBox();
	if (!box) throw new Error('no bounding box');
	const session = await page.context().newCDPSession(page);
	const { windowId } = await session.send('Browser.getWindowForTarget');
	const { bounds } = await session.send('Browser.getWindowBounds', { windowId });
	const chromeMetrics = await page.evaluate(() => ({
		chromeH: Math.max(0, window.outerHeight - window.innerHeight),
		dpr: window.devicePixelRatio || 1,
		sx: window.screenX,
		sy: window.screenY,
		ox: window.outerWidth,
		oy: window.outerHeight,
		ix: window.innerWidth,
		iy: window.innerHeight
	}));
	await session.detach().catch(() => {});
	// Prefer live screenX/Y + chrome chrome; CDP bounds can lag after activate.
	const left = Number.isFinite(chromeMetrics.sx) ? chromeMetrics.sx : bounds.left;
	const top = Number.isFinite(chromeMetrics.sy) ? chromeMetrics.sy : bounds.top;
	const chromeH =
		chromeMetrics.chromeH > 0
			? chromeMetrics.chromeH
			: Math.max(0, (bounds.height || 0) - chromeMetrics.iy);
	return {
		x: left + box.x + box.width / 2,
		y: top + chromeH + box.y + box.height / 2,
		meta: { left, top, chromeH, box, bounds, chromeMetrics }
	};
}

/**
 * Activate Google Chrome so Quartz clicks hit the headed window.
 */
async function activateChrome() {
	await new Promise((resolve) => {
		const child = spawn('osascript', ['-e', 'tell application "Google Chrome" to activate'], {
			stdio: ['ignore', 'ignore', 'ignore']
		});
		child.on('close', () => resolve(undefined));
	});
	await sleep(250);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} row
 * @param {'Lock'|'Mute'|'Ban'|'Resolve'|'Dismiss'} action
 * @param {(label: string) => void} mark
 */
async function clickActionUntilGone(page, row, action, mark) {
	const btn = row.getByRole('button', { name: action, exact: true });
	for (let attempt = 1; attempt <= 3; attempt++) {
		await activateChrome();
		await page.bringToFront();
		await btn.scrollIntoViewIfNeeded();
		await sleep(200);
		const pt = await screenCenter(page, btn);
		mark(
			`${action} attempt ${attempt} @ ${pt.x.toFixed(0)},${pt.y.toFixed(0)} chromeH=${pt.meta.chromeH}`
		);
		// Quartz moves the real OS cursor onto the button (visible on screencapture -k).
		await osMove(pt.x, pt.y, { steps: 70 });
		await sleep(800);
		const gone = row
			.waitFor({ state: 'detached', timeout: 8_000 })
			.then(() => true)
			.catch(() => false);
		// Land while cursor is already on the control (Quartz HID click needs Accessibility).
		await btn.click({ timeout: 5000 }).catch(() => {});
		const detached = await gone;
		if (detached) {
			mark(`${action} landed (Quartz hover + locator click)`);
			return true;
		}
		mark(`${action} miss — retry`);
	}
	return false;
}

/**
 * Frontmost Google Chrome window id for `screencapture -l`.
 */
async function findChromeWindowId() {
	const script = `
import Quartz, json
wins = Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionOnScreenOnly, Quartz.kCGNullWindowID)
out = []
for w in wins:
    owner = w.get('kCGWindowOwnerName') or ''
    if owner != 'Google Chrome':
        continue
    b = w.get('kCGWindowBounds') or {}
    out.append({
        'id': int(w.get('kCGWindowNumber') or 0),
        'name': w.get('kCGWindowName') or '',
        'x': float(b.get('X') or 0),
        'y': float(b.get('Y') or 0),
        'w': float(b.get('Width') or 0),
        'h': float(b.get('Height') or 0),
    })
print(json.dumps(out))
`;
	const raw = await new Promise((resolve, reject) => {
		const child = spawn('python3', ['-c', script], { stdio: ['ignore', 'pipe', 'pipe'] });
		let out = '';
		let err = '';
		child.stdout.on('data', (c) => {
			out += String(c);
		});
		child.stderr.on('data', (c) => {
			err += String(c);
		});
		child.on('close', (code) => {
			if (code === 0) resolve(out.trim());
			else reject(new Error(err || 'window list failed'));
		});
	});
	/** @type {Array<{id:number,name:string,x:number,y:number,w:number,h:number}>} */
	const wins = JSON.parse(raw || '[]');
	if (!wins.length) throw new Error('no on-screen Google Chrome window');
	wins.sort((a, b) => {
		const da = Math.abs(a.x - WIN.x) + Math.abs(a.y - WIN.y) + Math.abs(a.w - WIN.w);
		const db = Math.abs(b.x - WIN.x) + Math.abs(b.y - WIN.y) + Math.abs(b.w - WIN.w);
		return da - db;
	});
	return wins[0];
}

/**
 * Continuous window recording with click flashes (never full desktop).
 * @param {string} movPath
 * @param {number} seconds
 * @param {number} windowId
 */
function startScreenCapture(movPath, seconds, windowId) {
	const child = spawn(
		'screencapture',
		['-l', String(windowId), '-V', String(seconds), '-k', '-x', movPath],
		{ stdio: ['ignore', 'ignore', 'pipe'] }
	);
	let err = '';
	child.stderr.on('data', (c) => {
		err += String(c);
	});
	return {
		child,
		err: () => err,
		wait: () =>
			new Promise((resolve, reject) => {
				child.on('close', (code) => {
					if (code === 0) resolve(undefined);
					else reject(new Error(`screencapture exit ${code}: ${err.slice(-400)}`));
				});
			})
	};
}

/**
 * @param {string} movPath
 * @param {string} webmPath
 */
async function encodeWebm(movPath, webmPath) {
	await new Promise((resolve, reject) => {
		const ff = spawn(
			'ffmpeg',
			['-y', '-i', movPath, '-c:v', 'libvpx-vp9', '-b:v', '3M', '-row-mt', '1', '-an', webmPath],
			{ stdio: ['ignore', 'ignore', 'pipe'] }
		);
		let err = '';
		ff.stderr.on('data', (c) => {
			err += String(c);
		});
		ff.on('close', (code) => {
			if (code === 0) resolve(undefined);
			else reject(new Error(`ffmpeg encode exit ${code}: ${err.slice(-500)}`));
		});
	});
}

/**
 * @param {string} movPath
 * @param {string} webmPath
 * @param {{ x: number, y: number, w: number, h: number, scale: number }} crop
 */
async function encodeCroppedWebm(movPath, webmPath, crop) {
	const x = Math.round(crop.x * crop.scale);
	const y = Math.round(crop.y * crop.scale);
	const w = Math.round(crop.w * crop.scale);
	const h = Math.round(crop.h * crop.scale);
	await new Promise((resolve, reject) => {
		const ff = spawn(
			'ffmpeg',
			[
				'-y',
				'-i',
				movPath,
				'-vf',
				`crop=${w}:${h}:${x}:${y},fps=30`,
				'-c:v',
				'libvpx-vp9',
				'-b:v',
				'3M',
				'-row-mt',
				'1',
				'-an',
				webmPath
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

/** @param {string} webmPath @param {string} framesDir */
async function extractFrames(webmPath, framesDir) {
	await mkdir(framesDir, { recursive: true });
	await new Promise((resolve, reject) => {
		const ff = spawn(
			'ffmpeg',
			['-y', '-i', webmPath, '-vf', 'fps=5', path.join(framesDir, 'frame-%03d.png')],
			{ stdio: ['ignore', 'ignore', 'pipe'] }
		);
		let err = '';
		ff.stderr.on('data', (c) => {
			err += String(c);
		});
		ff.on('close', (code) => {
			if (code === 0) resolve(undefined);
			else reject(new Error(`frame extract failed: ${err.slice(-300)}`));
		});
	});
}

/** @param {string} movPath */
async function probeScale(movPath) {
	return 1;
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

	const dest = path.join(outDir, 'reports-resolve-dismiss.webm');
	const destCopy = path.join(outDir, 'reports-resolve-dismiss-real-pointer.webm');
	const framesDir = path.join(outDir, 'self-watch-frames');
	const rawMov = path.join(tmpRoot, 'continuous.mov');

	await rm(dest, { force: true });
	await rm(destCopy, { force: true });
	await rm(framesDir, { recursive: true, force: true });

	const { userId, cookie } = await mintStaffCookie();
	await seedOpenReports(userId);
	mark('seeded two open reports');

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
		viewport: { width: WIN.w, height: 740 },
		baseURL
	});
	await context.addCookies([cookie]);
	const page = await context.newPage();

	/** @type {ReturnType<typeof startScreenCapture> | null} */
	let capture = null;

	try {
		await page.goto('/staff/reports?status=open', { waitUntil: 'networkidle' });
		if (/sign-in|reauthenticate/i.test(page.url())) {
			bugs.push(`staff session rejected (${page.url()})`);
			throw new Error(bugs[0]);
		}
		await page.bringToFront();
		await sleep(600);

		const openCount = await page.locator('tr[data-report-reason]').count();
		if (openCount !== 3) bugs.push(`expected 3 open reports before film, got ${openCount}`);
		const bodyText = await page.locator('body').innerText();
		if (!/Spam in the lounge thread/i.test(bodyText)) {
			bugs.push('human target title missing (Spam in the lounge thread)');
		}
		if (!/Alex Rivera/i.test(bodyText)) {
			bugs.push('human reporter/author label missing (Alex Rivera)');
		}
		if (!/\bLock\b/.test(bodyText) || !/\bMute\b/.test(bodyText) || !/\bBan\b/.test(bodyText)) {
			bugs.push('Lock/Mute/Ban actions missing on open reports');
		}
		if (/c2222222-2222-4222-8222-222222222222/.test(bodyText)) {
			bugs.push('raw thread UUID still visible in reports table');
		}
		await page.screenshot({ path: path.join(outDir, 'reports-open.png'), fullPage: false });
		mark(`open queue ready (${openCount})`);

		// Park OS cursor at a known corner so the first move is long and visible.
		await osMove(WIN.x + 120, WIN.y + 200, { steps: 30 });
		await sleep(200);

		await activateChrome();
		// Keep other fullscreen apps from stealing the OS cursor target.
		spawn('osascript', [
			'-e',
			'tell application "System Events" to set visible of (every process whose name contains "Raphael") to false'
		]);
		await sleep(400);
		const chromeWin = await findChromeWindowId();
		mark(`chrome window id=${chromeWin.id} bounds=${chromeWin.w}x${chromeWin.h}@${chromeWin.x},${chromeWin.y}`);

		capture = startScreenCapture(rawMov, RECORD_SECONDS, chromeWin.id);
		await sleep(1200);
		if (capture.child.exitCode != null) {
			throw new Error(`screencapture died early: ${capture.err().slice(-500)}`);
		}
		// Gate: first second of the window tape must be the reports page (Playwright truth + title).
		const title = await page.title();
		if (!/Reports/i.test(title)) bugs.push(`unexpected page title during film: ${title}`);
		mark(`screencapture -l ${chromeWin.id} -V ${RECORD_SECONDS} -k started`);

		await sleep(1500);
		mark('hold queue=3');

		// Real mod from reports, then Resolve, then Dismiss — one continuous OS-pointer take.
		const lockRow = page.locator(`tr[data-report-reason="${REPORTS.lockReason}"]`);
		const locked = await clickActionUntilGone(page, lockRow, 'Lock', mark);
		if (!locked) bugs.push('Lock did not remove row after retries');
		await sleep(1800);
		const afterLock = await page.locator('tr[data-report-reason]').count();
		if (afterLock !== 2) bugs.push(`expected queue=2 after Lock, got ${afterLock}`);
		else mark('hold queue=2');
		await page.screenshot({ path: path.join(outDir, 'reports-after-lock.png'), fullPage: false });

		const resolveRow = page.locator(`tr[data-report-reason="${REPORTS.resolveReason}"]`);
		const resolved = await clickActionUntilGone(page, resolveRow, 'Resolve', mark);
		if (!resolved) bugs.push('Resolve did not remove row after retries');
		await sleep(1800);
		const afterResolve = await page.locator('tr[data-report-reason]').count();
		if (afterResolve !== 1) bugs.push(`expected queue=1 after Resolve, got ${afterResolve}`);
		else mark('hold queue=1');
		await page.screenshot({ path: path.join(outDir, 'reports-after-resolve.png'), fullPage: false });

		const dismissRow = page.locator(`tr[data-report-reason="${REPORTS.dismissReason}"]`);
		if ((await dismissRow.count()) < 1) {
			bugs.push('dismiss row missing after Resolve');
		} else {
			const dismissed = await clickActionUntilGone(page, dismissRow, 'Dismiss', mark);
			if (!dismissed) bugs.push('Dismiss did not remove row after retries');
		}
		await sleep(2000);
		const afterDismiss = await page.locator('tr[data-report-reason]').count();
		const emptyCopy = await page.getByText('No open reports.').count();
		if (afterDismiss !== 0 && !emptyCopy) {
			bugs.push(`expected queue=0 after Dismiss, got ${afterDismiss}`);
		} else mark('hold queue=0');
		await page.screenshot({ path: path.join(outDir, 'reports-after-dismiss.png'), fullPage: false });

		mark('waiting for screencapture to finish continuous take');
		if (capture) {
			await capture.wait();
			capture = null;
		}
		mark('screencapture finished');
	} catch (error) {
		bugs.push(String(error instanceof Error ? error.message : error));
		mark(`error during film: ${bugs[bugs.length - 1]}`);
		if (capture) {
			try {
				await capture.wait();
			} catch {
				// ignore
			}
			capture = null;
		}
	} finally {
		if (capture && capture.child.exitCode == null) {
			try {
				capture.child.kill('SIGINT');
			} catch {
				// ignore
			}
			await sleep(1000);
		}
		await context.close().catch(() => {});
		await browser.close().catch(() => {});
	}

	if (!(await exists(rawMov))) {
		bugs.push('continuous.mov missing — Screen Recording permission for Terminal/Cursor?');
	} else {
		try {
			await encodeWebm(rawMov, dest);
			mark('encoded Chrome-window webm (no desktop crop)');
			await copyFile(dest, destCopy);
			await extractFrames(dest, framesDir);
			mark('extracted self-watch frames @ 5fps');
		} catch (error) {
			bugs.push(String(error instanceof Error ? error.message : error));
		}
	}

	let sha = '';
	if (await exists(dest)) {
		sha = await sha256File(dest);
		mark(`sha256 ${sha.slice(0, 12)}…`);
	} else {
		bugs.push('webm missing after encode');
	}

	const pass = bugs.length === 0;
	const notes = [
		`# Reports Resolve/Dismiss continuous OS-pointer: ${pass ? 'READY_FOR_ARCHITECT' : 'FAIL'}`,
		'',
		'- Method: `screencapture -l <ChromeWindowID> -V -k` + Quartz OS cursor move + locator.click on hover',
		'- Full-desktop capture is forbidden (Raphael/other apps must not appear).',
		'- No Playwright `recordVideo`. No DOM `#proof-cursor`.',
		'- Quartz HID *clicks* unavailable without Accessibility; move is real OS pointer on -k tape.',
		`- Base: ${baseURL}`,
		`- Video: \`reports-resolve-dismiss.webm\``,
		`- sha256: ${sha || '(none)'}`,
		`- Queue motion claim: 3 → 2 → 1 → 0 with visible **Lock** then **Resolve** then **Dismiss**`,
		'- Fixed table: human thread titles + Alex Rivera labels; Lock/Mute/Ban visible',
		'',
		'## Timeline',
		...log.map((e) => `- ${e.t.toFixed(2)}s ${e.label}`),
		'',
		'## Bugs',
		...(bugs.length ? bugs.map((b) => `- ${b}`) : ['- none']),
		'',
		'## Self-watch gate (parent must do before submitting)',
		'- Watch `self-watch-frames/` @ 5fps AND the webm.',
		'- Reject if pointer teleports, no click flash, hard cuts, UUID targets, or stamp-only Resolve without Lock/Mute/Ban.',
		'- Architect is the only pass/merge stamp. Do not push #103 from this script.',
		''
	].join('\n');

	await writeFile(path.join(outDir, 'VERDICT-real-pointer.md'), notes);
	await writeFile(path.join(outDir, 'VERDICT.md'), notes);

	console.log(pass ? 'READY_FOR_ARCHITECT' : 'FAIL');
	console.log('Video:', dest);
	console.log('SHA256:', sha || '(none)');
	if (!pass) {
		console.error(bugs.join('\n'));
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
