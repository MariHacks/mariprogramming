/**
 * Seed one open forum report and capture the staff reports queue.
 * Usage: node scripts/seed-and-capture-staff-reports-proof.mjs [baseUrl]
 */
import { chromium } from '@playwright/test';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const baseURL = process.argv[2] || 'http://127.0.0.1:5174';
const outDir = path.join(root, '.artifacts/verify-staff/reports');
const tmpRoot = path.join(root, '.artifacts/verify-staff/_capture-tmp-reports');
const cookieFile = path.join(root, '.artifacts/verify-staff/staff-cookie.txt');

const IDS = Object.freeze({
	thread: 'b1111111-1111-4111-8111-111111111111',
	report: 'b2222222-2222-4222-8222-222222222222'
});
const REASON = 'staff-portal-proof spam report';

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
					'max-width:70vw',
					'pointer-events:none',
					'border:1px solid #334155'
				].join(';')
			);
			document.body.appendChild(hud);
		}
		hud.textContent = `${location.pathname}${location.search} · ${text}`;
	}, label);
	await sleep(700);
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

async function seedForumReport() {
	await loadEnvLocal(path.join(root, '.env.local'));
	const databaseUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error('MIGRATION_DATABASE_URL/DATABASE_URL missing from .env.local');

	const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
	const client = await pool.connect();
	try {
		const user = await client.query(
			`select id from "user" where lower(email) = 'team@marihacks.com' limit 1`
		);
		if (!user.rows[0]) {
			const any = await client.query(`select id from "user" order by created_at asc limit 1`);
			if (!any.rows[0]) throw new Error('No user rows available to own the seeded report');
			user.rows[0] = any.rows[0];
		}
		const authorId = user.rows[0].id;

		await client.query('BEGIN');
		await client.query(
			`insert into mt_forum_threads (
				id, title, body, category, author_user_id, version, created_at, updated_at
			) values ($1, $2, $3, 'student-life', $4, 1, now(), now())
			on conflict (id) do update set
				title = excluded.title,
				body = excluded.body,
				removed_at = null,
				updated_at = now()`,
			[IDS.thread, 'Staff reports proof thread', 'Seeded for /staff/reports capture.', authorId]
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
			[IDS.report, IDS.thread, authorId, REASON]
		);
		await client.query('COMMIT');
		return { threadId: IDS.thread, reportId: IDS.report, reason: REASON, reporterUserId: authorId };
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

async function staffCookie() {
	const raw = (await readFile(cookieFile, 'utf8')).trim();
	const eq = raw.indexOf('=');
	if (eq <= 0) throw new Error('staff-cookie.txt malformed');
	return {
		name: raw.slice(0, eq),
		value: raw.slice(eq + 1),
		domain: '127.0.0.1',
		path: '/',
		httpOnly: true,
		secure: false,
		sameSite: 'Lax'
	};
}

/** @param {string} dir */
async function listWebms(dir) {
	const { readdir, stat } = await import('node:fs/promises');
	const names = await readdir(dir);
	const out = [];
	for (const name of names) {
		if (!name.endsWith('.webm')) continue;
		const full = path.join(dir, name);
		const info = await stat(full);
		out.push({ path: full, size: info.size });
	}
	return out;
}

async function main() {
	await mkdir(outDir, { recursive: true });
	await rm(tmpRoot, { recursive: true, force: true });

	const seeded = await seedForumReport();
	console.log('seeded report', seeded.reportId);

	const videoDir = path.join(tmpRoot, 'video');
	await mkdir(videoDir, { recursive: true });

	const browser = await chromium.launch({ channel: 'chrome', headless: true });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL
	});
	await context.addCookies([await staffCookie()]);
	const page = await context.newPage();
	const log = /** @type {Array<{t:number,label:string}>} */ ([]);
	const bugs = /** @type {string[]} */ ([]);
	const t0 = Date.now();

	try {
		await page.goto('/staff', { waitUntil: 'networkidle' });
		await mark(page, t0, log, 'staff shell');
		if (/sign-in|reauthenticate/i.test(page.url())) {
			bugs.push(`staff cookie rejected (${page.url()})`);
		}

		const reportsNav = page.getByRole('link', { name: 'Reports' });
		if ((await reportsNav.count()) === 0) bugs.push('Reports nav link missing');
		await reportsNav.click();
		await page.waitForURL(/\/staff\/reports/, { timeout: 10000 });
		await mark(page, t0, log, 'reports queue');

		const body = await page.locator('body').innerText();
		if (!body.includes('Reports')) bugs.push('Reports heading missing');
		if (!body.includes(REASON)) bugs.push(`seeded reason missing: ${REASON}`);
		if (!body.includes('open')) bugs.push('open status missing');
		const openLink = page.getByRole('link', { name: /Open thread/i });
		if ((await openLink.count()) === 0) bugs.push('Open thread link missing');
		else {
			const href = await openLink.first().getAttribute('href');
			if (!href?.includes(seeded.threadId)) bugs.push(`thread href wrong: ${href}`);
		}

		await page.screenshot({ path: path.join(outDir, 'reports-queue.png'), fullPage: false });
		await mark(page, t0, log, 'screenshot saved');
	} finally {
		await context.close();
		await browser.close();
	}

	const videos = await listWebms(videoDir);
	videos.sort((a, b) => b.size - a.size);
	const dest = path.join(outDir, 'staff-reports-queue.webm');
	if (videos[0]) await copyFile(videos[0].path, dest);

	const verdict = bugs.length === 0 ? 'PASS' : 'FAIL';
	await writeFile(
		path.join(outDir, 'VERDICT.md'),
		[
			`# Staff reports proof: ${verdict}`,
			'',
			`- Base: ${baseURL}`,
			`- Report: ${seeded.reportId}`,
			`- Thread: ${seeded.threadId}`,
			`- Reason: ${REASON}`,
			`- Video: \`staff-reports-queue.webm\``,
			`- Screenshot: \`reports-queue.png\``,
			'',
			'## Timeline',
			...log.map((entry) => `- ${entry.t.toFixed(2)}s ${entry.label}`),
			'',
			'## Bugs',
			...(bugs.length ? bugs.map((bug) => `- ${bug}`) : ['- none']),
			''
		].join('\n')
	);

	await rm(tmpRoot, { recursive: true, force: true });
	console.log(verdict, path.join(outDir, 'VERDICT.md'));
	if (bugs.length) {
		console.error(bugs.join('\n'));
		process.exitCode = 1;
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
