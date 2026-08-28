/**
 * Seed one paid bookstore order (+ optional book request) and capture staff
 * order detail / export / fulfillment video proof.
 * Usage: node scripts/seed-and-capture-staff-orders-proof.mjs [baseUrl]
 */
import { chromium } from '@playwright/test';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const baseURL = process.argv[2] || 'http://127.0.0.1:5174';
const outDir = path.join(root, '.artifacts/verify-staff/orders');
const tmpRoot = path.join(root, '.artifacts/verify-staff/_capture-tmp-orders');
const cookieFile = path.join(root, '.artifacts/verify-staff/staff-cookie.txt');

const IDS = Object.freeze({
	bookstore: 'a1111111-1111-4111-8111-111111111111',
	teacher: 'a2222222-2222-4222-8222-222222222222',
	course: 'a3333333-3333-4333-8333-333333333333',
	book: 'a4444444-4444-4444-8444-444444444444',
	order: 'a5555555-5555-4555-8555-555555555555',
	attempt: 'a6666666-6666-4666-8666-666666666666',
	bookLine: 'a7777777-7777-4777-8777-777777777777',
	feeLine: 'a8888888-8888-4888-8888-888888888888',
	request: 'a9999999-9999-4999-8999-999999999999',
	requestItem: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
});

const REFERENCE = 'MPC-ABCDEFGH2345';
const REQUEST_REF = 'REQ-ABCDEFGHJKM2';

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

async function seedSampleOrder() {
	await loadEnvLocal(path.join(root, '.env.local'));
	const databaseUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
	if (!databaseUrl) throw new Error('MIGRATION_DATABASE_URL/DATABASE_URL missing from .env.local');

	const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
	const client = await pool.connect();
	try {
		await client.query('BEGIN');

		const existing = await client.query(`SELECT id, fulfillment_status FROM orders WHERE id = $1 OR public_reference = $2`, [
			IDS.order,
			REFERENCE
		]);
		if (existing.rows[0]) {
			await client.query(
				`UPDATE orders
				 SET payment_status = 'paid',
				     fulfillment_status = 'unstarted',
				     customer_name = 'Sample Student',
				     customer_email = 'sample.student@marihacks.com',
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
			console.log(`seed: reset existing order ${REFERENCE} to paid/unstarted`);
		} else {
			await client.query(
				`INSERT INTO bookstores (id, name, service_fee_cents, active)
				 VALUES ($1, 'Campus Books', 500, true)
				 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, service_fee_cents = EXCLUDED.service_fee_cents, active = true`,
				[IDS.bookstore]
			);
			await client.query(
				`INSERT INTO teachers (id, slug, name, active)
				 VALUES ($1, 'ada-lovelace', 'Ada Lovelace', true)
				 ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, active = true`,
				[IDS.teacher]
			);
			await client.query(
				`INSERT INTO courses (id, teacher_id, code, title, active)
				 VALUES ($1, $2, 'CSC 205', 'Data Structures', true)
				 ON CONFLICT (id) DO UPDATE SET code = EXCLUDED.code, title = EXCLUDED.title, active = true`,
				[IDS.course, IDS.teacher]
			);
			await client.query(
				`INSERT INTO books (id, bookstore_id, title, author, isbn, retailer_url, price_cents, active)
				 VALUES ($1, $2, 'Algorithms', 'CLRS', '9780262033848', 'https://marihacks.com/books/algorithms', 2000, true)
				 ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, retailer_url = EXCLUDED.retailer_url, price_cents = EXCLUDED.price_cents, active = true`,
				[IDS.book, IDS.bookstore]
			);
			await client.query(
				`INSERT INTO orders (
					id, customer_name, customer_email, public_reference,
					payment_status, fulfillment_status,
					subtotal_cents, service_fee_cents, tax_cents, total_cents, refunded_amount_cents,
					created_at, updated_at
				) VALUES (
					$1, 'Sample Student', 'sample.student@marihacks.com', $2,
					'paid', 'unstarted',
					2000, 500, 0, 2500, 0,
					now() - interval '2 hours', now() - interval '2 hours'
				)`,
				[IDS.order, REFERENCE]
			);
			await client.query(
				`INSERT INTO checkout_attempts (
					id, order_id, client_request_id, request_fingerprint, stripe_idempotency_key,
					stripe_session_id, payment_intent_id, stripe_charge_id,
					stripe_expires_at, checkout_ready_at, terminal_at, status
				) VALUES (
					$1, $2, 'seed-request-orders', 'seed-fingerprint-orders', 'seed-idempotency-orders',
					'cs_test_seed_orders', 'pi_seed_orders', 'ch_seed_orders',
					now() + interval '1 day', now() - interval '2 hours', now() - interval '90 minutes', 'completed'
				)`,
				[IDS.attempt, IDS.order]
			);
			await client.query(
				`INSERT INTO order_lines (
					id, order_id, kind, label, isbn, bookstore_id, bookstore_name,
					book_id, teacher_id, teacher_name, course_id, course_code, course_title,
					quantity, unit_amount_cents, line_amount_cents
				) VALUES (
					$1, $2, 'book', 'Algorithms', '9780262033848', $3, 'Campus Books',
					$4, $5, 'Ada Lovelace', $6, 'CSC 205', 'Data Structures',
					1, 2000, 2000
				)`,
				[IDS.bookLine, IDS.order, IDS.bookstore, IDS.book, IDS.teacher, IDS.course]
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
				[IDS.feeLine, IDS.order, IDS.bookstore]
			);
			console.log(`seed: inserted order ${REFERENCE}`);
		}

		const requestExisting = await client.query(
			`SELECT id FROM book_requests WHERE id = $1 OR public_reference = $2`,
			[IDS.request, REQUEST_REF]
		);
		if (requestExisting.rows[0]) {
			await client.query(
				`UPDATE book_requests
				 SET status = 'submitted', bookstore_id = NULL, version = version + 1, updated_at = now()
				 WHERE id = $1`,
				[requestExisting.rows[0].id]
			);
			console.log(`seed: reset book request ${REQUEST_REF}`);
		} else {
			await client.query(
				`INSERT INTO book_requests (
					id, public_reference, client_request_id, student_name, student_email,
					teacher_name, course_name, status, bookstore_id
				) VALUES (
					$1, $2, 'seed-book-request-staff', 'Sample Student', 'sample.student@marihacks.com',
					'Ada Lovelace', 'CSC 205 Data Structures', 'submitted', NULL
				)`,
				[IDS.request, REQUEST_REF]
			);
			await client.query(
				`INSERT INTO book_request_items (id, request_id, position, title, author, isbn, quantity)
				 VALUES ($1, $2, 0, 'Discrete Mathematics', 'Rosen', '9780073383095', 1)`,
				[IDS.requestItem, IDS.request]
			);
			console.log(`seed: inserted book request ${REQUEST_REF}`);
		}

		await client.query('COMMIT');
		console.log(`seed: ready order ${REFERENCE} (${IDS.order}) + request ${REQUEST_REF}`);
		return { orderId: IDS.order, reference: REFERENCE, requestRef: REQUEST_REF };
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

/**
 * @param {import('@playwright/test').Browser} browser
 * @param {{ orderId: string, reference: string, requestRef: string }} seeded
 */
async function captureOrders(browser, seeded) {
	await mkdir(outDir, { recursive: true });
	await rm(tmpRoot, { recursive: true, force: true });
	const videoDir = path.join(tmpRoot, 'video');
	await mkdir(videoDir, { recursive: true });

	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL,
		acceptDownloads: true
	});
	await context.addCookies([await staffCookie()]);
	const page = await context.newPage();
	const log = /** @type {Array<{t:number,label:string}>} */ ([]);
	const bugs = /** @type {string[]} */ ([]);
	const t0 = Date.now();

	await page.goto('/staff', { waitUntil: 'networkidle' });
	await mark(page, t0, log, 'ledger with staff session');
	const ledgerText = await page.locator('body').innerText();
	if (!ledgerText.includes(seeded.reference)) {
		bugs.push(`ledger missing ${seeded.reference}`);
	}
	if (/No orders match these filters/i.test(ledgerText) && !ledgerText.includes(seeded.reference)) {
		bugs.push('ledger still empty after seed');
	}
	await page.screenshot({ path: path.join(outDir, 'ledger-with-order.png'), fullPage: false });

	const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
	await page.getByRole('button', { name: 'Download purchase list' }).click();
	const download = await downloadPromise;
	const csvPath = path.join(outDir, 'bookstore-purchase-list.csv');
	if (download) {
		await download.saveAs(csvPath);
	} else {
		const csv = await page.evaluate(async () => {
			const res = await fetch('/staff/orders/export', {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: 'intent=purchase_list',
				credentials: 'same-origin'
			});
			return { ok: res.ok, body: await res.text() };
		});
		if (!csv.ok) bugs.push(`export fetch failed after button click`);
		await writeFile(csvPath, csv.body);
	}
	await page.getByText(/Purchase list downloaded|Preparing purchase list/i).first().waitFor({
		state: 'visible',
		timeout: 8000
	}).catch(() => bugs.push('export status not shown on ledger'));
	const csv = await readFile(csvPath, 'utf8');
	await mark(page, t0, log, `export saved (${csv.trim().split(/\r?\n/).length} lines)`);
	if (!/Campus Books/i.test(csv) || !/Algorithms/i.test(csv)) {
		bugs.push('export CSV missing bookstore/title rows');
	}

	await page.getByRole('link', { name: new RegExp(`Open ${seeded.reference}`) }).click();
	await page.waitForURL(new RegExp(`/staff/orders/${seeded.orderId}$`));
	await page.getByRole('heading', { name: seeded.reference }).waitFor({ state: 'visible' });
	await mark(page, t0, log, 'order detail loaded');
	await page.screenshot({ path: path.join(outDir, 'order-detail.png'), fullPage: false });

	const startPurchasing = page.getByRole('button', { name: 'Start purchasing' });
	if ((await startPurchasing.count()) === 0) {
		bugs.push('missing Start purchasing next action');
	} else {
		const fulfillmentBadge = page.locator('.heading-statuses .status').nth(1);
		const beforeBadge = ((await fulfillmentBadge.textContent()) ?? '').trim();
		if (!/^Unstarted$/i.test(beforeBadge)) {
			bugs.push(`expected Unstarted badge before advance, got "${beforeBadge}"`);
		}
		await startPurchasing.click();
		const advanced = await page
			.locator('.heading-statuses .status')
			.filter({ hasText: /^Purchasing$/i })
			.first()
			.waitFor({ state: 'visible', timeout: 12000 })
			.then(() => true)
			.catch(() => false);
		const stillUpdating = await page.getByText('Updating order').isVisible().catch(() => false);
		const stillStart = (await page.getByRole('button', { name: 'Start purchasing' }).count()) > 0;
		const badgeText = ((await fulfillmentBadge.textContent()) ?? '').trim();
		if (!advanced || stillUpdating || stillStart || !/^Purchasing$/i.test(badgeText)) {
			bugs.push(
				`fulfillment did not advance on screen (badge="${badgeText}", updating=${stillUpdating}, startButton=${stillStart})`
			);
		} else {
			await mark(page, t0, log, 'fulfillment badge Purchasing');
		}
		await page.screenshot({ path: path.join(outDir, 'order-after-advance.png'), fullPage: false });
	}

	await page.goto('/staff/book-work', { waitUntil: 'domcontentloaded' });
	await page.getByRole('heading', { name: 'Book work' }).waitFor({ state: 'visible', timeout: 10000 });
	await mark(page, t0, log, 'book work seeded request (staff view)');
	const workText = await page.locator('body').innerText();
	if (!/Discrete Mathematics/i.test(workText)) {
		bugs.push('book work missing seeded request item');
	}
	if (!workText.includes(seeded.requestRef)) {
		bugs.push(`book work missing visible request id ${seeded.requestRef}`);
	}
	if (/There is no outstanding book work/i.test(workText) && !/Discrete Mathematics/i.test(workText)) {
		bugs.push('book work empty despite submitted request');
	}
	await page.screenshot({ path: path.join(outDir, 'book-work-handoff.png'), fullPage: false });
	await sleep(900);

	await context.close();

	const videos = await listWebms(videoDir);
	if (videos.length === 0) throw new Error('no webm recorded');
	videos.sort((a, b) => b.size - a.size);
	const dest = path.join(outDir, 'orders-detail-export.webm');
	await copyFile(videos[0].path, dest);
	await writeFile(
		path.join(outDir, 'NOTES.md'),
		[
			'# Staff orders proof',
			'',
			`- Seeded order: \`${seeded.reference}\` (\`${seeded.orderId}\`)`,
			`- Seeded book request (DB → staff Book work, not filmed student UI): \`${seeded.requestRef}\``,
			`- Video: \`orders-detail-export.webm\``,
			`- Export CSV: \`bookstore-purchase-list.csv\``,
			'',
			'## Claims',
			'- Advance PASS only if fulfillment badge becomes Purchasing and Start purchasing is gone.',
			'- Handoff PASS only if `REQ-…` is visible on Book work (seeded staff view).',
			'- Do not treat HUD labels as proof.',
			'',
			'## Timeline',
			...log.map((entry) => `- ${entry.t.toFixed(2)}s ${entry.label}`),
			'',
			'## Bugs spotted',
			...(bugs.length ? bugs.map((b) => `- ${b}`) : ['- none']),
			''
		].join('\n')
	);
	await writeFile(path.join(outDir, 'capture-log.json'), JSON.stringify({ log, bugs, seeded }, null, 2));
	return { dest, bugs, csvPath };
}

async function main() {
	const seeded = await seedSampleOrder();
	const browser = await chromium.launch();
	try {
		const result = await captureOrders(browser, seeded);
		console.log('video', result.dest);
		console.log('bugs', result.bugs);
		if (result.bugs.length) process.exitCode = 2;
	} finally {
		await browser.close();
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
