/**
 * Honest browser proof: staff catalog conflict queue shows peer facts side by side,
 * then staff picks one peer ("Use these facts") and the public catalog shows it.
 * Seeds one offering with two conflict contributions, mints a staff session,
 * records under .artifacts/verify-mariTools/catalog-conflicts/.
 *
 * Usage: node scripts/prove-catalog-conflicts-staff.mjs [baseUrl]
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
const outDir = path.join(root, '.artifacts/verify-mariTools/catalog-conflicts');
const tmpRoot = path.join(root, '.artifacts/verify-mariTools/_capture-tmp-catalog-conflicts');
const STAFF_EMAIL = 'team@marihacks.com';

const IDS = Object.freeze({
	course: 'a1111111-1111-4111-8111-111111111111',
	offering: 'a2222222-2222-4222-8222-222222222222',
	left: 'a3333333-3333-4333-8333-333333333333',
	right: 'a4444444-4444-4444-8444-444444444444'
});

const COURSE = Object.freeze({
	code: '420-CFP-01',
	title: 'Conflict Proof Programming',
	section: '00099',
	teacherName: 'Conflict Proof Teacher',
	termId: 'fall-2026'
});

const LEFT_FACTS = Object.freeze({
	books: [{ title: 'Left peer book' }],
	assessments: [{ name: 'Left midterm', weight: 30 }]
});
const RIGHT_FACTS = Object.freeze({
	books: [{ title: 'Right peer book' }],
	assessments: [{ name: 'Right midterm', weight: 40 }]
});

const SHA_LEFT = 'c'.repeat(64);
const SHA_RIGHT = 'd'.repeat(64);

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
		const token = `proofCat${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
		const id = `proofCatS${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
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

/** @param {string} contributorId */
async function seedConflictPeers(contributorId) {
	await loadEnvLocal(path.join(root, '.env.local'));
	const databaseUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error('DATABASE_URL missing');

	const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
	const client = await pool.connect();
	try {
		await client.query('BEGIN');

		const term = await client.query(`select id from mt_academic_terms where id = $1`, [
			COURSE.termId
		]);
		if (!term.rows[0]) {
			throw new Error(`Academic term ${COURSE.termId} missing; seed terms first`);
		}

		await client.query(
			`insert into mt_courses (id, code, canonical_title, version, created_at, updated_at)
			 values ($1, $2, $3, 1, now(), now())
			 on conflict (id) do update set
			 	code = excluded.code,
			 	canonical_title = excluded.canonical_title,
			 	updated_at = now()`,
			[IDS.course, COURSE.code, COURSE.title]
		);

		await client.query(
			`insert into mt_course_offerings (
				id, course_id, term_id, section, teacher_name, version, created_at, updated_at
			) values ($1, $2, $3, $4, $5, 1, now(), now())
			 on conflict (id) do update set
			 	section = excluded.section,
			 	teacher_name = excluded.teacher_name,
			 	updated_at = now()`,
			[IDS.offering, IDS.course, COURSE.termId, COURSE.section, COURSE.teacherName]
		);

		for (const [id, sha, structured] of [
			[IDS.left, SHA_LEFT, LEFT_FACTS],
			[IDS.right, SHA_RIGHT, RIGHT_FACTS]
		]) {
			await client.query(
				`insert into mt_catalog_contributions (
					id, offering_id, contributor_user_id, document_sha256, structured, status,
					version, created_at, updated_at
				) values ($1, $2, $3, $4, $5::jsonb, 'conflict', 1, now(), now())
				 on conflict (id) do update set
				 	structured = excluded.structured,
				 	status = 'conflict',
				 	document_sha256 = excluded.document_sha256,
				 	updated_at = now()`,
				[id, IDS.offering, contributorId, sha, JSON.stringify(structured)]
			);
		}

		await client.query('COMMIT');
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
		await pool.end();
	}
}

/** @param {string} dir */
async function listWebms(dir) {
	/** @type {Array<{path:string,size:number}>} */
	const found = [];
	async function walk(current) {
		let entries = [];
		try {
			entries = await readdir(current, { withFileTypes: true });
		} catch {
			return;
		}
		for (const entry of entries) {
			const full = path.join(current, entry.name);
			if (entry.isDirectory()) await walk(full);
			else if (entry.name.endsWith('.webm')) {
				const info = await stat(full);
				found.push({ path: full, size: info.size });
			}
		}
	}
	await walk(dir);
	return found;
}

async function main() {
	await rm(outDir, { recursive: true, force: true });
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(outDir, { recursive: true });
	await mkdir(tmpRoot, { recursive: true });

	const staff = await mintStaffCookie();
	await seedConflictPeers(staff.userId);

	const videoDir = path.join(tmpRoot, 'video');
	await mkdir(videoDir, { recursive: true });

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
		viewport: { width: 1280, height: 720 }
	});
	await context.addCookies([staff.cookie]);
	const page = await context.newPage();
	const t0 = Date.now();
	/** @type {Array<{t:number,label:string}>} */
	const log = [];
	/** @type {string[]} */
	const bugs = [];

	try {
		await page.goto(`${baseURL}/tools/catalog`, { waitUntil: 'networkidle', timeout: 30000 });
		await mark(page, t0, log, 'public catalog (published only)');
		const publicBody = await page.locator('body').innerText();
		if (publicBody.includes('Left peer book') || publicBody.includes('Right peer book')) {
			bugs.push('conflict peer facts leaked onto public /tools/catalog');
		}
		if (publicBody.includes(COURSE.code) && publicBody.includes('Conflict Proof')) {
			bugs.push('conflict offering appeared on published catalog');
		}
		await page.screenshot({ path: path.join(outDir, 'public-catalog.png'), fullPage: false });

		await page.goto(`${baseURL}/staff/catalog-conflicts`, {
			waitUntil: 'networkidle',
			timeout: 30000
		});
		await mark(page, t0, log, 'staff conflict queue');

		const body = await page.locator('body').innerText();
		if (!body.includes('Catalog conflicts')) bugs.push('heading missing');
		if (!body.includes(COURSE.code)) bugs.push(`course code missing: ${COURSE.code}`);
		if (!body.includes(COURSE.title)) bugs.push(`title missing: ${COURSE.title}`);
		if (!body.includes('Left peer book')) bugs.push('left peer facts missing');
		if (!body.includes('Right peer book')) bugs.push('right peer facts missing');
		if (!body.includes('2 peers') && !body.includes('2 peer')) bugs.push('peer count missing');

		const conflictsNav = page.getByRole('link', { name: 'Catalog conflicts' });
		if ((await conflictsNav.count()) === 0) bugs.push('Catalog conflicts nav link missing');

		await page.screenshot({ path: path.join(outDir, 'staff-conflict-queue.png'), fullPage: true });
		await mark(page, t0, log, 'side-by-side peers on camera', 1400);

		const leftPeer = page.locator(`[data-conflict-peer="${IDS.left}"]`);
		if ((await leftPeer.count()) < 1) {
			bugs.push('left peer card missing');
		} else {
			await leftPeer.scrollIntoViewIfNeeded();
			await mark(page, t0, log, 'choosing Left peer facts', 1600);
			await Promise.all([
				page.waitForURL(/\/staff\/catalog-conflicts\/?$/, { timeout: 20000 }),
				leftPeer.getByTestId('resolve-conflict').click()
			]);
			await page.waitForLoadState('networkidle');
			await mark(page, t0, log, 'after Use these facts (Left)', 1600);

			const afterBody = await page.locator('body').innerText();
			if (/Left peer book|Right peer book/i.test(afterBody) && !/No catalog conflicts/i.test(afterBody)) {
				bugs.push('conflict peers still on staff queue after resolve');
			} else {
				await mark(page, t0, log, 'queue empty after resolve', 1400);
			}
			await page.screenshot({ path: path.join(outDir, 'staff-after-resolve.png'), fullPage: true });
		}

		await page.goto(`${baseURL}/tools/catalog?term=fall-2026`, {
			waitUntil: 'networkidle',
			timeout: 30000
		});
		await mark(page, t0, log, 'public catalog after resolve', 1400);
		const courseRow = page.locator('article.catalog-row').filter({ hasText: COURSE.code });
		if ((await courseRow.count()) < 1) {
			bugs.push('chosen offering missing from public catalog');
		} else {
			await courseRow.getByRole('button', { name: new RegExp(`Expand ${COURSE.code}`) }).click();
			await sleep(600);
			const publishedBody = await courseRow.innerText();
			if (!publishedBody.includes('Left peer book')) {
				bugs.push('chosen Left peer facts missing from public catalog');
			} else {
				await mark(page, t0, log, 'Left peer book published (expanded)', 1600);
			}
			if (publishedBody.includes('Right peer book')) {
				bugs.push('withdrawn Right peer facts leaked onto public catalog');
			}
		}
		await page.screenshot({
			path: path.join(outDir, 'public-catalog-after-resolve.png'),
			fullPage: false
		});
	} finally {
		await context.close();
		await browser.close();
	}

	const videos = await listWebms(videoDir);
	videos.sort((a, b) => b.size - a.size);
	const dest = path.join(outDir, 'catalog-conflicts-staff.webm');
	if (videos[0]) await copyFile(videos[0].path, dest);

	const verdict = bugs.length === 0 ? 'PASS' : 'FAIL';
	await writeFile(
		path.join(outDir, 'VERDICT.md'),
		[
			`# Catalog conflicts staff proof: ${verdict}`,
			'',
			`- Base: ${baseURL}`,
			`- Offering: ${IDS.offering}`,
			`- Course: ${COURSE.code}`,
			`- Choice: Use these facts on Left peer; Right withdrawn`,
			`- Video: \`catalog-conflicts-staff.webm\``,
			`- Screenshots: \`public-catalog.png\`, \`staff-conflict-queue.png\`, \`staff-after-resolve.png\`, \`public-catalog-after-resolve.png\``,
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
