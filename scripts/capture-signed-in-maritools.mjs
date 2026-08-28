/**
 * Signed-in MariTools video proof (nick student session from DB + signed cookie).
 * Usage: node scripts/capture-signed-in-maritools.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:5174
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
const outDir = path.join(root, '.artifacts/verify-mariTools/signed-in');
const tmpRoot = path.join(root, '.artifacts/verify-mariTools/_capture-tmp-signed-in');
const NICK_EMAIL = 'nick.zhicheng@gmail.com';

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

async function mintNickStorageState() {
	await loadEnvLocal(path.join(root, '.env.local'));
	const secret = process.env.BETTER_AUTH_SECRET;
	const databaseUrl = process.env.DATABASE_URL;
	if (!secret || !databaseUrl) throw new Error('BETTER_AUTH_SECRET or DATABASE_URL missing');

	const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
	try {
		const user = await pool.query('select id, email from "user" where email = $1 limit 1', [
			NICK_EMAIL
		]);
		if (!user.rows[0]) throw new Error(`${NICK_EMAIL} not in user table`);
		const userId = user.rows[0].id;
		const profile = await pool.query(
			`select student_id, display_name, nim_disclosure_accepted_at is not null as nim
			 from mt_student_profiles where user_id = $1`,
			[userId]
		);
		if (!profile.rows[0]?.nim) {
			throw new Error(`${NICK_EMAIL} profile incomplete (need student id + NIM)`);
		}

		const token = `proofNick${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
		const id = `proofSess${Date.now().toString(36)}`;
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

/**
 * @param {import('@playwright/test').Browser} browser
 * @param {import('@playwright/test').BrowserContextOptions['storageState']} storageState
 * @param {string} slug
 * @param {(page: import('@playwright/test').Page, t0: number, log: Array<{t:number,label:string}>, bugs: string[]) => Promise<void>} drive
 */
async function captureFeature(browser, storageState, slug, drive) {
	const videoDir = path.join(tmpRoot, `${slug}-video`);
	await mkdir(videoDir, { recursive: true });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL,
		storageState
	});
	const page = await context.newPage();
	const log = /** @type {Array<{t:number,label:string}>} */ ([]);
	const bugs = /** @type {string[]} */ ([]);
	const t0 = Date.now();
	try {
		await drive(page, t0, log, bugs);
	} finally {
		await context.close();
	}
	const videos = await listWebms(videoDir);
	const mainVideo = videos.sort((a, b) => b.size - a.size)[0];
	if (!mainVideo) throw new Error(`No webm for ${slug}`);
	const dest = path.join(outDir, `${slug}.webm`);
	await copyFile(mainVideo.path, dest);
	return { slug, dest, log, bugs };
}

async function main() {
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(tmpRoot, { recursive: true });
	await mkdir(outDir, { recursive: true });

	const storageState = await mintNickStorageState();
	await writeFile(path.join(outDir, 'storageState.json'), JSON.stringify(storageState, null, 2));

	const pdfPath = path.join(tmpRoot, 'outline-sample.pdf');
	await writeFile(
		pdfPath,
		buildTextPdf(
			'BT /F1 12 Tf 72 720 Td (Course Outline Modern Physics 203-SN3-RE) Tj T* (Midterm 30% due 2026-10-15) Tj T* (Final 40% due 2026-12-10) Tj T* (Required book: University Physics) Tj ET'
		)
	);

	const browser = await chromium.launch({ channel: 'chrome', headless: true });
	const results = [];

	results.push(
		await captureFeature(browser, storageState, 'account', async (page, t0, log, bugs) => {
			await page.goto('/tools/account', { waitUntil: 'networkidle' });
			await mark(page, t0, log, 'signed-in account profile');
			const body = await page.locator('body').innerText();
			if (/could not finish sign-in/i.test(body)) bugs.push('false could-not-finish banner');
			if (!/Sign out/i.test(body)) bugs.push('Sign out missing');
			if (!/Zhich|Accepted|Saved/i.test(body)) bugs.push('completed profile signals missing');
			if (/Continue with Google/i.test(body)) bugs.push('guest Google CTA on signed-in account');
			await page.screenshot({ path: path.join(outDir, 'account-1280.png'), fullPage: false });
			const focusTarget = page.getByRole('button', { name: 'Sign out' });
			await focusTarget.focus();
			const ring = await focusTarget.evaluate((el) => {
				const s = getComputedStyle(el);
				return { border: s.borderColor, shadow: s.boxShadow };
			});
			await mark(page, t0, log, `Sign out focus border=${ring.border} shadow=${ring.shadow}`);
			await sleep(900);
		})
	);

	results.push(
		await captureFeature(browser, storageState, 'semester', async (page, t0, log, bugs) => {
			await page.goto('/tools/semester', { waitUntil: 'networkidle' });
			await mark(page, t0, log, 'semester signed-in empty / upload affordance');
			const body = await page.locator('body').innerText();
			if (/Sign in to upload/i.test(body) && /Open account/i.test(body)) {
				bugs.push('guest gate still showing for completed profile');
			}
			const upload = page.getByLabel('Course outline PDF');
			if ((await upload.count()) < 1) bugs.push('upload control missing');
			else {
				await mark(page, t0, log, 'upload control present');
				await upload.setInputFiles(pdfPath);
				await mark(page, t0, log, 'uploaded sample outline PDF');
				await page.waitForTimeout(2500);
				const after = await page.locator('body').innerText();
				if (
					!/Extraction review|Automatic extraction|could not extract|assessments|Course code/i.test(
						after
					)
				) {
					bugs.push('post-upload review UI not visible');
				}
				if (/missing-key|Automatic extraction is unavailable/i.test(after)) {
					log.push({
						t: Number(((Date.now() - t0) / 1000).toFixed(2)),
						label: 'NIM key missing or unavailable (manual fields still shown)'
					});
				}
			}
			await page.screenshot({ path: path.join(outDir, 'semester-1280.png'), fullPage: false });
			await sleep(900);
		})
	);

	results.push(
		await captureFeature(browser, storageState, 'catalog', async (page, t0, log, bugs) => {
			await page.goto('/tools/catalog', { waitUntil: 'networkidle' });
			await mark(page, t0, log, 'catalog signed-in browse');
			const body = await page.locator('body').innerText();
			if (!/Course catalog/i.test(body)) bugs.push('catalog title missing');
			await page.getByPlaceholder(/Course code|Search/i).fill('physics');
			await page.getByRole('button', { name: 'Search' }).click();
			await page.waitForLoadState('networkidle');
			await mark(page, t0, log, 'searched catalog for physics');
			await page.screenshot({ path: path.join(outDir, 'catalog-1280.png'), fullPage: false });
			await sleep(800);
		})
	);

	results.push(
		await captureFeature(browser, storageState, 'forum', async (page, t0, log, bugs) => {
			await page.goto('/tools/forum', { waitUntil: 'networkidle' });
			await mark(page, t0, log, 'forum signed-in');
			const body = await page.locator('body').innerText();
			if (/Read without an account/i.test(body)) {
				bugs.push('guest empty copy while signed in');
			}
			if (!/Start a thread|Post thread/i.test(body)) bugs.push('composer locked while signed in');
			const title = `Proof thread ${Date.now()}`;
			await page.locator('#composer input[name="title"]').fill(title);
			await page.locator('#composer select[name="category"]').selectOption('student-life');
			await page
				.locator('#composer textarea[name="body"]')
				.fill('Signed-in proof post. No student numbers.');
			await page.getByRole('button', { name: 'Post thread' }).click();
			try {
				await page.waitForURL(/\/tools\/forum\/[0-9a-f-]+$/i, { timeout: 20000 });
			} catch {
				bugs.push('create did not land on /tools/forum/[id]');
			}
			await mark(page, t0, log, `posted thread landed on detail "${title}"`);
			const detail = await page.locator('body').innerText();
			if (!detail.includes(title)) bugs.push('thread title missing on detail after create');
			if (!/Post reply/i.test(detail)) bugs.push('reply composer missing on detail after create');

			const replyText = `Proof reply ${Date.now().toString(36)}`;
			const replyBox = page.locator('section.reply-editor textarea[name="body"]');
			if ((await replyBox.count()) < 1) {
				bugs.push('reply editor section missing');
			} else {
				await replyBox.fill(replyText);
				await mark(page, t0, log, 'reply composer filled on detail');
				await Promise.all([
					page.waitForLoadState('domcontentloaded'),
					page.getByRole('button', { name: 'Post reply' }).click()
				]);
				await page.getByText(replyText).waitFor({ state: 'visible', timeout: 20000 });
				await mark(page, t0, log, `reply visible on detail "${replyText}"`);
				const afterReply = await page.locator('body').innerText();
				if (!afterReply.includes(replyText)) bugs.push('reply did not land visibly');
			}

			await page.goto('/tools/forum', { waitUntil: 'networkidle' });
			const list = await page.locator('body').innerText();
			if (!list.includes(title)) bugs.push('new thread missing from forum list');
			await mark(page, t0, log, 'new thread visible in Latest');
			const row = page.getByRole('link', { name: new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) });
			if ((await row.count()) < 1) {
				bugs.push('thread row link missing on index');
			} else {
				await row.first().click();
				try {
					await page.waitForURL(/\/tools\/forum\/[0-9a-f-]+$/i, { timeout: 15000 });
				} catch {
					bugs.push('thread row click did not open /tools/forum/[id]');
				}
				await mark(page, t0, log, 'opened thread via row click');
				const again = await page.locator('body').innerText();
				if (!/Post reply/i.test(again)) bugs.push('reply composer missing after row click');
			}

			await page.screenshot({ path: path.join(outDir, 'forum-1280.png'), fullPage: false });
			await sleep(900);
		})
	);

	results.push(
		await captureFeature(browser, storageState, 'clubs', async (page, t0, log, bugs) => {
			await page.goto('/tools/clubs', { waitUntil: 'networkidle' });
			await mark(page, t0, log, 'clubs signed-in');
			const body = await page.locator('body').innerText();
			if (/Sign in to submit one/i.test(body)) bugs.push('guest empty copy while signed in');
			if (!/Send for review/i.test(body)) bugs.push('submission form locked');
			const name = `Proof Club ${Date.now().toString(36)}`;
			await page.locator('form[action="?/submit"] input[name="name"]').fill(name);
			await page.locator('form[action="?/submit"] input[name="category"]').fill('STEM');
			await page
				.locator('form[action="?/submit"] textarea[name="description"]')
				.fill('Signed-in proof club submission.');
			await page.getByRole('button', { name: 'Send for review' }).click();
			await page.waitForLoadState('networkidle');
			await mark(page, t0, log, `submitted club "${name}"`);
			const after = await page.locator('body').innerText();
			if (!/Sent for review/i.test(after)) bugs.push('club submit success status missing');
			await page.screenshot({ path: path.join(outDir, 'clubs-1280.png'), fullPage: false });
			await sleep(900);
		})
	);

	await browser.close();

	const matrix = results.map((r) => ({
		feature: r.slug,
		pass: r.bugs.length === 0,
		video: r.dest,
		bugs: r.bugs,
		moments: r.log
	}));
	const notes = `# Signed-in MariTools verification

Session: ${NICK_EMAIL} (completed profile)
Base: ${baseURL}

## Matrix
${matrix
	.map(
		(m) =>
			`- **${m.feature}**: ${m.pass ? 'PASS' : 'FAIL'} → \`${path.relative(root, m.video)}\`${
				m.bugs.length ? `\n  - bugs: ${m.bugs.join('; ')}` : ''
			}`
	)
	.join('\n')}

## On-camera moments
${matrix
	.map(
		(m) =>
			`### ${m.feature}\n${m.moments.map((e) => `- **${e.t.toFixed(2)}s** ${e.label}`).join('\n')}`
	)
	.join('\n\n')}
`;
	await writeFile(path.join(outDir, 'NOTES.md'), notes, 'utf8');
	await writeFile(path.join(outDir, 'matrix.json'), JSON.stringify(matrix, null, 2), 'utf8');
	await rm(tmpRoot, { recursive: true, force: true });
	console.log(notes);
	if (matrix.some((m) => !m.pass)) process.exitCode = 1;
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
