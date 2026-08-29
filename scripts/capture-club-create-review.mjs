/**
 * Club create → editable detail → staff review proof.
 * Usage: node scripts/capture-club-create-review.mjs [baseUrl]
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

/** @param {string} email */
async function mintStorageState(email) {
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
		const id = `proofClubSess${Date.now().toString(36)}`;
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
	} finally {
		await pool.end();
	}
}

/** @param {string} dir */
async function listWebms(dir) {
	const { readdir, stat } = await import('node:fs/promises');
	const names = await readdir(dir);
	const out = [];
	for (const name of names) {
		if (!name.endsWith('.webm')) continue;
		const p = path.join(dir, name);
		const s = await stat(p);
		out.push({ path: p, size: s.size });
	}
	return out;
}

async function main() {
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(tmpRoot, { recursive: true });
	await mkdir(outDir, { recursive: true });

	const studentState = await mintStorageState(STUDENT_EMAIL);
	const staffState = await mintStorageState(STAFF_EMAIL);
	const bugs = /** @type {string[]} */ ([]);
	const log = /** @type {Array<{t:number,label:string}>} */ ([]);
	const t0 = Date.now();

	const browser = await chromium.launch({ channel: 'chrome', headless: true });
	const videoDir = path.join(tmpRoot, 'video');
	await mkdir(videoDir, { recursive: true });

	const studentCtx = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL,
		storageState: studentState
	});
	const student = await studentCtx.newPage();
	await student.goto('/tools/clubs', { waitUntil: 'networkidle' });
	await mark(student, t0, log, 'student clubs index');
	await student.locator('form[action="?/submit"] select[name="submitterRole"]').selectOption('officer');
	await student.locator('form[action="?/submit"] input[name="name"]').fill(CLUB_NAME);
	await student.locator('form[action="?/submit"] input[name="category"]').fill('STEM');
	await student.getByRole('button', { name: 'Continue to listing' }).click();
	await student.waitForURL(/\/tools\/clubs\/submissions\/[0-9a-f-]+$/i, { timeout: 20000 });
	const submissionUrl = student.url();
	await mark(student, t0, log, `editable detail ${submissionUrl}`);
	if ((await student.getByTestId('club-edit-name').count()) < 1) {
		bugs.push('editable ClubListingDetail missing');
	}
	await student.getByTestId('club-edit-description').fill('Shared create/review proof listing.');
	await student.getByTestId('club-edit-link-label').fill('Site');
	await student.getByTestId('club-edit-link-url').fill('https://example.com/club');
	await student.getByRole('button', { name: 'Save changes' }).click();
	await student.waitForLoadState('networkidle');
	const saved = await student.locator('body').innerText();
	if (!/Saved/i.test(saved)) bugs.push('save status missing');
	if (!/Officer or organizer/i.test(saved)) bugs.push('submitter role banner missing');
	await student.screenshot({ path: path.join(outDir, 'student-edit.png'), fullPage: false });
	await mark(student, t0, log, 'student saved listing');
	await studentCtx.close();

	const staffCtx = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL,
		storageState: staffState
	});
	const staff = await staffCtx.newPage();
	await staff.goto('/tools/clubs', { waitUntil: 'networkidle' });
	await mark(staff, t0, log, 'staff pending queue');
	const pending = staff.locator(`[data-pending-club="${CLUB_NAME}"]`);
	if ((await pending.count()) < 1) bugs.push(`pending row missing for ${CLUB_NAME}`);
	else {
		await pending.locator('[data-testid="review-submission"]').click();
		await staff.waitForURL(/\/tools\/clubs\/submissions\/[0-9a-f-]+$/i, { timeout: 20000 });
		await mark(staff, t0, log, 'staff review surface');
		const body = await staff.locator('body').innerText();
		if (!/Staff review/i.test(body)) bugs.push('staff review chrome missing');
		if (!/Publish/i.test(body)) bugs.push('publish button missing');
		if (!/Officer or organizer/i.test(body)) bugs.push('role not visible to staff');
		const about = await staff.getByTestId('club-edit-description').inputValue();
		if (!/Shared create\/review proof listing/i.test(about)) {
			bugs.push('saved description missing on review');
		}
		await staff.locator('.club-submission-actions').scrollIntoViewIfNeeded();
		await staff.screenshot({ path: path.join(outDir, 'staff-review.png'), fullPage: false });
		await staff.getByRole('button', { name: 'Publish' }).click();
		await staff.waitForURL(/\/tools\/clubs\/?$/, { timeout: 20000 });
		await mark(staff, t0, log, 'published and returned to index');
		const published = staff.locator(`a.club-row[href*="${CLUB_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-')}"]`);
		if ((await published.count()) < 1) {
			const indexBody = await staff.locator('body').innerText();
			if (!indexBody.includes(CLUB_NAME)) bugs.push('published club not listed after publish');
		}
		await staff.screenshot({ path: path.join(outDir, 'staff-published.png'), fullPage: false });
	}
	await staffCtx.close();
	await browser.close();

	const videos = await listWebms(videoDir);
	videos.sort((a, b) => a.path.localeCompare(b.path));
	const dest = path.join(outDir, 'club-create-review.webm');
	if (videos.length === 0) throw new Error('no webm recorded');
	if (videos.length === 1) {
		await copyFile(videos[0].path, dest);
	} else {
		const { spawnSync } = await import('node:child_process');
		const listFile = path.join(tmpRoot, 'concat.txt');
		await writeFile(
			listFile,
			videos.map((v) => `file '${v.path.replace(/'/g, "'\\''")}'`).join('\n')
		);
		const stitch = spawnSync(
			'ffmpeg',
			['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', dest],
			{ encoding: 'utf8' }
		);
		if (stitch.status !== 0) {
			await copyFile(videos[videos.length - 1].path, dest);
			bugs.push('ffmpeg stitch failed; kept last clip only');
		}
	}

	const notes = `# Club create/review proof

Club: ${CLUB_NAME}
Base: ${baseURL}
Pass: ${bugs.length === 0}
Bugs: ${bugs.length ? bugs.join('; ') : 'none'}

Moments:
${log.map((m) => `- ${m.t}s ${m.label}`).join('\n')}
`;
	await writeFile(path.join(outDir, 'NOTES.md'), notes);
	console.log(notes);
	if (bugs.length) process.exitCode = 1;
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
