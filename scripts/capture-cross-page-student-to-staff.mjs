/**
 * Cross-page Student → Staff visibility proof.
 * Student creates a club submission + book request (or seeded order fallback).
 * Staff session opens /staff, catalogue, book-work, and clubs pending queue.
 * Usage: node scripts/capture-cross-page-student-to-staff.mjs [baseUrl]
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
const outDir = path.join(root, '.artifacts/verify-staff/cross-page');
const tmpRoot = path.join(root, '.artifacts/verify-staff/_capture-tmp-cross-student');
const staffCookieFile = path.join(root, '.artifacts/verify-staff/staff-cookie.txt');
const NICK_EMAIL = 'nick.zhicheng@gmail.com';
const CLUB_NAME = `Cross Staff Club ${Date.now().toString(36)}`;
const BOOK_TITLE = `CrossPage Algorithms ${Date.now().toString(36)}`;

const ORDER_IDS = Object.freeze({
	bookstore: 'a1111111-1111-4111-8111-111111111111',
	teacher: 'b2222222-2222-4222-8222-222222222222',
	course: 'b3333333-3333-4333-8333-333333333333',
	book: 'b4444444-4444-4444-8444-444444444444',
	order: 'b5555555-5555-4555-8555-555555555555',
	attempt: 'b6666666-6666-4666-8666-666666666666',
	bookLine: 'b7777777-7777-4777-8777-777777777777',
	feeLine: 'b8888888-8888-4888-8888-888888888888'
});
const ORDER_REF = 'MPC-CLUBSTAFF234';
const PUBLIC_REFERENCE_PATTERN = /^MPC-[A-HJ-NP-Z2-9]{12}$/u;
if (!PUBLIC_REFERENCE_PATTERN.test(ORDER_REF)) {
	throw new Error(`ORDER_REF ${ORDER_REF} must match staff public-reference alphabet`);
}

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
					'max-width:72vw',
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

/** @param {string} dir */
async function listWebms(dir) {
	const names = await readdir(dir);
	const out = [];
	for (const name of names) {
		if (!name.endsWith('.webm')) continue;
		const full = path.join(dir, name);
		out.push({ path: full, size: (await stat(full)).size });
	}
	return out;
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
		const token = `proofCross${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
		const id = `proofCrossSess${Date.now().toString(36)}`;
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

async function staffCookie() {
	const raw = (await readFile(staffCookieFile, 'utf8')).trim();
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

async function seedPaidOrderIfNeeded() {
	await loadEnvLocal(path.join(root, '.env.local'));
	const databaseUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error('DATABASE_URL missing');
	const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
	const client = await pool.connect();
	try {
		await client.query('BEGIN');
		await client.query(
			`INSERT INTO bookstores (id, name, service_fee_cents, active)
			 VALUES ($1, 'Campus Books', 500, true)
			 ON CONFLICT (id) DO UPDATE SET active = true`,
			[ORDER_IDS.bookstore]
		);
		await client.query(
			`INSERT INTO teachers (id, slug, name, active)
			 VALUES ($1, 'cross-ada', 'Cross Ada', true)
			 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, active = true`,
			[ORDER_IDS.teacher]
		);
		await client.query(
			`INSERT INTO courses (id, teacher_id, code, title, active)
			 VALUES ($1, $2, 'CSC 209', 'Cross Structures', true)
			 ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, title = EXCLUDED.title, active = true`,
			[ORDER_IDS.course, ORDER_IDS.teacher]
		);
		await client.query(
			`INSERT INTO books (id, bookstore_id, title, author, isbn, retailer_url, price_cents, active)
			 VALUES ($1, $2, 'Cross Algorithms', 'CLRS', '9780262033849', 'https://marihacks.com/books/cross', 2000, true)
			 ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, active = true`,
			[ORDER_IDS.book, ORDER_IDS.bookstore]
		);

		const existing = await client.query(
			`SELECT id FROM orders WHERE id = $1 OR public_reference = $2`,
			[ORDER_IDS.order, ORDER_REF]
		);
		if (existing.rows[0]) {
			await client.query(
				`UPDATE orders
				 SET payment_status = 'paid',
				     fulfillment_status = 'unstarted',
				     customer_name = 'Cross Page Student',
				     customer_email = 'cross.student@marihacks.com',
				     subtotal_cents = 2000,
				     service_fee_cents = 500,
				     tax_cents = 0,
				     total_cents = 2500,
				     refunded_amount_cents = 0,
				     version = version + 1,
				     updated_at = now()
				 WHERE id = $1`,
				[existing.rows[0].id]
			);
			console.log(`seed: reset existing order ${ORDER_REF} to paid/unstarted`);
			await client.query('COMMIT');
			return { orderId: existing.rows[0].id, reference: ORDER_REF };
		}

		await client.query(
			`INSERT INTO orders (
				id, customer_name, customer_email, public_reference,
				payment_status, fulfillment_status,
				subtotal_cents, service_fee_cents, tax_cents, total_cents, refunded_amount_cents,
				created_at, updated_at
			) VALUES (
				$1, 'Cross Page Student', 'cross.student@marihacks.com', $2,
				'paid', 'unstarted',
				2000, 500, 0, 2500, 0,
				now() - interval '1 hour', now() - interval '1 hour'
			)`,
			[ORDER_IDS.order, ORDER_REF]
		);
		await client.query(
			`INSERT INTO checkout_attempts (
				id, order_id, client_request_id, request_fingerprint, stripe_idempotency_key,
				stripe_session_id, payment_intent_id, stripe_charge_id,
				stripe_expires_at, checkout_ready_at, terminal_at, status
			) VALUES (
				$1, $2, 'seed-request-cross', 'seed-fingerprint-cross', 'seed-idempotency-cross',
				'cs_test_seed_cross', 'pi_seed_cross', 'ch_seed_cross',
				now() + interval '1 day', now() - interval '1 hour', now() - interval '50 minutes', 'completed'
			)`,
			[ORDER_IDS.attempt, ORDER_IDS.order]
		);
		await client.query(
			`INSERT INTO order_lines (
				id, order_id, kind, label, isbn, bookstore_id, bookstore_name,
				book_id, teacher_id, teacher_name, course_id, course_code, course_title,
				quantity, unit_amount_cents, line_amount_cents
			) VALUES (
				$1, $2, 'book', 'Cross Algorithms', '9780262033849', $3, 'Campus Books',
				$4, $5, 'Cross Ada', $6, 'CSC 209', 'Cross Structures',
				1, 2000, 2000
			)`,
			[
				ORDER_IDS.bookLine,
				ORDER_IDS.order,
				ORDER_IDS.bookstore,
				ORDER_IDS.book,
				ORDER_IDS.teacher,
				ORDER_IDS.course
			]
		);
		await client.query(
			`INSERT INTO order_lines (
				id, order_id, kind, label, isbn, bookstore_id, bookstore_name,
				book_id, teacher_id, teacher_name, course_id, course_code, course_title,
				quantity, unit_amount_cents, line_amount_cents
			) VALUES (
				$1, $2, 'service_fee', 'Service fee', NULL, $3, 'Campus Books',
				NULL, NULL, NULL, NULL, NULL, NULL,
				1, 500, 500
			)`,
			[ORDER_IDS.feeLine, ORDER_IDS.order, ORDER_IDS.bookstore]
		);
		await client.query('COMMIT');
		console.log(`seed: inserted order ${ORDER_REF}`);
		return { orderId: ORDER_IDS.order, reference: ORDER_REF };
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
		await pool.end();
	}
}

async function main() {
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(tmpRoot, { recursive: true });
	await mkdir(outDir, { recursive: true });

	const seeded = await seedPaidOrderIfNeeded();
	const studentState = await mintNickStorageState();
	const staff = await staffCookie();

	const browser = await chromium.launch({ channel: 'chrome', headless: true });
	const videoDir = path.join(tmpRoot, 'video');
	await mkdir(videoDir, { recursive: true });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL,
		storageState: studentState
	});
	const page = await context.newPage();
	const log = /** @type {Array<{t:number,label:string}>} */ ([]);
	const bugs = /** @type {string[]} */ ([]);
	const t0 = Date.now();

	// B1. Student club submission
	await page.goto('/tools/clubs', { waitUntil: 'networkidle' });
	await mark(page, t0, log, 'student clubs');
	const clubsBody = await page.locator('body').innerText();
	if (/Sign in to submit/i.test(clubsBody)) bugs.push('student still gated on clubs');
	await page.locator('form[action="?/submit"] input[name="name"]').fill(CLUB_NAME);
	await page.locator('form[action="?/submit"] input[name="category"]').fill('STEM');
	await page
		.locator('form[action="?/submit"] textarea[name="description"]')
		.fill('Cross-page student→staff visibility proof club.');
	await page.getByRole('button', { name: 'Send for review' }).click();
	await page.waitForLoadState('networkidle');
	const afterClub = await page.locator('body').innerText();
	if (!/Sent for review/i.test(afterClub)) bugs.push('club submit success missing');
	await mark(page, t0, log, `submitted club "${CLUB_NAME}"`);
	await page.screenshot({ path: path.join(outDir, 'student-club-submitted.png'), fullPage: false });

	// B2. Student book request (route may be gated off → homepage)
	await page.goto('/books/request', { waitUntil: 'networkidle' });
	await mark(page, t0, log, 'student book request');
	const requestUrl = page.url();
	const nameInput = page.locator('input[name="name"]');
	if (!/\/books\/request/.test(requestUrl) || (await nameInput.count()) === 0) {
		await mark(
			page,
			t0,
			log,
			`book request route gated (landed ${requestUrl}) — seeded order covers /staff`
		);
	} else {
		const requestBody = await page.locator('body').innerText();
		if (/Book requests are unavailable/i.test(requestBody)) {
			await mark(page, t0, log, 'book request unavailable — relying on seeded order');
		} else {
			await nameInput.fill('Cross Page Student');
			await page.locator('input[name="email"]').fill('cross.student@marihacks.com');
			await page.locator('select[name="teacher"]').selectOption('other');
			await page.locator('input[name="teacherOther"]').fill('Cross Ada');
			await page.locator('select[name="course"]').selectOption('other');
			await page.locator('input[name="courseOther"]').fill('CSC 209: Cross Structures');
			await page
				.locator('fieldset.book-fieldset')
				.first()
				.locator('input[name="title"]')
				.fill(BOOK_TITLE);
			await page
				.locator('fieldset.book-fieldset')
				.first()
				.locator('input[name="author"]')
				.fill('CLRS');
			await page.getByRole('button', { name: 'Submit request' }).click();
			await page.waitForLoadState('networkidle');
			const afterReq = page.url();
			const received = /\/books\/request\/received/.test(afterReq);
			const body = await page.locator('body').innerText();
			if (!received && !/received|thank|reference|REQ-/i.test(body)) {
				bugs.push(`book request did not land (${afterReq})`);
			}
			await mark(page, t0, log, `book request result url=${afterReq}`);
			await page.screenshot({
				path: path.join(outDir, 'student-book-request.png'),
				fullPage: false
			});
		}
	}

	await context.close();

	// B3. Staff session: /staff, catalogue, book-work, clubs pending
	const staffCtx = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL
	});
	await staffCtx.addCookies([staff]);
	const staffPage = await staffCtx.newPage();

	await staffPage.goto('/staff', { waitUntil: 'networkidle' });
	await mark(staffPage, t0, log, 'staff ledger');
	const ledger = await staffPage.locator('body').innerText();
	if (/Orders are unavailable/i.test(ledger)) {
		bugs.push('staff ledger unavailable');
	}
	if (!ledger.includes(seeded.reference)) {
		bugs.push(`staff ledger missing ${seeded.reference}`);
	} else {
		await mark(staffPage, t0, log, `ledger shows ${seeded.reference}`);
	}
	await staffPage.screenshot({ path: path.join(outDir, 'staff-ledger.png'), fullPage: false });

	await staffPage.goto('/staff/catalogue/books', { waitUntil: 'networkidle' });
	await mark(staffPage, t0, log, 'staff catalogue books');
	const cat = await staffPage.locator('body').innerText();
	if (/Sign in|Continue with Google/i.test(cat) && !/Catalogue|Books|Add/i.test(cat)) {
		bugs.push('catalogue redirected to sign-in');
	}
	await staffPage.screenshot({ path: path.join(outDir, 'staff-catalogue.png'), fullPage: false });

	await staffPage.goto('/staff/book-work', { waitUntil: 'networkidle' });
	await mark(staffPage, t0, log, 'staff book-work');
	const work = await staffPage.locator('body').innerText();
	const seesBook =
		work.includes(BOOK_TITLE) ||
		/Cross Algorithms|outstanding book work|Unassigned|Campus Books|Record pickup|Assign/i.test(
			work
		);
	// Empty board is OK when public books request is gated; seeded paid order still proves /staff.
	if (/Sign in|Continue with Google/i.test(work) && !/Book work/i.test(work)) {
		bugs.push('book-work redirected to sign-in');
	}
	await mark(
		staffPage,
		t0,
		log,
		seesBook
			? 'book-work shows student/seeded artifact'
			: /no outstanding book work/i.test(work)
				? 'book-work empty (books request gated; ledger carries order)'
				: 'book-work checked'
	);
	await staffPage.screenshot({ path: path.join(outDir, 'staff-book-work.png'), fullPage: false });

	await staffPage.goto('/tools/clubs', { waitUntil: 'networkidle' });
	await mark(staffPage, t0, log, 'staff clubs pending');
	const pendingPanel = staffPage.locator('[data-testid="staff-pending-clubs"]');
	if ((await pendingPanel.count()) === 0) {
		bugs.push('staff pending queue missing (not authorized or wrong surface)');
	} else {
		await pendingPanel.scrollIntoViewIfNeeded();
	}
	const pendingArticle = staffPage.locator(`[data-pending-club="${CLUB_NAME}"]`).first();
	if ((await pendingArticle.count()) === 0) {
		bugs.push(`staff clubs pending missing "${CLUB_NAME}"`);
	} else {
		await pendingArticle.scrollIntoViewIfNeeded();
		await sleep(400);
		const inViewport = await pendingArticle.evaluate((el) => {
			const r = el.getBoundingClientRect();
			return r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0;
		});
		if (!inViewport) {
			bugs.push(`pending club "${CLUB_NAME}" not in viewport (Robotics-only false pass)`);
		}
	}
	const clubsStaff = await staffPage.locator('body').innerText();
	if (!/Publish/i.test(clubsStaff)) bugs.push('staff publish controls missing');
	const viewportText = await staffPage.evaluate(() => {
		const vh = window.innerHeight;
		return [...document.querySelectorAll('h1, h2, strong, p, a.club-row, [data-pending-club]')]
			.filter((el) => {
				const r = el.getBoundingClientRect();
				return r.bottom > 0 && r.top < vh && r.height > 0;
			})
			.map((el) => el.textContent ?? '')
			.join('\n');
	});
	if (/Robotics Club/i.test(viewportText) && !viewportText.includes(CLUB_NAME)) {
		bugs.push('viewport shows Robotics only; pending club not on camera');
	}
	if (!viewportText.includes(CLUB_NAME) && !bugs.some((b) => b.includes(CLUB_NAME))) {
		bugs.push(`pending club "${CLUB_NAME}" not visible on camera`);
	}
	await mark(
		staffPage,
		t0,
		log,
		bugs.some((b) => /pending|viewport|Robotics only/i.test(b))
			? 'pending miss'
			: `pending club visible on camera: ${CLUB_NAME}`
	);
	await staffPage.screenshot({ path: path.join(outDir, 'staff-clubs-pending.png'), fullPage: false });

	await staffCtx.close();
	await browser.close();

	const videos = await listWebms(videoDir);
	// Context 0 = student, context 1 = staff. Prefer chronological stitch over size.
	videos.sort((a, b) => a.path.localeCompare(b.path));
	if (videos.length === 0) throw new Error('no webm');
	const dest = path.join(outDir, 'student-to-staff.webm');
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
			// Fallback: copy first then keep second as part2
			await copyFile(videos[0].path, dest);
			await copyFile(videos[1].path, path.join(outDir, 'student-to-staff-part2.webm'));
			console.warn('ffmpeg concat failed; wrote part2 separately', stitch.stderr?.slice(0, 200));
		}
	}

	const pass = bugs.length === 0;
	const notes = `# Student → Staff cross-page

## Result: ${pass ? 'PASS' : 'FAIL'}
- Club: ${CLUB_NAME}
- Book title: ${BOOK_TITLE}
- Seeded order: ${seeded.reference}
- Base: ${baseURL}

## On-camera moments
${log.map((e) => `- **${e.t.toFixed(2)}s** ${e.label}`).join('\n')}

## Bugs
${bugs.length ? bugs.map((b) => `- ${b}`).join('\n') : '- none'}

## Artifacts
- \`.artifacts/verify-staff/cross-page/student-to-staff.webm\`
`;
	await writeFile(path.join(outDir, 'NOTES.md'), notes, 'utf8');
	await writeFile(
		path.join(outDir, 'student-to-staff.json'),
		JSON.stringify(
			{ pass, bugs, log, club: CLUB_NAME, book: BOOK_TITLE, order: seeded, video: dest },
			null,
			2
		),
		'utf8'
	);
	await rm(tmpRoot, { recursive: true, force: true });
	console.log(notes);
	if (!pass) process.exitCode = 1;
}

main().catch((err) => {
	console.error(err);
	process.exitCode = 1;
});
