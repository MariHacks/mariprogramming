/**
 * Forum report / edit / delete live proof (nick via Better Auth mint).
 * Usage: node scripts/capture-forum-report-edit-delete.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:5174
 *
 * Fail conditions:
 * - Report "why" input visible before Report click
 * - Edit or Delete missing for author (canManage)
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
const outDir = path.join(root, '.artifacts/verify-mariTools/forum');
const tmpRoot = path.join(root, '.artifacts/verify-mariTools/_capture-tmp-forum-mod');
const NICK_EMAIL = 'nick.zhicheng@gmail.com';
const VIDEO_NAME = 'forum-report-edit-delete.webm';

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
	await sleep(650);
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

		const token = `forumMod${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
		const id = `forumModSess${Date.now().toString(36)}`;
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

	const storageState = await mintNickStorageState();
	await writeFile(path.join(outDir, 'storageState.json'), JSON.stringify(storageState, null, 2));

	const videoDir = path.join(tmpRoot, 'video');
	await mkdir(videoDir, { recursive: true });

	const browser = await chromium.launch({ channel: 'chrome', headless: true });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL,
		storageState
	});
	const page = await context.newPage();
	const log = /** @type {Array<{t:number,label:string}>} */ ([]);
	const bugs = /** @type {string[]} */ ([]);
	const checks = /** @type {Array<{id:string,pass:boolean,detail:string}>} */ ([]);
	const t0 = Date.now();

	try {
		await page.goto('/tools/forum', { waitUntil: 'networkidle' });
		await mark(page, t0, log, 'forum index signed-in');

		const title = `Mod proof ${Date.now().toString(36)}`;
		await page.locator('#composer input[name="title"]').fill(title);
		await page.locator('#composer select[name="category"]').selectOption('student-life');
		await page
			.locator('#composer textarea[name="body"]')
			.fill('Disposable OP for report/edit/delete camera proof.');
		await page.getByRole('button', { name: 'Post thread' }).click();
		await page.waitForURL(/\/tools\/forum\/[0-9a-f-]+$/i, { timeout: 20000 });
		await mark(page, t0, log, `opened new thread "${title}"`);

		const replyText = `Disposable reply ${Date.now().toString(36)}`;
		const replyBox = page.locator('section.reply-editor textarea[name="body"]');
		await replyBox.fill(replyText);
		await Promise.all([
			page.waitForLoadState('domcontentloaded'),
			page.getByRole('button', { name: 'Post reply' }).click()
		]);
		await page.getByText(replyText).waitFor({ state: 'visible', timeout: 20000 });
		await mark(page, t0, log, `reply visible "${replyText}"`);

		const whyVisibleDefault = await page.locator('input[name="reason"]').count();
		const whyDefaultPass = whyVisibleDefault === 0;
		checks.push({
			id: 'report-why-hidden-default',
			pass: whyDefaultPass,
			detail: whyDefaultPass
				? 'reason input absent before Report'
				: `reason input count=${whyVisibleDefault} before Report`
		});
		if (!whyDefaultPass) bugs.push('report why visible by default');
		await mark(
			page,
			t0,
			log,
			whyDefaultPass
				? 'PASS: why field not visible by default'
				: 'FAIL: why field visible by default'
		);

		const originReport = page.locator('article.origin .post-actions button', {
			hasText: /^Report$/
		});
		if ((await originReport.count()) < 1) {
			bugs.push('Report button missing on OP');
			checks.push({ id: 'report-button', pass: false, detail: 'OP Report missing' });
		} else {
			checks.push({ id: 'report-button', pass: true, detail: 'OP Report present' });
			await originReport.first().click();
			await page.locator('article.origin .report-popover input[name="reason"]').waitFor({
				state: 'visible',
				timeout: 5000
			});
			await mark(page, t0, log, 'Report popover open with why field');
			checks.push({
				id: 'report-popover-opens',
				pass: true,
				detail: 'why field visible after Report click'
			});

			await page.keyboard.press('Escape');
			await sleep(400);
			const afterEsc = await page.locator('article.origin .report-popover').count();
			const escPass = afterEsc === 0;
			checks.push({
				id: 'report-escape-closes',
				pass: escPass,
				detail: escPass ? 'Escape closed popover' : 'popover still open after Escape'
			});
			if (!escPass) bugs.push('Escape did not close report popover');
			await mark(
				page,
				t0,
				log,
				escPass ? 'PASS: Escape closed report popover' : 'FAIL: Escape leave popover open'
			);

			await originReport.first().click();
			await page.locator('article.origin .report-popover').waitFor({ state: 'visible' });
			await page.locator('h1').click({ position: { x: 8, y: 8 } });
			await sleep(400);
			const afterOutside = await page.locator('article.origin .report-popover').count();
			const outsidePass = afterOutside === 0;
			checks.push({
				id: 'report-outside-closes',
				pass: outsidePass,
				detail: outsidePass ? 'click-outside closed popover' : 'popover still open after outside click'
			});
			if (!outsidePass) bugs.push('click-outside did not close report popover');
			await mark(
				page,
				t0,
				log,
				outsidePass
					? 'PASS: click-outside closed report popover'
					: 'FAIL: click-outside left popover open'
			);
		}

		const editButtons = page.getByRole('button', { name: 'Edit' });
		const deleteButtons = page.getByRole('button', { name: 'Delete' });
		const editCount = await editButtons.count();
		const deleteCount = await deleteButtons.count();
		const managePass = editCount >= 2 && deleteCount >= 2;
		checks.push({
			id: 'author-edit-delete',
			pass: managePass,
			detail: `Edit×${editCount} Delete×${deleteCount} (need ≥2 each for OP+reply)`
		});
		if (!managePass) {
			bugs.push('Edit/Delete missing for author');
			await mark(page, t0, log, `FAIL: Edit×${editCount} Delete×${deleteCount}`);
		} else {
			await mark(page, t0, log, `PASS: Edit×${editCount} Delete×${deleteCount} for author`);
		}

		const origin = page.locator('article.origin');
		const replyArticle = page.locator('article.post:not(.origin)').filter({ hasText: replyText });
		if (editCount >= 1) {
			const originEdit = origin.getByRole('button', { name: 'Edit' });
			if ((await originEdit.count()) < 1) {
				bugs.push('Edit missing on OP');
				checks.push({ id: 'inline-edit', pass: false, detail: 'OP Edit missing' });
			} else {
				await originEdit.scrollIntoViewIfNeeded();
				await originEdit.click();
				const editArea = origin.locator('form.post-edit textarea[name="body"]');
				await editArea.waitFor({ state: 'visible', timeout: 8000 });
				const edited = `Disposable OP edited on camera ${Date.now().toString(36)}`;
				await editArea.fill(edited);
				await Promise.all([
					page.waitForLoadState('domcontentloaded'),
					origin.getByRole('button', { name: 'Save edit' }).click()
				]);
				await page.getByText(edited).waitFor({ state: 'visible', timeout: 20000 });
				const statusOk = await page.getByText('Edit saved.').isVisible().catch(() => false);
				const bodyOk = await page.getByText(edited).isVisible();
				const editPass = bodyOk;
				checks.push({
					id: 'inline-edit',
					pass: editPass,
					detail: editPass
						? `OP inline edit landed${statusOk ? ' + status' : ''}`
						: 'edited OP body not visible'
				});
				if (!editPass) bugs.push('inline edit did not land');
				await mark(
					page,
					t0,
					log,
					editPass ? 'PASS: inline edit saved on OP' : 'FAIL: inline edit'
				);
			}
		}

		const replyDelete = replyArticle.getByRole('button', { name: 'Delete' });
		if ((await replyArticle.count()) < 1 || (await replyDelete.count()) < 1) {
			bugs.push('Delete missing on own reply');
			checks.push({ id: 'delete-reply', pass: false, detail: 'reply Delete missing' });
			await mark(page, t0, log, 'FAIL: Delete affordance missing on reply');
		} else {
			await replyDelete.scrollIntoViewIfNeeded();
			await mark(page, t0, log, 'Delete affordance visible on own reply');
			await Promise.all([page.waitForLoadState('domcontentloaded'), replyDelete.click()]);
			await sleep(800);
			const deletedStatus = await page.getByText('Post deleted.').isVisible().catch(() => false);
			const gone = (await page.getByText(replyText).count()) === 0;
			const delPass = deletedStatus || gone;
			checks.push({
				id: 'delete-reply',
				pass: delPass,
				detail: delPass
					? `reply deleted${deletedStatus ? ' (status)' : ''}${gone ? ' (body gone)' : ''}`
					: 'reply still present after Delete'
			});
			if (!delPass) bugs.push('delete reply did not remove post');
			await mark(
				page,
				t0,
				log,
				delPass ? 'PASS: own reply deleted' : 'FAIL: reply still present after Delete'
			);
		}

		await page.screenshot({
			path: path.join(outDir, 'forum-report-edit-delete-1280.png'),
			fullPage: false
		});
		await sleep(900);
	} finally {
		await context.close();
		await browser.close();
	}

	const videos = await listWebms(videoDir);
	const mainVideo = videos.sort((a, b) => b.size - a.size)[0];
	if (!mainVideo) throw new Error('No webm recorded');
	const dest = path.join(outDir, VIDEO_NAME);
	await copyFile(mainVideo.path, dest);

	const pass = bugs.length === 0 && checks.every((c) => c.pass);
	const scorecard = {
		result: pass ? 'PASS' : 'FAIL',
		baseURL,
		session: NICK_EMAIL,
		video: path.relative(root, dest),
		checks,
		bugs,
		moments: log
	};
	await writeFile(path.join(outDir, 'report-edit-delete-scorecard.json'), JSON.stringify(scorecard, null, 2));
	const notes = `# Forum report / edit / delete

Result: **${scorecard.result}**
Session: ${NICK_EMAIL}
Base: ${baseURL}
Video: \`${scorecard.video}\`

## Scorecard
${checks.map((c) => `- ${c.pass ? 'PASS' : 'FAIL'} \`${c.id}\`: ${c.detail}`).join('\n')}
${bugs.length ? `\n## Bugs\n${bugs.map((b) => `- ${b}`).join('\n')}` : ''}

## On-camera moments
${log.map((e) => `- **${e.t.toFixed(2)}s** ${e.label}`).join('\n')}
`;
	await writeFile(path.join(outDir, 'report-edit-delete-NOTES.md'), notes, 'utf8');
	await rm(tmpRoot, { recursive: true, force: true });
	console.log(notes);
	if (!pass) process.exitCode = 1;
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
