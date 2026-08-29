/**
 * Honest browser proof: club Reject + staff report Resolve/Dismiss.
 * Seeds one pending club and two open forum reports, mints a staff session,
 * records webms under .artifacts/verify-mariTools/.
 *
 * Usage: node scripts/prove-staff-reject-resolve-dismiss.mjs [baseUrl]
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
const outDir = path.join(root, '.artifacts/verify-mariTools/staff-reject-resolve-dismiss');
const tmpRoot = path.join(root, '.artifacts/verify-mariTools/_capture-tmp-staff-moderation');
const STAFF_EMAIL = 'team@marihacks.com';

const CLUB = Object.freeze({
	id: 'c1111111-1111-4111-8111-111111111111',
	name: 'Reject Proof Club',
	slug: 'reject-proof-club',
	category: 'STEM',
	description: 'Seeded pending club for Reject film.',
	submitterRole: 'officer'
});

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

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} t0
 * @param {Array<{t:number,label:string}>} log
 * @param {string} label
 * @param {number} [dwellMs]
 */
async function mark(page, t0, log, label, dwellMs = 800) {
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
		const token = `proofMod${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
		const id = `proofModS${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
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
async function seedPendingClubAndReports(authorId) {
	await loadEnvLocal(path.join(root, '.env.local'));
	const databaseUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error('DATABASE_URL missing');

	const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
	const client = await pool.connect();
	const payload = {
		name: CLUB.name,
		slug: CLUB.slug,
		category: CLUB.category,
		description: CLUB.description,
		links: [{ label: 'Site', url: 'https://example.com/reject-proof' }],
		submitterRole: CLUB.submitterRole
	};

	try {
		await client.query('BEGIN');
		// Clear leftover open reports so the film only shows the two seeded rows.
		await client.query(
			`delete from mt_forum_reports
			 where status = 'open'
			    or id in ($1, $2)
			    or reason like 'staff-portal-proof%'`,
			[REPORTS.resolveReport, REPORTS.dismissReport]
		);

		await client.query(
			`insert into mt_club_submissions (
				id, submitter_user_id, payload, status, version, created_at, updated_at
			) values ($1, $2, $3::jsonb, 'pending', 1, now(), now())
			on conflict (id) do update set
				payload = excluded.payload,
				status = 'pending',
				club_id = null,
				updated_at = now()`,
			[CLUB.id, authorId, JSON.stringify(payload)]
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

		await client.query(
			`delete from mt_clubs where slug = $1`,
			[CLUB.slug]
		);
		await client.query('COMMIT');
		return {
			clubId: CLUB.id,
			clubName: CLUB.name,
			clubSlug: CLUB.slug,
			resolveReportId: REPORTS.resolveReport,
			dismissReportId: REPORTS.dismissReport
		};
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

/** @param {string} dir */
async function listWebms(dir) {
	const names = await readdir(dir);
	const out = [];
	for (const name of names) {
		if (!name.endsWith('.webm')) continue;
		const full = path.join(dir, name);
		const info = await stat(full);
		out.push({ path: full, size: info.size });
	}
	return out.sort((a, b) => b.size - a.size);
}

/**
 * @param {import('@playwright/test').Browser} browser
 * @param {import('@playwright/test').Cookie} cookie
 * @param {{ clubName: string, clubSlug: string, clubId: string }} seeded
 */
async function filmClubReject(browser, cookie, seeded) {
	const videoDir = path.join(tmpRoot, 'video-club');
	await mkdir(videoDir, { recursive: true });
	const bugs = /** @type {string[]} */ ([]);
	const log = /** @type {Array<{t:number,label:string}>} */ ([]);
	const t0 = Date.now();

	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL
	});
	await context.addCookies([cookie]);
	const page = await context.newPage();

	try {
		await page.goto('/tools/clubs', { waitUntil: 'networkidle' });
		await mark(page, t0, log, 'staff clubs index');
		const pending = page.locator(`[data-pending-club="${seeded.clubName}"]`);
		if ((await pending.count()) < 1) {
			bugs.push(`pending row missing for ${seeded.clubName}`);
		} else {
			await pending.first().scrollIntoViewIfNeeded();
			await mark(page, t0, log, 'pending club visible', 1100);
			await page.screenshot({ path: path.join(outDir, 'club-pending.png'), fullPage: false });
			await pending.locator('[data-testid="review-submission"]').click();
			await page.waitForURL(new RegExp(`/tools/clubs/submissions/${seeded.clubId}$`, 'i'), {
				timeout: 20000
			});
			await mark(page, t0, log, 'staff review pending');
			const rejectBtn = page.getByRole('button', { name: 'Reject' });
			if ((await rejectBtn.count()) < 1) bugs.push('Reject button missing');
			else {
				await page.locator('.club-submission-actions').scrollIntoViewIfNeeded();
				await mark(page, t0, log, 'Reject on camera', 900);
				await rejectBtn.first().click();
				await page.waitForURL(/\/tools\/clubs\/?$/, { timeout: 20000 });
				await page.waitForLoadState('networkidle');
				await mark(page, t0, log, 'back on clubs after Reject', 1000);

				if ((await page.locator(`[data-pending-club="${seeded.clubName}"]`).count()) > 0) {
					bugs.push('rejected club still in pending queue');
				} else {
					await mark(page, t0, log, 'gone from pending', 1000);
				}

				const published = page.locator(`a.club-row[href="/tools/clubs/${seeded.clubSlug}"]`);
				if ((await published.count()) > 0) {
					bugs.push('rejected club appeared on published list');
				} else {
					await mark(page, t0, log, 'not on published list', 1200);
				}
				await page.screenshot({ path: path.join(outDir, 'club-after-reject.png'), fullPage: false });
			}
		}
	} finally {
		await context.close();
	}

	const videos = await listWebms(videoDir);
	const dest = path.join(outDir, 'club-reject.webm');
	if (videos[0]) await copyFile(videos[0].path, dest);
	else bugs.push('club-reject.webm missing');

	return { bugs, log, video: dest };
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {'open'|'resolved'|'dismissed'} status
 */
async function filterReportsByStatus(page, status) {
	await page.locator('select[name="status"]').selectOption(status);
	await Promise.all([
		page.waitForURL(new RegExp(`[?&]status=${status}\\b`), { timeout: 20000 }),
		page.getByRole('button', { name: 'Apply' }).click()
	]);
	await page.waitForLoadState('networkidle');
}

/**
 * @param {import('@playwright/test').Browser} browser
 * @param {import('@playwright/test').Cookie} cookie
 */
async function filmReportActions(browser, cookie) {
	const videoDir = path.join(tmpRoot, 'video-reports');
	await mkdir(videoDir, { recursive: true });
	const bugs = /** @type {string[]} */ ([]);
	const log = /** @type {Array<{t:number,label:string}>} */ ([]);
	const t0 = Date.now();

	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL
	});
	await context.addCookies([cookie]);
	const page = await context.newPage();

	/**
	 * @param {string} reason
	 * @param {'Resolve'|'Dismiss'} action
	 */
	async function actOnOpenReport(reason, action) {
		if (!/status=open/.test(page.url())) {
			await filterReportsByStatus(page, 'open');
		}
		await mark(page, t0, log, `open queue · ${action} on “${reason}”`, 1400);
		const row = page.locator(`li[data-report-reason="${reason}"]`);
		if ((await row.count()) < 1) {
			bugs.push(`open report missing: ${reason}`);
			return;
		}
		await row.first().scrollIntoViewIfNeeded();
		await mark(page, t0, log, `highlighting row before ${action}`, 1600);
		const clickPromise = row.first().getByRole('button', { name: action }).click();
		await clickPromise;
		await page.waitForLoadState('networkidle');
		await mark(page, t0, log, `${action} submitted for “${reason}”`, 1400);

		const stillOpen = page.locator(`li[data-report-reason="${reason}"]`);
		if ((await stillOpen.count()) > 0) {
			bugs.push(`${action}: report still in Open filter (${reason})`);
		} else {
			await mark(page, t0, log, `${action}: “${reason}” left Open`, 1600);
		}

		const status = action === 'Resolve' ? 'resolved' : 'dismissed';
		await filterReportsByStatus(page, status);
		const inStatus = page.locator(`li[data-report-reason="${reason}"]`);
		if ((await inStatus.count()) < 1) {
			bugs.push(`${action}: report missing from ${status} filter`);
		} else {
			await inStatus.first().scrollIntoViewIfNeeded();
			await mark(page, t0, log, `${action}: “${reason}” under ${status}`, 1800);
		}
	}

	try {
		await page.goto('/staff/reports?status=open', { waitUntil: 'networkidle' });
		if (/sign-in|reauthenticate/i.test(page.url())) {
			bugs.push(`staff session rejected on reports (${page.url()})`);
			return { bugs, log, video: path.join(outDir, 'reports-resolve-dismiss.webm') };
		}
		await mark(page, t0, log, 'reports open queue (seeded pair only)', 1500);
		const body = await page.locator('body').innerText();
		if (!body.includes(REPORTS.resolveReason)) bugs.push('resolve reason missing on open queue');
		if (!body.includes(REPORTS.dismissReason)) bugs.push('dismiss reason missing on open queue');
		if (/staff-portal-proof/i.test(body)) {
			bugs.push('leftover staff-portal-proof still open — seed cleanup failed');
		}
		const openCount = await page.locator('li[data-report-reason]').count();
		if (openCount !== 2) bugs.push(`expected exactly 2 open reports, got ${openCount}`);
		await page.screenshot({ path: path.join(outDir, 'reports-open.png'), fullPage: false });

		await actOnOpenReport(REPORTS.resolveReason, 'Resolve');
		await page.screenshot({ path: path.join(outDir, 'reports-after-resolve.png'), fullPage: false });
		await filterReportsByStatus(page, 'open');
		await actOnOpenReport(REPORTS.dismissReason, 'Dismiss');
		await page.screenshot({ path: path.join(outDir, 'reports-after-dismiss.png'), fullPage: false });

		await filterReportsByStatus(page, 'dismissed');
		const dismissedReasons = await page.locator('li[data-report-reason]').evaluateAll((nodes) =>
			nodes.map((n) => n.getAttribute('data-report-reason') ?? '')
		);
		if (!dismissedReasons.includes(REPORTS.dismissReason)) {
			bugs.push('Dismissed tab missing the clicked dismiss reason');
		}
		if (dismissedReasons.includes(REPORTS.resolveReason)) {
			bugs.push('Dismissed tab incorrectly shows the resolve report');
		}
		await mark(page, t0, log, `Dismissed tab reasons: ${dismissedReasons.join(' | ') || '(none)'}`, 1600);
	} finally {
		await context.close();
	}

	const videos = await listWebms(videoDir);
	const dest = path.join(outDir, 'reports-resolve-dismiss.webm');
	if (videos[0]) await copyFile(videos[0].path, dest);
	else bugs.push('reports-resolve-dismiss.webm missing');

	return { bugs, log, video: dest };
}

async function main() {
	const reportsOnly = process.argv.includes('--reports-only');
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(outDir, { recursive: true });
	await mkdir(tmpRoot, { recursive: true });

	const { userId, cookie } = await mintStaffCookie();
	const seeded = await seedPendingClubAndReports(userId);
	console.log('seeded', seeded);

	const browser = await chromium.launch({ channel: 'chrome', headless: true });
	/** @type {{ bugs: string[], log: Array<{t:number,label:string}>, video: string }} */
	let club = { bugs: [], log: [], video: path.join(outDir, 'club-reject.webm') };
	let reports;
	try {
		if (!reportsOnly) {
			console.log('— club Reject film —');
			club = await filmClubReject(browser, cookie, seeded);
		} else {
			console.log('— skipping club Reject (reports-only) —');
		}
		console.log('— reports Resolve/Dismiss film —');
		reports = await filmReportActions(browser, cookie);
	} finally {
		await browser.close();
	}

	const clubPass = reportsOnly ? true : club.bugs.length === 0;
	const reportsPass = reports.bugs.length === 0;
	const verdict = clubPass && reportsPass ? 'PASS' : 'FAIL';

	const notes = [
		`# Staff Reject / Resolve / Dismiss: ${verdict}`,
		'',
		`- Base: ${baseURL}`,
		`- Mode: ${reportsOnly ? 'reports-only (club tape left untouched)' : 'club + reports'}`,
		`- Club Reject: ${reportsOnly ? 'SKIPPED' : clubPass ? 'PASS' : 'FAIL'} → \`club-reject.webm\``,
		`- Reports Resolve+Dismiss: ${reportsPass ? 'PASS' : 'FAIL'} → \`reports-resolve-dismiss.webm\``,
		`- Club submission: ${seeded.clubId} (${seeded.clubName})`,
		`- Resolve report: ${seeded.resolveReportId}`,
		`- Dismiss report: ${seeded.dismissReportId}`,
		'',
		'## Club Reject timeline',
		...(reportsOnly
			? ['- (not refilmed)']
			: club.log.map((e) => `- ${e.t.toFixed(2)}s ${e.label}`)),
		'',
		'## Reports timeline',
		...reports.log.map((e) => `- ${e.t.toFixed(2)}s ${e.label}`),
		'',
		'## Bugs',
		...(club.bugs.length || reports.bugs.length
			? [...club.bugs, ...reports.bugs].map((b) => `- ${b}`)
			: ['- none']),
		''
	].join('\n');

	await writeFile(path.join(outDir, 'VERDICT.md'), notes);
	await rm(tmpRoot, { recursive: true, force: true });

	console.log(verdict);
	if (!reportsOnly) console.log('Club:', clubPass ? 'PASS' : 'FAIL', club.video);
	console.log('Reports:', reportsPass ? 'PASS' : 'FAIL', reports.video);
	console.log('Notes:', path.join(outDir, 'VERDICT.md'));
	if (!clubPass || !reportsPass) {
		console.error([...club.bugs, ...reports.bugs].join('\n'));
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
