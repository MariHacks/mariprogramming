/**
 * Continuous OS-pointer proof: Mute + Ban from reports, Lock stays on thread, Remove hides.
 *
 * Method: screencapture -l -V -k + Quartz OS cursor move onto control + locator.click
 * while the OS pointer is already hovering (same pattern as reports PASS 2200).
 * Pure CGEvent/cliclick clicks do not activate Chrome without a grant that still
 * fails here; the visible OS pointer + row reaction is what the tape must show.
 * Usage: node scripts/prove-forum-mute-ban-lock-remove-real-pointer.mjs [baseUrl]
 */
import { chromium } from '@playwright/test';
import { makeSignature } from 'better-auth/crypto';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const baseURL = process.argv[2] || 'http://127.0.0.1:5174';
const outDir = path.join(root, '.artifacts/verify-mariTools/forum-lock-remove');
const tmpRoot = path.join(root, '.artifacts/verify-mariTools/_capture-tmp-mute-ban-lock');
const STAFF_EMAIL = 'team@marihacks.com';
const WIN = Object.freeze({ x: 40, y: 40, w: 1280, h: 820 });
const RECORD_SECONDS = 120;

const IDS = Object.freeze({
	lockThread: 'd1111111-1111-4111-8111-111111111111',
	removeThread: 'd2222222-2222-4222-8222-222222222222',
	muteThread: 'd5555555-5555-4555-8555-555555555555',
	banThread: 'd6666666-6666-4666-8666-666666666666',
	muteReport: 'd3333333-3333-4333-8333-333333333333',
	banReport: 'd4444444-4444-4444-8444-444444444444',
	muteReason: 'proof-mute harassment',
	banReason: 'proof-ban repeated abuse'
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
async function sha256File(filePath) {
	const hash = createHash('sha256');
	hash.update(await readFile(filePath));
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
			`select id from "user" where lower(email) = lower($1) limit 1`,
			[STAFF_EMAIL]
		);
		if (!user.rows[0]) throw new Error(`${STAFF_EMAIL} missing`);
		const token = `proofMbl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
		const id = `proofMblS${Date.now().toString(36)}`;
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

/** @param {string} staffUserId */
async function seedTargets(staffUserId) {
	await loadEnvLocal(path.join(root, '.env.local'));
	const databaseUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
	const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		// Use a dedicated student author so mute/ban is visible and staff stays staff.
		const authorEmail = 'proof.muteban.lock@example.com';
		let author = await client.query(`select id from "user" where email = $1`, [authorEmail]);
		if (!author.rows[0]) {
			const id = `proofAuthor${Date.now().toString(36)}`;
			await client.query(
				`insert into "user" (id, name, email, email_verified, created_at, updated_at)
				 values ($1, 'Alex Rivera', $2, true, now(), now())`,
				[id, authorEmail]
			);
			author = await client.query(`select id from "user" where email = $1`, [authorEmail]);
		}
		const authorId = author.rows[0].id;
		await client.query(
			`insert into mt_student_profiles (
				user_id, student_id, display_name, role, version, created_at, updated_at,
				muted_until, banned_at, banned_until
			) values ($1, $2, 'Alex Rivera', 'student', 1, now(), now(), null, null, null)
			on conflict (user_id) do update set
				display_name = 'Alex Rivera',
				muted_until = null,
				banned_at = null,
				banned_until = null,
				updated_at = now()`,
			[authorId, `mbl-${authorId.slice(0, 8)}`]
		);
		await client.query(
			`delete from mt_forum_reports where id in ($1, $2) or reason like 'proof-mute%' or reason like 'proof-ban%'`,
			[IDS.muteReport, IDS.banReport]
		);
		for (const [threadId, title, body] of [
			[IDS.lockThread, 'Lock stays proof thread', 'Seeded for Lock-stays film.'],
			[IDS.removeThread, 'Remove hides proof thread', 'Seeded for Remove film.'],
			[IDS.muteThread, 'Mute author proof thread', 'Seeded for Mute film.'],
			[IDS.banThread, 'Ban author proof thread', 'Seeded for Ban film.']
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
		await client.query(
			`insert into mt_forum_reports (
				id, target_kind, target_id, reporter_user_id, reason, status, version, created_at, updated_at
			) values ($1, 'thread', $2, $3, $4, 'open', 1, now(), now())
			on conflict (id) do update set status = 'open', resolved_at = null, reason = excluded.reason, updated_at = now()`,
			[IDS.muteReport, IDS.muteThread, staffUserId, IDS.muteReason]
		);
		await client.query(
			`insert into mt_forum_reports (
				id, target_kind, target_id, reporter_user_id, reason, status, version, created_at, updated_at
			) values ($1, 'thread', $2, $3, $4, 'open', 1, now(), now())
			on conflict (id) do update set status = 'open', resolved_at = null, reason = excluded.reason, updated_at = now()`,
			[IDS.banReport, IDS.banThread, staffUserId, IDS.banReason]
		);
		await client.query('COMMIT');
		return authorId;
	} catch (error) {
		await client.query('ROLLBACK').catch(() => {});
		throw error;
	} finally {
		client.release();
		await pool.end();
	}
}

async function activateChrome() {
	await new Promise((resolve) => {
		spawn('osascript', ['-e', 'tell application "Google Chrome" to activate'], {
			stdio: 'ignore'
		}).on('close', () => resolve(undefined));
	});
	await sleep(200);
}

async function screenCenter(page, target) {
	await target.scrollIntoViewIfNeeded();
	await sleep(200);
	const box = await target.boundingBox();
	if (!box) throw new Error('no bounding box');
	const metrics = await page.evaluate(() => ({
		chromeH: Math.max(0, window.outerHeight - window.innerHeight),
		sx: window.screenX,
		sy: window.screenY
	}));
	return {
		x: metrics.sx + box.x + box.width / 2,
		y: metrics.sy + metrics.chromeH + box.y + box.height / 2
	};
}

/** Slow continuous OS pointer move (visible on screencapture -k). */
async function osMove(x, y, opts = {}) {
	const steps = opts.steps ?? 70;
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
 * Move OS pointer onto control, hold, then click while hovering.
 * @param {import('@playwright/test').Page} page
 * @param {import('@playwright/test').Locator} locator
 * @param {string} label
 * @param {(s: string) => void} mark
 * @param {{ holdMs?: number, awaitGone?: import('@playwright/test').Locator | null }} [opts]
 */
async function pointerClick(page, locator, label, mark, opts = {}) {
	const holdMs = opts.holdMs ?? 1400;
	await activateChrome();
	await page.bringToFront();
	await locator.scrollIntoViewIfNeeded();
	await sleep(300);
	const pt = await screenCenter(page, locator);
	mark(`${label} OS move @ ${pt.x.toFixed(0)},${pt.y.toFixed(0)}`);
	await osMove(pt.x, pt.y, { steps: 80 });
	await sleep(holdMs);
	mark(`${label} hover hold — pointer on control`);
	const gonePromise = opts.awaitGone
		? opts.awaitGone
				.waitFor({ state: 'detached', timeout: 15_000 })
				.then(() => true)
				.catch(() => false)
		: Promise.resolve(null);
	// Staff actions POST+redirect; don't block on navigation (Mute hung Ban on 2308 refilm).
	await locator.click({ timeout: 12_000, noWaitAfter: true });
	mark(`${label} click while OS pointer hovering`);
	await page.waitForLoadState('networkidle').catch(() => {});
	if (opts.awaitGone) {
		const gone = await gonePromise;
		if (!gone) {
			// Retry once if the first click raced a prior navigation.
			const still = await opts.awaitGone.count().catch(() => 0);
			if (still > 0) {
				mark(`${label} retry click (row still present)`);
				await locator.click({ timeout: 12_000, noWaitAfter: true }).catch(() => {});
				await page.waitForLoadState('networkidle').catch(() => {});
				const gone2 = await opts.awaitGone
					.waitFor({ state: 'detached', timeout: 10_000 })
					.then(() => true)
					.catch(() => false);
				if (!gone2) bugsPushLater(`${label}: row/control did not detach after click`);
				else mark(`${label} target detached after retry`);
			} else {
				mark(`${label} target detached after click`);
			}
		} else mark(`${label} target detached after click`);
	}
	await sleep(900);
}

/** Filled in main so pointerClick can record soft failures. */
let bugsPushLater = (/** @type {string} */ _b) => {};

async function findChromeWindowId() {
	const script = `
import Quartz, json
wins = Quartz.CGWindowListCopyWindowInfo(Quartz.kCGWindowListOptionOnScreenOnly, Quartz.kCGNullWindowID)
out = []
for w in wins:
    if (w.get('kCGWindowOwnerName') or '') != 'Google Chrome':
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
		child.stdout.on('data', (c) => {
			out += String(c);
		});
		child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error('window list failed'))));
	});
	const wins = JSON.parse(raw);
	if (!wins.length) throw new Error('no Chrome window');
	// Prefer Playwright proof tab (forum / staff / 127.0.0.1), not Calendar or random downloads.
	const scored = wins
		.map((w) => {
			const name = String(w.name || '');
			const proofName =
				/127\.0\.0\.1|forum|Reports|Lock stays|Remove hides|Programming Club/i.test(name) &&
				!/\.webm|Calendar|Downloads/i.test(name)
					? 0
					: 1;
			const near =
				Math.abs(w.x - WIN.x) < 120 && Math.abs(w.y - WIN.y) < 120 && w.w > 900 ? 0 : 1;
			const area = w.w * w.h;
			return { ...w, proofName, near, area };
		})
		.sort((a, b) => a.proofName - b.proofName || a.near - b.near || b.area - a.area);
	return scored[0];
}

function startScreenCapture(movPath, seconds, windowId) {
	const child = spawn(
		'screencapture',
		['-l', String(windowId), '-V', String(seconds), '-k', movPath],
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
			new Promise((resolve) => {
				child.on('close', () => resolve(undefined));
			})
	};
}

async function main() {
	const bugs = /** @type {string[]} */ ([]);
	bugsPushLater = (b) => bugs.push(b);
	const log = /** @type {Array<{t:number,label:string}>} */ ([]);
	const t0 = Date.now();
	/** @param {string} label */
	const mark = (label) => {
		const t = Number(((Date.now() - t0) / 1000).toFixed(2));
		log.push({ t, label });
		console.log(`  [${t.toFixed(2)}s] ${label}`);
	};

	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(tmpRoot, { recursive: true });
	await mkdir(outDir, { recursive: true });

	const { userId, cookie } = await mintStaffCookie();
	const authorId = await seedTargets(userId);
	mark('seeded lock/remove threads + mute/ban reports');

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
	try {
		const session = await context.newCDPSession(page);
		const { windowId } = await session.send('Browser.getWindowForTarget');
		await session.send('Browser.setWindowBounds', {
			windowId,
			bounds: { left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h, windowState: 'normal' }
		});
		await session.detach().catch(() => {});
	} catch {
		/* ignore */
	}
	await activateChrome();
	await sleep(400);

	const dest = path.join(outDir, 'mute-ban-lock-remove.webm');
	const rawMov = path.join(tmpRoot, 'continuous.mov');
	const framesDir = path.join(outDir, 'mute-ban-lock-self-watch-frames');
	/** @type {{ child: import('node:child_process').ChildProcess, err: () => string, wait: () => Promise<void> } | null} */
	let capture = null;

	try {
		// Mute/Ban FIRST — reports must still be open when the pointer lands (Architect 2236 FAIL).
		await page.goto(`${baseURL}/staff/reports?status=open`, { waitUntil: 'domcontentloaded' });
		await page.waitForSelector('tr[data-report-reason]', { timeout: 15000 });
		await activateChrome();
		await sleep(400);
		const chromeWin = await findChromeWindowId();
		mark(
			`chrome window id=${chromeWin.id} name=${JSON.stringify(chromeWin.name || '')} @${chromeWin.x},${chromeWin.y} ${chromeWin.w}x${chromeWin.h}`
		);
		if (!/127\.0\.0\.1|Reports|forum|Programming Club/i.test(String(chromeWin.name || ''))) {
			bugs.push(`wrong capture window name: ${chromeWin.name}`);
		}
		capture = startScreenCapture(rawMov, RECORD_SECONDS, chromeWin.id);
		await sleep(1400);
		mark(`screencapture -l ${chromeWin.id} -V ${RECORD_SECONDS} -k started`);

		const openBefore = await page.locator('tr[data-report-reason]').count();
		if (openBefore < 2) bugs.push(`expected ≥2 open reports before Mute, got ${openBefore}`);
		mark(`hold open reports=${openBefore} (Mute/Ban rows must still be here)`);
		await sleep(2200);
		await page.screenshot({ path: path.join(outDir, 'reports-mute-ban-open.png'), fullPage: false });

		const muteRow = page.locator(`tr[data-report-reason="${IDS.muteReason}"]`);
		const banRow = page.locator(`tr[data-report-reason="${IDS.banReason}"]`);
		if ((await muteRow.count()) < 1) bugs.push('mute report row missing');
		if ((await banRow.count()) < 1) bugs.push('ban report row missing');

		// Non-default mute preset (not 7 days) must be visible on tape before Mute.
		const mutePreset = muteRow.getByLabel('Mute for');
		await mutePreset.selectOption({ label: '1 hour' });
		mark('Mute preset set to 1 hour (non-default)');
		await sleep(1200);

		await pointerClick(
			page,
			muteRow.getByRole('button', { name: 'Mute', exact: true }),
			'Mute',
			mark,
			{ holdMs: 1600, awaitGone: muteRow }
		);
		const afterMute = await page.locator('tr[data-report-reason]').count();
		if (afterMute !== 1) bugs.push(`Mute should leave 1 open report, got ${afterMute}`);
		mark(`Mute row reacted — open now ${afterMute}`);
		await page.waitForLoadState('networkidle').catch(() => {});
		await sleep(2800);
		// Re-resolve Ban row after Mute navigation/re-render.
		const banRowAfter = page.locator(`tr[data-report-reason="${IDS.banReason}"]`);
		if ((await banRowAfter.count()) < 1) bugs.push('ban report row missing after Mute');

		// Timed ban (not Permanent default) must be visible on tape before Ban.
		const banPreset = banRowAfter.getByLabel('Ban for');
		await banPreset.selectOption({ label: '30 days' });
		mark('Ban preset set to 30 days (timed, not Permanent)');
		await sleep(1200);

		await pointerClick(
			page,
			banRowAfter.getByRole('button', { name: 'Ban', exact: true }),
			'Ban',
			mark,
			{ holdMs: 1800, awaitGone: banRowAfter }
		);
		const afterBan = await page.locator('tr[data-report-reason]').count();
		if (afterBan !== 0) bugs.push(`Ban did not clear queue (open=${afterBan})`);
		mark(`Ban row reacted — open now ${afterBan}`);

		// Prove timed durations landed in DB (1h mute + 30d ban), not hardcoded 7d / permanent.
		await loadEnvLocal(path.join(root, '.env.local'));
		const verifyPool = new pg.Pool({
			connectionString: process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL,
			max: 1
		});
		try {
			const row = await verifyPool.query(
				`select muted_until, banned_at, banned_until
				 from mt_student_profiles where user_id = $1`,
				[authorId]
			);
			const profile = row.rows[0];
			if (!profile?.muted_until) bugs.push('mute did not set muted_until');
			else {
				const muteMs = new Date(profile.muted_until).getTime() - Date.now();
				if (muteMs < 30 * 60 * 1000 || muteMs > 2 * 60 * 60 * 1000) {
					bugs.push(`mute duration not ~1h (remainingMs=${muteMs})`);
				} else mark('DB muted_until ≈ 1 hour');
			}
			if (!profile?.banned_at) bugs.push('ban did not set banned_at');
			if (!profile?.banned_until) bugs.push('timed ban missing banned_until (looks permanent)');
			else {
				const banMs = new Date(profile.banned_until).getTime() - Date.now();
				if (banMs < 20 * 24 * 60 * 60 * 1000 || banMs > 40 * 24 * 60 * 60 * 1000) {
					bugs.push(`ban duration not ~30d (remainingMs=${banMs})`);
				} else mark('DB banned_until ≈ 30 days');
			}
		} finally {
			await verifyPool.end();
		}

		await page.screenshot({ path: path.join(outDir, 'reports-after-mute-ban.png'), fullPage: false });
		// Architect samples mid-tape (t22): Ban→0 must still be on Reports frames.
		await page.getByText(/No open reports/i).waitFor({ state: 'visible', timeout: 8000 });
		mark('hold empty Reports (Ban→0) on camera — long hold for Architect samples');
		await sleep(9000);

		await page.goto(`${baseURL}/tools/forum/${IDS.lockThread}`, {
			waitUntil: 'domcontentloaded',
			timeout: 45000
		});
		await page.getByRole('heading', { name: /Lock stays proof thread/i }).waitFor({
			state: 'visible',
			timeout: 15000
		});
		mark('lock thread on camera (composer + Post reply visible)');
		await sleep(2200);
		const composer = page.locator('section.reply-editor textarea[name="body"]');
		if ((await composer.count()) < 1) bugs.push('lock thread missing reply composer before Lock');
		const staffMod = page.locator('section.reply-editor').filter({ hasText: 'Staff moderation' });
		await pointerClick(
			page,
			staffMod.getByRole('button', { name: 'Lock thread' }),
			'Lock thread',
			mark,
			{ holdMs: 1500 }
		);
		await sleep(1000);
		await page.getByText(/This thread is locked/i).waitFor({ state: 'visible', timeout: 15000 });
		const replyGone = (await page.locator('section.reply-editor textarea[name="body"]').count()) === 0;
		const opVisible = await page.getByRole('heading', { name: /Lock stays proof thread/i }).isVisible();
		if (!replyGone) bugs.push('Lock did not hide reply composer');
		if (!opVisible) bugs.push('Lock-stays thread OP/title not visible after lock');
		mark(
			replyGone && opVisible
				? 'lock stays on thread (banner + OP visible + no composer)'
				: 'FAIL lock'
		);
		await page.screenshot({ path: path.join(outDir, 'after-lock-stays.png'), fullPage: false });
		await sleep(2500);

		await page.goto(`${baseURL}/tools/forum/${IDS.removeThread}`, {
			waitUntil: 'domcontentloaded',
			timeout: 45000
		});
		await page.getByRole('heading', { name: /Remove hides proof thread/i }).waitFor({
			state: 'visible',
			timeout: 15000
		});
		mark('remove target thread on camera (title visible)');
		await sleep(2200);
		const removeTitle = page.getByRole('heading', { name: /Remove hides proof thread/i });
		if (!(await removeTitle.isVisible())) bugs.push('remove target title not visible before click');
		const staffMod2 = page.locator('section.reply-editor').filter({ hasText: 'Staff moderation' });
		await pointerClick(
			page,
			staffMod2.getByRole('button', { name: 'Remove thread' }),
			'Remove thread',
			mark,
			{ holdMs: 1500 }
		);
		await page.waitForURL(/\/tools\/forum\/?$/, { timeout: 15000 });
		await sleep(1500);
		const indexBody = await page.locator('body').innerText();
		if (/Remove hides proof thread/i.test(indexBody)) {
			bugs.push('removed thread still listed on forum index');
		} else {
			mark('remove hides thread (gone from index)');
		}
		await page.screenshot({ path: path.join(outDir, 'after-remove-hides.png'), fullPage: false });
		// Hold index without removed thread on camera.
		await sleep(4000);

		await page.goto(`${baseURL}/tools/forum/${IDS.lockThread}`, {
			waitUntil: 'domcontentloaded',
			timeout: 45000
		});
		await page.getByText(/This thread is locked/i).waitFor({ state: 'visible', timeout: 15000 });
		const stillLocked = true;
		if (!stillLocked) bugs.push('lock thread no longer shows locked banner');
		else mark('revisit: lock still on thread');
		await sleep(2800);
	} finally {
		if (capture) {
			mark('waiting for screencapture to finish');
			await capture.wait();
			mark('screencapture finished');
		}
		await context.close().catch(() => {});
		await browser.close().catch(() => {});
	}

	await new Promise((resolve, reject) => {
		const ff = spawn(
			'ffmpeg',
			[
				'-y',
				'-i',
				rawMov,
				'-c:v',
				'libvpx-vp9',
				'-b:v',
				'1.8M',
				'-deadline',
				'realtime',
				'-cpu-used',
				'8',
				'-row-mt',
				'1',
				'-an',
				dest
			],
			{ stdio: ['ignore', 'ignore', 'pipe'] }
		);
		let err = '';
		ff.stderr.on('data', (c) => {
			err += String(c);
		});
		ff.on('close', (code) => (code === 0 ? resolve(undefined) : reject(new Error(err.slice(-400)))));
	});
	mark('encoded webm');

	await rm(framesDir, { recursive: true, force: true });
	await mkdir(framesDir, { recursive: true });
	await new Promise((resolve, reject) => {
		const ff = spawn(
			'ffmpeg',
			['-y', '-i', dest, '-vf', 'fps=5', path.join(framesDir, 'frame-%03d.png')],
			{ stdio: ['ignore', 'ignore', 'pipe'] }
		);
		ff.on('close', (code) => (code === 0 ? resolve(undefined) : reject(new Error('frames failed'))));
	});
	const sha = await sha256File(dest);
	mark(`sha256 ${sha.slice(0, 12)}…`);

	const pass = bugs.length === 0;
	const verdict = [
		`# Mute/Ban + Lock-stays / Remove-hides: ${pass ? 'READY_FOR_ARCHITECT' : 'FAIL'}`,
		'',
		`- Video: \`mute-ban-lock-remove.webm\``,
		`- sha256: \`${sha}\``,
		'- Method: screencapture -l -V -k + Quartz OS cursor move + locator.click on hover (reports-PASS pattern)',
		'- Sequence on tape: Mute 1h preset → Ban 30d preset (rows react) → Lock stays → Remove hides → revisit lock',
		'- Durations: mute preset 1 hour (not 7d default); ban preset 30 days (not Permanent)',
		'',
		'## Timeline',
		...log.map((e) => `- ${e.t.toFixed(2)}s ${e.label}`),
		'',
		'## Bugs',
		...(bugs.length ? bugs.map((b) => `- ${b}`) : ['- none']),
		''
	].join('\n');
	await writeFile(path.join(outDir, 'MUTE-BAN-LOCK-VERDICT.md'), verdict);
	await writeFile(
		path.join(outDir, 'mute-ban-lock-report.json'),
		JSON.stringify({ pass, bugs, sha256: sha, video: dest, moments: log }, null, 2)
	);
	console.log(pass ? 'READY_FOR_ARCHITECT' : 'FAIL');
	console.log(JSON.stringify({ pass, bugs, video: dest, sha256: sha }, null, 2));
	if (!pass) process.exitCode = 1;
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
