/**
 * Guest vs signed-in auth matrix for Clubs + Forum.
 * Seeds Robotics Club, records guest.webm + signed-in.webm per feature.
 * Usage: node scripts/capture-auth-matrix-clubs-forum.mjs [baseUrl]
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
const outRoot = path.join(root, '.artifacts/verify-mariTools/auth-matrix');
const tmpRoot = path.join(root, '.artifacts/verify-mariTools/_capture-tmp-auth-matrix');
const NICK_EMAIL = 'nick.zhicheng@gmail.com';

const SEED = {
	name: 'Robotics Club',
	slug: 'robotics-club',
	category: 'STEM',
	description: 'Builds robots and competes in campus challenges.',
	links: [{ label: 'Discord', url: 'https://discord.gg/example-robotics' }]
};

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

async function seedPublishedClub() {
	await loadEnvLocal(path.join(root, '.env.local'));
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error('DATABASE_URL missing from .env.local');

	const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
	try {
		const existing = await pool.query(
			`select id, name, slug, published from mt_clubs where slug = $1 limit 1`,
			[SEED.slug]
		);
		if (existing.rows[0]?.published === true) {
			console.log(`seed: already published ${SEED.slug}`);
			return existing.rows[0];
		}
		if (existing.rows[0]) {
			const updated = await pool.query(
				`update mt_clubs
				 set published = true, name = $2, category = $3, description = $4,
				     links = $5::jsonb, updated_at = now()
				 where slug = $1
				 returning id, name, slug, published`,
				[SEED.slug, SEED.name, SEED.category, SEED.description, JSON.stringify(SEED.links)]
			);
			console.log(`seed: published existing ${SEED.slug}`);
			return updated.rows[0];
		}
		const inserted = await pool.query(
			`insert into mt_clubs (name, slug, category, description, links, published)
			 values ($1, $2, $3, $4, $5::jsonb, true)
			 returning id, name, slug, published`,
			[SEED.name, SEED.slug, SEED.category, SEED.description, JSON.stringify(SEED.links)]
		);
		console.log(`seed: inserted published club ${SEED.slug}`);
		return inserted.rows[0];
	} finally {
		await pool.end();
	}
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

		const token = `authMatrix${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
		const id = `authMatrixSess${Date.now().toString(36)}`;
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
 * @param {import('@playwright/test').BrowserContextOptions['storageState'] | undefined} storageState
 * @param {string} feature
 * @param {string} mode
 * @param {(page: import('@playwright/test').Page, t0: number, log: Array<{t:number,label:string}>, bugs: string[]) => Promise<void>} drive
 */
async function capture(browser, storageState, feature, mode, drive) {
	const featureDir = path.join(outRoot, feature);
	await mkdir(featureDir, { recursive: true });
	const videoDir = path.join(tmpRoot, `${feature}-${mode}-video`);
	await mkdir(videoDir, { recursive: true });

	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL,
		...(storageState ? { storageState } : {})
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
	if (!mainVideo) throw new Error(`No webm for ${feature}/${mode}`);
	const dest = path.join(featureDir, `${mode}.webm`);
	await copyFile(mainVideo.path, dest);
	return { feature, mode, dest, log, bugs };
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} t0
 * @param {Array<{t:number,label:string}>} log
 * @param {string[]} bugs
 */
async function driveClubsGuest(page, t0, log, bugs) {
	await page.goto('/tools/clubs', { waitUntil: 'domcontentloaded', timeout: 30000 });
	await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
	await mark(page, t0, log, 'guest clubs index');

	const body = await page.locator('body').innerText();
	const html = await page.content();
	if (!/Robotics Club/i.test(body)) bugs.push('Robotics Club missing for guest');
	if (/action="\?\/submit"/i.test(html) || /Send for review/i.test(body)) {
		bugs.push('privileged submit form exposed to guest');
	}
	if (!/Sign in with Google/i.test(body)) bugs.push('guest sign-in CTA missing on clubs');

	const row = page.locator('a.club-row[href="/tools/clubs/robotics-club"]');
	await row.waitFor({ state: 'visible', timeout: 10000 });
	await mark(page, t0, log, 'Robotics Club row visible');

	await page.goto('/tools/clubs?q=zzzz-no-match', { waitUntil: 'domcontentloaded' });
	await page.getByText('No clubs match those filters.').waitFor({ state: 'visible', timeout: 10000 });
	await mark(page, t0, log, 'guest filter-miss empty state');

	await page.goto('/tools/clubs', { waitUntil: 'domcontentloaded' });
	const robotics = page.locator('a.club-row[href="/tools/clubs/robotics-club"]');
	await robotics.waitFor({ state: 'visible', timeout: 10000 });
	await Promise.all([
		page.waitForURL(/\/tools\/clubs\/robotics-club$/, { timeout: 20000 }),
		robotics.click()
	]).catch(async () => {
		await page.goto('/tools/clubs/robotics-club', { waitUntil: 'domcontentloaded' });
	});
	await page.getByRole('heading', { name: 'Robotics Club' }).waitFor({ state: 'visible' });
	await mark(page, t0, log, 'guest click-through Robotics detail');
	await page.screenshot({
		path: path.join(outRoot, 'clubs', 'guest-detail.png'),
		fullPage: false
	});
	await sleep(900);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} t0
 * @param {Array<{t:number,label:string}>} log
 * @param {string[]} bugs
 */
async function driveClubsSignedIn(page, t0, log, bugs) {
	await page.goto('/tools/clubs', { waitUntil: 'domcontentloaded', timeout: 30000 });
	await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
	await mark(page, t0, log, 'signed-in clubs index');

	const body = await page.locator('body').innerText();
	if (!/Robotics Club/i.test(body)) bugs.push('Robotics Club missing when signed in');
	if (/Sign in to submit one/i.test(body)) bugs.push('guest empty copy while signed in');
	if (!/Send for review/i.test(body)) bugs.push('submission form locked while signed in');
	if (await page.locator('form[action="?/submit"]').count() < 1) {
		bugs.push('submit form missing');
	}

	const row = page.locator('a.club-row[href="/tools/clubs/robotics-club"]');
	await row.waitFor({ state: 'visible', timeout: 10000 });
	await mark(page, t0, log, 'Robotics Club still visible signed in');

	const name = `Proof Club ${Date.now().toString(36)}`;
	await page.locator('form[action="?/submit"] input[name="name"]').fill(name);
	await page.locator('form[action="?/submit"] input[name="category"]').fill('STEM');
	await page
		.locator('form[action="?/submit"] textarea[name="description"]')
		.fill('Signed-in auth-matrix club submission.');
	await page.getByRole('button', { name: 'Send for review' }).click();
	await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
	await mark(page, t0, log, `submitted club "${name}"`);
	const after = await page.locator('body').innerText();
	if (!/Sent for review/i.test(after)) bugs.push('club submit success status missing');
	await page.screenshot({
		path: path.join(outRoot, 'clubs', 'signed-in-submit.png'),
		fullPage: false
	});
	await sleep(900);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} t0
 * @param {Array<{t:number,label:string}>} log
 * @param {string[]} bugs
 */
async function driveForumGuest(page, t0, log, bugs) {
	await page.goto('/tools/forum', { waitUntil: 'domcontentloaded', timeout: 30000 });
	await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
	await mark(page, t0, log, 'guest forum index');

	const body = await page.locator('body').innerText();
	const html = await page.content();
	if (/action="\?\/create"/i.test(html) || /Post thread/i.test(body)) {
		bugs.push('privileged create form exposed to guest');
	}
	if (!/Sign in with Google/i.test(body)) bugs.push('guest sign-in CTA missing on forum');

	const tabs = page.locator('.forum-tabs a');
	if ((await tabs.count()) >= 2) {
		await tabs.nth(1).click();
		await page.waitForLoadState('domcontentloaded');
		await mark(page, t0, log, 'guest category tab filter');
		await page.goto('/tools/forum', { waitUntil: 'domcontentloaded' });
	}

	await page.goto('/tools/forum?q=zzzz-no-match', { waitUntil: 'domcontentloaded' });
	await page.getByText('No threads match those filters.').waitFor({ state: 'visible', timeout: 10000 });
	await mark(page, t0, log, 'guest filter-miss empty state');

	await page.goto('/tools/forum', { waitUntil: 'domcontentloaded' });
	const first = page.locator('a.topic-row').first();
	await first.waitFor({ state: 'visible', timeout: 10000 });
	const href = await first.getAttribute('href');
	await Promise.all([
		page.waitForURL(/\/tools\/forum\/[0-9a-f-]+$/i, { timeout: 20000 }),
		first.click()
	]).catch(async () => {
		if (href) await page.goto(href, { waitUntil: 'domcontentloaded' });
	});
	await mark(page, t0, log, 'guest opened thread detail');

	const threadBody = await page.locator('body').innerText();
	const threadHtml = await page.content();
	if (/action="\?\/reply"/i.test(threadHtml) || /Post reply/i.test(threadBody)) {
		bugs.push('privileged reply form exposed to guest');
	}
	if (!/Sign in with Google/i.test(threadBody)) {
		bugs.push('guest reply gate / sign-in CTA missing on thread');
	}
	await page.screenshot({
		path: path.join(outRoot, 'forum', 'guest-thread.png'),
		fullPage: false
	});
	await sleep(900);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} t0
 * @param {Array<{t:number,label:string}>} log
 * @param {string[]} bugs
 */
async function driveForumSignedIn(page, t0, log, bugs) {
	await page.goto('/tools/forum', { waitUntil: 'domcontentloaded', timeout: 30000 });
	await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
	await mark(page, t0, log, 'signed-in forum index');

	const body = await page.locator('body').innerText();
	if (/Read without an account/i.test(body)) bugs.push('guest empty copy while signed in');
	if (!/Start a thread|Post thread/i.test(body)) bugs.push('composer locked while signed in');

	const title = `Auth matrix thread ${Date.now()}`;
	await page.locator('#composer input[name="title"]').fill(title);
	await page.locator('#composer select[name="category"]').selectOption('student-life');
	await page
		.locator('#composer textarea[name="body"]')
		.fill('Signed-in auth-matrix proof post. No student numbers.');
	await page.getByRole('button', { name: 'Post thread' }).click();
	await page.waitForURL(/\/tools\/forum\/[0-9a-f-]+$/i, { timeout: 20000 });
	await mark(page, t0, log, `posted thread landed on detail "${title}"`);

	const detail = await page.locator('body').innerText();
	if (!detail.includes(title)) bugs.push('thread title missing on detail after create');
	if (!/Post reply/i.test(detail)) bugs.push('reply form locked after create while signed in');

	const replyText = `Auth matrix reply ${Date.now().toString(36)}`;
	await page.locator('section.reply-editor textarea[name="body"]').fill(replyText);
	await Promise.all([
		page.waitForLoadState('domcontentloaded'),
		page.getByRole('button', { name: 'Post reply' }).click()
	]);
	await page.getByText(replyText).waitFor({ state: 'visible', timeout: 20000 });
	await mark(page, t0, log, `reply visible on detail "${replyText}"`);
	const afterReply = await page.locator('body').innerText();
	if (!afterReply.includes(replyText)) bugs.push('reply did not land visibly');
	if (!/Reply posted/i.test(afterReply)) {
		log.push({
			t: Number(((Date.now() - t0) / 1000).toFixed(2)),
			label: 'Reply posted status missing (body still visible)'
		});
	}
	await page.screenshot({
		path: path.join(outRoot, 'forum', 'signed-in-reply.png'),
		fullPage: false
	});
	await sleep(900);

	await page.goto('/tools/forum', { waitUntil: 'domcontentloaded' });
	await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
	const list = await page.locator('body').innerText();
	if (!list.includes(title)) bugs.push('new thread missing from forum list');
	if (/Read without an account/i.test(list)) bugs.push('guest empty copy on list after posting');
	await mark(page, t0, log, 'new thread visible in list');
	await page.screenshot({
		path: path.join(outRoot, 'forum', 'signed-in-list.png'),
		fullPage: false
	});
	await sleep(700);
}

async function main() {
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(tmpRoot, { recursive: true });
	await mkdir(path.join(outRoot, 'clubs'), { recursive: true });
	await mkdir(path.join(outRoot, 'forum'), { recursive: true });

	const club = await seedPublishedClub();
	const storageState = await mintNickStorageState();
	await writeFile(
		path.join(outRoot, 'storageState.json'),
		JSON.stringify(storageState, null, 2)
	);

	const browser = await chromium.launch({ channel: 'chrome', headless: true });
	const results = [];
	try {
		results.push(await capture(browser, undefined, 'clubs', 'guest', driveClubsGuest));
		results.push(await capture(browser, storageState, 'clubs', 'signed-in', driveClubsSignedIn));
		results.push(await capture(browser, undefined, 'forum', 'guest', driveForumGuest));
		results.push(await capture(browser, storageState, 'forum', 'signed-in', driveForumSignedIn));
	} finally {
		await browser.close();
	}

	const matrix = results.map((r) => ({
		case: `${r.feature}/${r.mode}`,
		feature: r.feature,
		mode: r.mode,
		pass: r.bugs.length === 0,
		video: path.relative(root, r.dest),
		bugs: r.bugs,
		moments: r.log
	}));

	const notes = `# Auth matrix · Clubs + Forum

Session: guest = clean storage · signed-in = ${NICK_EMAIL}
Base: ${baseURL}
Seeded club: **${club.name}** (\`${club.slug}\`)

## Matrix
${matrix
	.map(
		(m) =>
			`- **${m.case}**: ${m.pass ? 'PASS' : 'FAIL'} → \`${m.video}\`${
				m.bugs.length ? `\n  - bugs: ${m.bugs.join('; ')}` : ''
			}`
	)
	.join('\n')}

## On-camera moments
${matrix
	.map(
		(m) =>
			`### ${m.case}\n${m.moments.map((e) => `- **${e.t.toFixed(2)}s** ${e.label}`).join('\n')}`
	)
	.join('\n\n')}
`;
	await writeFile(path.join(outRoot, 'NOTES.md'), notes, 'utf8');
	await writeFile(path.join(outRoot, 'matrix.json'), JSON.stringify(matrix, null, 2), 'utf8');
	await writeFile(path.join(outRoot, 'clubs', 'NOTES.md'), notes, 'utf8');
	await writeFile(path.join(outRoot, 'forum', 'NOTES.md'), notes, 'utf8');
	await rm(tmpRoot, { recursive: true, force: true });
	console.log(notes);
	if (matrix.some((m) => !m.pass)) process.exitCode = 1;
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
