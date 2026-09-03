/**
 * Cross-page proof: Account → Semester → Catalog (one continuous video).
 * Negative: incomplete profile keeps semester gated.
 * Positive: completed nick profile unlocks upload, manual contribute lands on catalog.
 *
 * Usage: node scripts/capture-cross-page-account-semester-catalog.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:5174
 *
 * No fixture PDF in tests/fixtures — builds a text PDF at runtime.
 * NIM auto-extract needs NVIDIA_NIM_API_KEY on the app process; missing-key is documented, not fatal.
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
const outDir = path.join(root, '.artifacts/verify-mariTools/cross-page');
const tmpRoot = path.join(root, '.artifacts/verify-mariTools/_capture-tmp-cross-page');
const NICK_EMAIL = 'nick.zhicheng@gmail.com';
const INCOMPLETE_EMAIL = 'proof.incomplete.crosspage@example.com';
const COURSE_CODE = `PROOF${Date.now().toString(36).slice(-5).toUpperCase()}`;
const COURSE_TITLE = 'Cross-page Physics Proof';

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
	await sleep(750);
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

/** @param {string} content */
function buildTextPdf(content) {
	const payload = Buffer.from(content, 'latin1');
	const objects = [
		'1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
		'2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
		'3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
		`4 0 obj << /Length ${payload.length} >> stream\n${payload.toString('latin1')}\nendstream endobj`,
		'5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj'
	];
	return Buffer.from(
		`%PDF-1.4\n${objects.join('\n')}\ntrailer << /Root 1 0 R >>\n%%EOF\n`,
		'latin1'
	);
}

/**
 * @param {pg.Pool} pool
 * @param {string} userId
 * @param {string} secret
 */
async function mintCookie(pool, userId, secret) {
	const token = `proofX${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
	const id = `proofXSess${Date.now().toString(36)}`;
	await pool.query(
		`insert into session (id, token, user_id, expires_at, created_at, updated_at)
		 values ($1, $2, $3, now() + interval '7 days', now(), now())`,
		[id, token, userId]
	);
	const signed = `${token}.${await makeSignature(token, secret)}`;
	return {
		name: 'mari-staff.session_token',
		value: signed,
		domain: '127.0.0.1',
		path: '/',
		httpOnly: true,
		secure: false,
		sameSite: 'Lax'
	};
}

async function prepareSessions() {
	await loadEnvLocal(path.join(root, '.env.local'));
	const secret = process.env.BETTER_AUTH_SECRET;
	const databaseUrl = process.env.DATABASE_URL;
	if (!secret || !databaseUrl) throw new Error('BETTER_AUTH_SECRET or DATABASE_URL missing');

	const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
	try {
		const nick = await pool.query('select id, email from "user" where email = $1 limit 1', [
			NICK_EMAIL
		]);
		if (!nick.rows[0]) throw new Error(`${NICK_EMAIL} not in user table`);
		const nickProfile = await pool.query(
			`select student_id, display_name, nim_disclosure_accepted_at is not null as nim
			 from mt_student_profiles where user_id = $1`,
			[nick.rows[0].id]
		);
		if (!nickProfile.rows[0]?.nim) {
			throw new Error(`${NICK_EMAIL} profile incomplete (need student id + NIM)`);
		}

		let incomplete = await pool.query('select id from "user" where email = $1 limit 1', [
			INCOMPLETE_EMAIL
		]);
		if (!incomplete.rows[0]) {
			const id = `proofInc${Date.now().toString(36)}`;
			await pool.query(
				`insert into "user" (id, name, email, email_verified, created_at, updated_at)
				 values ($1, $2, $3, true, now(), now())`,
				[id, 'Incomplete Proof', INCOMPLETE_EMAIL]
			);
			incomplete = await pool.query('select id from "user" where email = $1 limit 1', [
				INCOMPLETE_EMAIL
			]);
		}
		const incompleteId = incomplete.rows[0].id;
		await pool.query(
			`insert into account (id, account_id, provider_id, user_id, created_at, updated_at)
			 values ($1, $2, 'google', $3, now(), now())
			 on conflict do nothing`,
			[`proofAcc${incompleteId}`.slice(0, 32), `proof-google-${incompleteId}`, incompleteId]
		);
		// Ensure a Google account row exists even when on conflict is unsupported for this PK shape.
		const google = await pool.query(
			`select id from account where user_id = $1 and provider_id = 'google' limit 1`,
			[incompleteId]
		);
		if (!google.rows[0]) {
			await pool.query(
				`insert into account (id, account_id, provider_id, user_id, created_at, updated_at)
				 values ($1, $2, 'google', $3, now(), now())`,
				[
					`proofAcc${Date.now().toString(36)}`,
					`proof-google-${incompleteId}`,
					incompleteId
				]
			);
		}
		await pool.query('delete from mt_student_profiles where user_id = $1', [incompleteId]);
		await pool.query(
			`insert into mt_student_profiles (user_id, student_id, display_name, role, version, created_at, updated_at)
			 values ($1, $2, $3, 'student', 1, now(), now())`,
			[incompleteId, '9990001', 'Incomplete Proof']
		);

		return {
			completeCookie: await mintCookie(pool, nick.rows[0].id, secret),
			incompleteCookie: await mintCookie(pool, incompleteId, secret),
			nickEmail: NICK_EMAIL,
			incompleteEmail: INCOMPLETE_EMAIL
		};
	} finally {
		await pool.end();
	}
}

async function main() {
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(tmpRoot, { recursive: true });
	await mkdir(outDir, { recursive: true });

	const sessions = await prepareSessions();
	const pdfPath = path.join(tmpRoot, 'outline-cross-page.pdf');
	await writeFile(
		pdfPath,
		buildTextPdf(
			`BT /F1 12 Tf 72 720 Td (Course Outline ${COURSE_CODE} ${COURSE_TITLE}) Tj T* (Midterm 30% due 2026-10-15) Tj T* (Final 40% due 2026-12-10) Tj T* (Required book: University Physics) Tj ET`
		)
	);

	const videoDir = path.join(tmpRoot, 'video');
	await mkdir(videoDir, { recursive: true });

	const browser = await chromium.launch({ channel: 'chrome', headless: true });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL
	});
	const page = await context.newPage();
	const log = /** @type {Array<{t:number,label:string}>} */ ([]);
	const bugs = /** @type {string[]} */ ([]);
	const blockers = /** @type {string[]} */ ([]);
	const proven = /** @type {string[]} */ ([]);
	const t0 = Date.now();

	try {
		await context.addCookies([sessions.incompleteCookie]);
		await page.goto('/tools/semester', { waitUntil: 'networkidle' });
		await mark(page, t0, log, 'NEGATIVE: incomplete profile on semester');
		const negBody = await page.locator('body').innerText();
		if (await page.getByLabel('Course outline PDF').count()) {
			bugs.push('upload enabled for incomplete profile');
		} else {
			proven.push('incomplete profile keeps semester upload gated');
		}
		if (!/Confirm the NVIDIA disclosure|Finish your account|Confirm disclosure/i.test(negBody)) {
			bugs.push('incomplete gate copy missing');
		}
		if (/Sign in to upload outlines/i.test(negBody) && !/Confirm|Finish your account/i.test(negBody)) {
			bugs.push('incomplete profile still shown as guest sign-in');
		}
		await page.screenshot({ path: path.join(outDir, '01-negative-gated.png'), fullPage: false });
		await sleep(900);

		await context.clearCookies();
		await context.addCookies([sessions.completeCookie]);

		await page.goto('/tools/account', { waitUntil: 'networkidle' });
		await mark(page, t0, log, 'POSITIVE: completed account profile');
		const accountBody = await page.locator('body').innerText();
		if (/Continue with Google/i.test(accountBody)) bugs.push('guest CTA on completed account');
		if (!/Sign out|Zhich|Accepted|Saved|display name/i.test(accountBody)) {
			bugs.push('completed profile signals missing on account');
		} else {
			proven.push('account shows completed profile for nick');
		}
		await page.screenshot({ path: path.join(outDir, '02-account-complete.png'), fullPage: false });
		await sleep(800);

		await page.goto('/tools/semester', { waitUntil: 'networkidle' });
		await mark(page, t0, log, 'semester unlocked for completed profile');
		const upload = page.getByLabel('Course outline PDF');
		if ((await upload.count()) < 1) {
			bugs.push('upload missing for completed profile');
		} else {
			proven.push('completed profile unlocks semester upload UI');
			const extractDone = page
				.waitForURL(/\/tools\/semester\?\/extract/, { timeout: 25_000 })
				.catch(() => null);
			await upload.setInputFiles(pdfPath);
			if (!page.url().includes('?/extract')) {
				await page.locator('form[action="?/extract"]').evaluate((form) => {
					if (form instanceof HTMLFormElement) form.requestSubmit();
				}).catch(() => {});
			}
			await extractDone;
			if (!page.url().includes('?/extract')) {
				bugs.push('extract navigation did not complete');
			} else {
				await mark(page, t0, log, 'uploaded runtime text PDF (no tests/fixtures PDF)');
			}
			await page.locator('input[name="courseCode"]').waitFor({ state: 'visible', timeout: 15_000 });
			const afterUpload = await page.locator('body').innerText();
			if (/missing-key|Automatic extraction is unavailable/i.test(afterUpload)) {
				blockers.push(
					'NVIDIA_NIM_API_KEY not loaded in app process (or timed out) — manual review fields used. Desktop/key exists; .env.local has no NIM key.'
				);
				await mark(page, t0, log, 'NIM unavailable: filling fields manually');
			} else if (/could not extract/i.test(afterUpload)) {
				blockers.push('NIM extract failed closed (network/http/timeout); manual fields used');
				await mark(page, t0, log, 'NIM failed closed: filling fields manually');
			}
			if (
				!/Extraction review|Automatic extraction|could not extract|Course code|assessments/i.test(
					afterUpload
				)
			) {
				bugs.push('post-upload review UI not visible');
			} else {
				proven.push('upload yields private extraction review (or manual fallback)');
			}

			await page.locator('input[name="courseCode"]').fill(COURSE_CODE);
			await page.locator('input[name="title"]').fill(COURSE_TITLE);
			await page.locator('input[name="section"]').fill('01');
			await page.locator('input[name="teacherName"]').fill('Proof Teacher');

			const assessmentInputs = page.locator('.review-row input[aria-label="Assessment"]');
			if ((await assessmentInputs.count()) < 1) {
				await page.getByRole('button', { name: '+ Add assessment' }).click();
			}
			await page.locator('.review-row input[aria-label="Assessment"]').first().fill('Midterm');
			await page.locator('.review-row input[aria-label="Date"]').first().fill('2026-10-15');
			await page.locator('.review-row input[aria-label="Weight"]').first().fill('30');

			await page.getByRole('checkbox', { name: /Share course facts with the catalog/i }).check();
			await mark(page, t0, log, `filled ${COURSE_CODE} and enabled share`);
			await page.getByRole('button', { name: 'Share to catalog' }).click();
			await page.waitForLoadState('networkidle');
			await page.waitForTimeout(1500);
			const afterShare = await page.locator('body').innerText();
			if (!/Saved to the catalog/i.test(afterShare)) {
				bugs.push('contribute success status missing');
			} else {
				proven.push('contribute reports Saved to the catalog');
			}
			await page.screenshot({
				path: path.join(outDir, '03-semester-contributed.png'),
				fullPage: false
			});
		}

		await page.goto(`/tools/catalog?q=${encodeURIComponent(COURSE_CODE)}`, {
			waitUntil: 'networkidle'
		});
		await mark(page, t0, log, `catalog search for ${COURSE_CODE}`);
		const catalogBody = await page.locator('body').innerText();
		if (!catalogBody.includes(COURSE_CODE) && !catalogBody.includes(COURSE_TITLE)) {
			bugs.push('contributed course not visible on catalog');
		} else {
			proven.push('catalog shows contributed offering after share');
		}
		await page.screenshot({ path: path.join(outDir, '04-catalog-hit.png'), fullPage: false });
		await sleep(1000);
	} finally {
		await context.close();
		await browser.close();
	}

	const { readdir, stat } = await import('node:fs/promises');
	const videoNames = (await readdir(videoDir)).filter((n) => n.endsWith('.webm'));
	let mainVideo = null;
	let best = 0;
	for (const name of videoNames) {
		const p = path.join(videoDir, name);
		const s = await stat(p);
		if (s.size > best) {
			best = s.size;
			mainVideo = p;
		}
	}
	if (!mainVideo) throw new Error('No webm recorded');
	const dest = path.join(outDir, 'account-semester-catalog.webm');
	await copyFile(mainVideo, dest);

	const report = {
		baseURL,
		video: dest,
		courseCode: COURSE_CODE,
		pass: bugs.length === 0,
		bugs,
		blockers,
		proven,
		moments: log
	};
	await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
	const notes = `# Cross-page: Account → Semester → Catalog

Base: ${baseURL}
Video: \`${path.relative(root, dest)}\`
Course: ${COURSE_CODE}
Result: ${report.pass ? 'PASS' : 'FAIL'}

## Proven side effects
${proven.map((p) => `- ${p}`).join('\n') || '- (none)'}

## Bugs
${bugs.map((b) => `- ${b}`).join('\n') || '- none'}

## Blockers
${blockers.map((b) => `- ${b}`).join('\n') || '- none'}

## On-camera moments
${log.map((e) => `- **${e.t.toFixed(2)}s** ${e.label}`).join('\n')}
`;
	await writeFile(path.join(outDir, 'NOTES.md'), notes, 'utf8');
	await rm(tmpRoot, { recursive: true, force: true });
	console.log(notes);
	if (!report.pass) process.exitCode = 1;
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
