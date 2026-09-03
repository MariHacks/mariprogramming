/**
 * Club create → edit → staff publish proof (one continuous recording).
 * Usage: node scripts/capture-club-create-review.mjs [baseUrl]
 *
 * PASS requires every REQUIRED_MARK on the timeline, including a published
 * directory row (or Open listing) for the same club — not a pending-queue hit.
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
const outDir = path.join(root, '.artifacts/verify-mariTools/club-create-review');
const tmpRoot = path.join(root, '.artifacts/verify-mariTools/_capture-tmp-club-create-review');
const STUDENT_EMAIL = 'nick.zhicheng@gmail.com';
const STAFF_EMAIL = 'team@marihacks.com';
const CLUB_NAME = `Editable Club ${Date.now().toString(36)}`;

const REQUIRED_MARKS = [
	'student short intake',
	'editable submission detail',
	'student saved listing',
	'staff pending queue',
	'staff review same club',
	'publish clicked',
	'published result on camera'
];

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} t0
 * @param {Array<{t:number,label:string}>} log
 * @param {string} label
 * @param {number} [dwellMs]
 */
async function mark(page, t0, log, label, dwellMs = 900) {
	const t = Number(((Date.now() - t0) / 1000).toFixed(2));
	log.push({ t, label });
	console.log(`  [${t.toFixed(2)}s] ${label}`);
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

/** @param {string} email */
async function mintCookies(email) {
	await loadEnvLocal(path.join(root, '.env.local'));
	const secret = process.env.BETTER_AUTH_SECRET;
	const databaseUrl = process.env.DATABASE_URL;
	if (!secret || !databaseUrl) throw new Error('BETTER_AUTH_SECRET or DATABASE_URL missing');

	const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
	try {
		const user = await pool.query('select id, email from "user" where lower(email) = lower($1) limit 1', [
			email
		]);
		if (!user.rows[0]) throw new Error(`${email} not in user table`);
		const userId = user.rows[0].id;
		const token = `proofClub${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
		const id = `proofClubSess${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
		await pool.query(
			`insert into session (id, token, user_id, expires_at, created_at, updated_at)
			 values ($1, $2, $3, now() + interval '7 days', now(), now())`,
			[id, token, userId]
		);
		const signed = `${token}.${await makeSignature(token, secret)}`;
		return [
			{
				name: 'mari-staff.session_token',
				value: signed,
				domain: '127.0.0.1',
				path: '/',
				httpOnly: true,
				secure: false,
				sameSite: 'Lax'
			}
		];
	} finally {
		await pool.end();
	}
}

/** @param {string} name */
function expectedSlug(name) {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} clubName
 */
async function assertPublishedOnCamera(page, clubName) {
	const slug = expectedSlug(clubName);
	const pending = page.locator(`[data-pending-club="${clubName}"]`);
	if ((await pending.count()) > 0) {
		return 'published club still in pending queue';
	}

	const row = page.locator(`a.club-row[href="/tools/clubs/${slug}"]`);
	if ((await row.count()) < 1) {
		const byText = page.locator('a.club-row').filter({ hasText: clubName });
		if ((await byText.count()) < 1) {
			return `published club-row missing for ${clubName} (slug ${slug})`;
		}
		await byText.first().scrollIntoViewIfNeeded();
		const text = await byText.first().innerText();
		if (!/Open listing/i.test(text)) return 'published row missing Open listing';
		return null;
	}

	await row.first().scrollIntoViewIfNeeded();
	const inView = await row.first().evaluate((el) => {
		const r = el.getBoundingClientRect();
		return r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0;
	});
	if (!inView) return 'published club-row not in viewport';
	const text = await row.first().innerText();
	if (!text.includes(clubName)) return 'published club-row text missing club name';
	if (!/Open listing/i.test(text)) return 'published row missing Open listing';
	return null;
}

async function main() {
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(tmpRoot, { recursive: true });
	await mkdir(outDir, { recursive: true });

	const studentCookies = await mintCookies(STUDENT_EMAIL);
	const staffCookies = await mintCookies(STAFF_EMAIL);
	const bugs = /** @type {string[]} */ ([]);
	const log = /** @type {Array<{t:number,label:string}>} */ ([]);
	const t0 = Date.now();

	const browser = await chromium.launch({ channel: 'chrome', headless: true });
	const videoDir = path.join(tmpRoot, 'video');
	await mkdir(videoDir, { recursive: true });

	// One context → one webm. Cookie swap mid-flight; no UUID concat reorder.
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL
	});
	await context.addCookies(studentCookies);
	const page = await context.newPage();

	await page.goto('/tools/clubs', { waitUntil: 'networkidle' });
	await mark(page, t0, log, 'student short intake');
	await page.locator('form[action="?/submit"] select[name="submitterRole"]').selectOption('officer');
	await page.locator('form[action="?/submit"] input[name="name"]').fill(CLUB_NAME);
	await page.locator('form[action="?/submit"] input[name="category"]').fill('STEM');
	await page.getByRole('button', { name: 'Continue to listing' }).click();
	await page.waitForURL(/\/tools\/clubs\/submissions\/[0-9a-f-]+$/i, { timeout: 20000 });
	const submissionUrl = page.url();
	const submissionId = submissionUrl.split('/').pop() ?? '';
	await mark(page, t0, log, 'editable submission detail');
	if ((await page.getByTestId('club-edit-name').count()) < 1) {
		bugs.push('editable ClubListingDetail missing');
	}
	await page.getByTestId('club-edit-description').fill('Shared create/review proof listing.');
	await page.getByTestId('club-edit-link-label').fill('Site');
	await page.getByTestId('club-edit-link-url').fill('https://example.com/club');
	await page.getByRole('button', { name: 'Save changes' }).click();
	await page.waitForLoadState('networkidle');
	const saved = await page.locator('body').innerText();
	if (!/Saved/i.test(saved)) bugs.push('save status missing');
	if (!/Officer or organizer/i.test(saved)) bugs.push('submitter role banner missing');
	await page.screenshot({ path: path.join(outDir, 'student-edit.png'), fullPage: false });
	await mark(page, t0, log, 'student saved listing', 1200);

	await context.clearCookies();
	await context.addCookies(staffCookies);
	await page.goto('/tools/clubs', { waitUntil: 'networkidle' });
	await mark(page, t0, log, 'staff pending queue');
	const pending = page.locator(`[data-pending-club="${CLUB_NAME}"]`);
	if ((await pending.count()) < 1) {
		bugs.push(`pending row missing for ${CLUB_NAME}`);
	} else {
		await pending.locator('[data-testid="review-submission"]').click();
		await page.waitForURL(new RegExp(`/tools/clubs/submissions/${submissionId}$`, 'i'), {
			timeout: 20000
		});
		await mark(page, t0, log, 'staff review same club');
		const body = await page.locator('body').innerText();
		if (!/Staff review/i.test(body)) bugs.push('staff review chrome missing');
		if (!body.includes(CLUB_NAME)) bugs.push('staff review missing club name');
		const publishBtn = page.getByRole('button', { name: 'Publish' });
		if ((await publishBtn.count()) < 1) bugs.push('publish button missing');
		if (!/Officer or organizer/i.test(body)) bugs.push('role not visible to staff');
		const about = await page.getByTestId('club-edit-description').inputValue();
		if (!/Shared create\/review proof listing/i.test(about)) {
			bugs.push('saved description missing on review');
		}
		await page.locator('.club-submission-actions').scrollIntoViewIfNeeded();
		await page.screenshot({ path: path.join(outDir, 'staff-review.png'), fullPage: false });
		await sleep(800);
		await publishBtn.first().click();
		await mark(page, t0, log, 'publish clicked', 600);
		await page.waitForURL(/\/tools\/clubs\/?$/, { timeout: 20000 });
		await page.waitForLoadState('networkidle');
		const publishErr = await assertPublishedOnCamera(page, CLUB_NAME);
		if (publishErr) {
			bugs.push(publishErr);
		} else {
			await mark(page, t0, log, 'published result on camera', 1600);
			const open = page.locator(`a.club-row[href="/tools/clubs/${expectedSlug(CLUB_NAME)}"]`);
			if ((await open.count()) > 0) {
				await open.first().click();
				await page.waitForURL(new RegExp(`/tools/clubs/${expectedSlug(CLUB_NAME)}/?$`, 'i'), {
					timeout: 15000
				});
				const listing = await page.locator('body').innerText();
				if (!listing.includes(CLUB_NAME)) bugs.push('published listing page missing club name');
				await sleep(1000);
			}
		}
		await page.screenshot({ path: path.join(outDir, 'staff-published.png'), fullPage: false });
	}

	await context.close();
	await browser.close();

	const { readdir, stat } = await import('node:fs/promises');
	const names = await readdir(videoDir);
	const videos = [];
	for (const name of names) {
		if (!name.endsWith('.webm')) continue;
		const p = path.join(videoDir, name);
		videos.push({ path: p, size: (await stat(p)).size });
	}
	const dest = path.join(outDir, 'club-create-review.webm');
	if (videos.length === 0) throw new Error('no webm recorded');
	if (videos.length !== 1) {
		bugs.push(`expected one continuous webm, got ${videos.length}`);
	}
	await copyFile(videos[0].path, dest);

	const labels = new Set(log.map((m) => m.label));
	for (const required of REQUIRED_MARKS) {
		if (!labels.has(required)) {
			bugs.push(`required on-camera step missing: ${required}`);
		}
	}

	const pass = bugs.length === 0;
	const notes = `# Club create/review proof

Club: ${CLUB_NAME}
Submission: ${submissionId}
Base: ${baseURL}
Pass: ${pass}
Continuous webm: ${videos.length === 1}
Bugs: ${bugs.length ? bugs.join('; ') : 'none'}

Required marks:
${REQUIRED_MARKS.map((m) => `- [${labels.has(m) ? 'x' : ' '}] ${m}`).join('\n')}

Moments:
${log.map((m) => `- ${m.t}s ${m.label}`).join('\n')}
`;
	await writeFile(path.join(outDir, 'NOTES.md'), notes);
	console.log(notes);
	if (!pass) process.exitCode = 1;
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
