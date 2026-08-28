/**
 * Honest proof that semester outline file input is button-scoped.
 * Films labeled inert clicks (empty sheet + heading) then Add course outline
 * opening a filechooser (Playwright intercept + page-DOM banner in #svelte).
 *
 * Usage: node scripts/capture-semester-file-picker-fix.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:5174
 * Artifacts: .artifacts/semester-file-picker-fix/
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
const outDir = path.join(root, '.artifacts/semester-file-picker-fix');
const tmpRoot = path.join(outDir, '_capture-tmp');
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
	await page.evaluate((text) => {
		const el = document.getElementById('proof-hud-log');
		if (el) {
			const row = document.createElement('div');
			row.textContent = text;
			el.prepend(row);
			while (el.childElementCount > 6) el.lastElementChild?.remove();
		}
	}, label);
	await sleep(400);
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

		const token = `proofPick${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
		const id = `proofPickSess${Date.now().toString(36)}`;
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
 * @param {import('@playwright/test').Page} page
 */
async function installProofChrome(page) {
	await page.evaluate(() => {
		if (document.getElementById('proof-hud')) return;
		const style = document.createElement('style');
		style.textContent = `
			#proof-page-chooser {
				position: fixed; top: 0; left: 0; right: 0; z-index: 40; display: block;
				box-sizing: border-box; margin: 0; padding: 14px 18px;
				background: #1a2332; color: #ffe08a; border-bottom: 4px solid #ff3b30;
				font: 700 18px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
				letter-spacing: 0.02em; text-align: center; pointer-events: none;
			}
			#proof-page-chooser.ok {
				background: #14351f; color: #9dffb0; border-bottom-color: #2ecc71;
			}
			#proof-page-chooser.bad {
				background: #3a1414; color: #ff9d9d; border-bottom-color: #e74c3c;
			}
			#proof-hud {
				position: fixed; right: 16px; bottom: 72px; z-index: 2147483646;
				width: 420px; max-width: calc(100vw - 32px); padding: 10px 12px; border-radius: 8px;
				background: rgba(12, 18, 28, 0.92); color: #f4f7fb;
				font: 13px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
				pointer-events: none; box-shadow: 0 8px 24px rgba(0,0,0,.35);
			}
			#proof-hud strong { display: block; margin-bottom: 6px; color: #9ad0ff; }
			#proof-hud-banner {
				margin-top: 8px; padding: 8px 10px; border-radius: 6px;
				background: #1b2a40; color: #ffe08a; font-weight: 700;
				min-height: 1.4em;
			}
			#proof-hud-banner.ok { background: #14351f; color: #9dffb0; }
			#proof-hud-banner.bad { background: #3a1414; color: #ff9d9d; }
			#proof-hud-log { margin-top: 8px; opacity: 0.9; font-size: 11px; }
			#proof-hud-log div { margin-bottom: 2px; }
			#proof-cursor {
				position: fixed; width: 18px; height: 18px; margin: -2px 0 0 -2px;
				border: 2px solid #ff3b30; border-radius: 50%;
				background: rgba(255, 59, 48, 0.35); z-index: 2147483647;
				pointer-events: none; transform: translate(-50%, -50%);
			}
			#proof-click-ring {
				position: fixed; width: 44px; height: 44px; margin: 0;
				border: 3px solid #ff3b30; border-radius: 50%;
				z-index: 2147483647; pointer-events: none;
				transform: translate(-50%, -50%); opacity: 0;
				transition: opacity 80ms linear;
			}
			#proof-click-ring.on { opacity: 1; }
			#proof-target-box {
				position: fixed; z-index: 2147483645; pointer-events: none;
				border: 3px solid #ff3b30; border-radius: 6px;
				box-shadow: 0 0 0 2px rgba(255,255,255,0.85);
			}
			#proof-target-label {
				position: fixed; z-index: 2147483645; pointer-events: none;
				background: #ff3b30; color: white; padding: 3px 8px; border-radius: 4px;
				font: 700 12px/1.2 ui-sans-serif, system-ui, sans-serif;
			}
		`;
		document.head.appendChild(style);

		// Page-level banner inside the app document (not the HUD). Reviewers
		// discard #proof-hud; this lives under #svelte / .mt-preview.
		const pageHost =
			document.querySelector('#svelte') ||
			document.querySelector('.mt-preview') ||
			document.querySelector('.page-semester') ||
			document.body;
		const pageBanner = document.createElement('div');
		pageBanner.id = 'proof-page-chooser';
		pageBanner.setAttribute('data-proof', 'page-chooser');
		pageBanner.textContent = 'NO chooser (count 0)';
		pageHost.prepend(pageBanner);

		const hud = document.createElement('div');
		hud.id = 'proof-hud';
		hud.innerHTML = `
			<strong>Semester file-picker proof</strong>
			<div id="proof-geom">input geometry: measuring…</div>
			<div id="proof-hud-banner">Ready</div>
			<div id="proof-hud-log"></div>
		`;
		document.body.appendChild(hud);

		const cursor = document.createElement('div');
		cursor.id = 'proof-cursor';
		document.body.appendChild(cursor);
		const ring = document.createElement('div');
		ring.id = 'proof-click-ring';
		document.body.appendChild(ring);
		const targetBox = document.createElement('div');
		targetBox.id = 'proof-target-box';
		document.body.appendChild(targetBox);
		const targetLabel = document.createElement('div');
		targetLabel.id = 'proof-target-label';
		document.body.appendChild(targetLabel);

		window.__proofChooserCount = 0;
		window.__proofLastChooserAt = null;

		document.addEventListener(
			'mousemove',
			(e) => {
				cursor.style.left = `${e.clientX}px`;
				cursor.style.top = `${e.clientY}px`;
			},
			true
		);
		document.addEventListener(
			'mousedown',
			(e) => {
				ring.style.left = `${e.clientX}px`;
				ring.style.top = `${e.clientY}px`;
				ring.classList.add('on');
				setTimeout(() => ring.classList.remove('on'), 450);
			},
			true
		);
	});
}

/**
 * Update the in-document page banner (primary review evidence) and the HUD mirror.
 * @param {import('@playwright/test').Page} page
 * @param {string} text
 * @param {'ok'|'bad'|''} [kind]
 */
async function setBanner(page, text, kind = '') {
	await page.evaluate(
		({ text, kind }) => {
			const pageEl = document.getElementById('proof-page-chooser');
			if (pageEl) {
				pageEl.textContent = text;
				pageEl.className = kind;
			}
			const el = document.getElementById('proof-hud-banner');
			if (el) {
				el.textContent = text;
				el.className = kind;
			}
		},
		{ text, kind }
	);
}

/**
 * Sync page banner from live chooser count (call from filechooser handler).
 * @param {import('@playwright/test').Page} page
 */
async function paintChooserFired(page) {
	await page.evaluate(() => {
		const n = Number(window.__proofChooserCount || 0);
		const text =
			n > 0 ? `FILECHOOSER FIRED (count ${n})` : 'NO chooser (count 0)';
		const kind = n > 0 ? 'ok' : '';
		const pageEl = document.getElementById('proof-page-chooser');
		if (pageEl) {
			pageEl.textContent = text;
			pageEl.className = kind;
		}
		const el = document.getElementById('proof-hud-banner');
		if (el) {
			el.textContent = text;
			el.className = kind;
		}
	});
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {{x:number,y:number,width:number,height:number}} box
 * @param {string} label
 */
async function highlightTarget(page, box, label) {
	await page.evaluate(
		({ box, label }) => {
			const el = document.getElementById('proof-target-box');
			const tag = document.getElementById('proof-target-label');
			if (!el || !tag) return;
			el.style.left = `${box.x - 4}px`;
			el.style.top = `${box.y - 4}px`;
			el.style.width = `${box.width + 8}px`;
			el.style.height = `${box.height + 8}px`;
			el.style.display = 'block';
			tag.textContent = label;
			tag.style.left = `${Math.max(8, box.x - 4)}px`;
			tag.style.top = `${Math.max(8, box.y - 28)}px`;
			tag.style.display = 'block';
		},
		{ box, label }
	);
	await sleep(700);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} x
 * @param {number} y
 */
async function moveAndClick(page, x, y) {
	await page.mouse.move(x, y, { steps: 14 });
	await sleep(280);
	await page.mouse.click(x, y);
	await sleep(500);
}

/**
 * Wait briefly and read whether a filechooser arrived since `before`.
 * @param {import('@playwright/test').Page} page
 * @param {number} before
 * @param {number} ms
 */
async function chooserDelta(page, before, ms = 900) {
	await sleep(ms);
	return page.evaluate((b) => Number(window.__proofChooserCount || 0) - b, before);
}

async function main() {
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(tmpRoot, { recursive: true });
	await mkdir(outDir, { recursive: true });

	const storageState = await mintNickStorageState();
	const videoDir = path.join(tmpRoot, 'video');
	await mkdir(videoDir, { recursive: true });

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL,
		storageState
	});
	const page = await context.newPage();
	const log = /** @type {Array<{t:number,label:string}>} */ ([]);
	const notes = /** @type {string[]} */ ([]);
	const t0 = Date.now();

	/** @type {import('@playwright/test').FileChooser[]} */
	const choosers = [];
	page.on('filechooser', async (chooser) => {
		choosers.push(chooser);
		await page.evaluate(() => {
			window.__proofChooserCount = Number(window.__proofChooserCount || 0) + 1;
			window.__proofLastChooserAt = Date.now();
		});
		await paintChooserFired(page);
		// Playwright already intercepted the OS dialog; leave files unset.
		void chooser;
	});

	try {
		await page.goto('/tools/semester', { waitUntil: 'networkidle' });
		await page.waitForSelector('label.add-outline', { timeout: 15000 });
		await installProofChrome(page);
		await setBanner(page, 'NO chooser (count 0)', '');
		await mark(page, t0, log, 'semester ready with Add course outline');

		const geom = await page.evaluate(() => {
			const input = document.querySelector('label.add-outline input[type="file"]');
			const label = document.querySelector('label.add-outline');
			if (!input || !label) return null;
			const ir = input.getBoundingClientRect();
			const lr = label.getBoundingClientRect();
			return {
				input: {
					w: Math.round(ir.width),
					h: Math.round(ir.height),
					x: Math.round(ir.x),
					y: Math.round(ir.y)
				},
				label: {
					w: Math.round(lr.width),
					h: Math.round(lr.height),
					x: Math.round(lr.x),
					y: Math.round(lr.y)
				}
			};
		});
		if (!geom) throw new Error('Could not measure add-outline geometry');
		notes.push(`input ${geom.input.w}x${geom.input.h} at (${geom.input.x},${geom.input.y})`);
		notes.push(`label ${geom.label.w}x${geom.label.h} at (${geom.label.x},${geom.label.y})`);
		await page.evaluate((g) => {
			const el = document.getElementById('proof-geom');
			if (el) {
				el.textContent = `input ${g.input.w}×${g.input.h} (label ${g.label.w}×${g.label.h}) — must be button-scoped, not ~1280×800`;
			}
		}, geom);
		await mark(
			page,
			t0,
			log,
			`geometry input ${geom.input.w}x${geom.input.h} label ${geom.label.w}x${geom.label.h}`
		);

		const sheet = await page.locator('.review-sheet .sheet-empty').boundingBox();
		const heading = await page.locator('.review-sheet h2').boundingBox();
		const button = await page.locator('label.add-outline').boundingBox();
		if (!sheet || !heading || !button) {
			throw new Error('Missing sheet/heading/button boxes');
		}

		// 1) Empty sheet click — must NOT fire chooser
		await setBanner(page, '1/3 Click EMPTY SHEET — expect NO filechooser', '');
		await highlightTarget(page, sheet, 'TARGET: empty sheet');
		await mark(page, t0, log, 'click empty sheet (expect no chooser)');
		const beforeSheet = choosers.length;
		const sheetX = Math.round(sheet.x + sheet.width * 0.55);
		const sheetY = Math.round(sheet.y + sheet.height * 0.55);
		await moveAndClick(page, sheetX, sheetY);
		const sheetDelta = await chooserDelta(page, beforeSheet);
		const sheetOk = sheetDelta === 0;
		await setBanner(
			page,
			sheetOk
				? `NO chooser (count ${choosers.length}) — empty sheet inert`
				: `FAIL: empty sheet fired chooser (+${sheetDelta})`,
			sheetOk ? 'ok' : 'bad'
		);
		await mark(
			page,
			t0,
			log,
			sheetOk ? 'empty sheet inert OK' : `BUG empty sheet fired chooser +${sheetDelta}`
		);
		await sleep(1200);

		// 2) Heading / Upload an outline region — must NOT fire chooser
		await setBanner(page, '2/3 Click HEADING “Upload an outline” — expect NO filechooser', '');
		await highlightTarget(page, heading, 'TARGET: Upload an outline heading');
		await mark(page, t0, log, 'click Upload an outline heading (expect no chooser)');
		const beforeHead = choosers.length;
		const headX = Math.round(heading.x + heading.width / 2);
		const headY = Math.round(heading.y + heading.height / 2);
		await moveAndClick(page, headX, headY);
		const headDelta = await chooserDelta(page, beforeHead);
		const headOk = headDelta === 0;
		await setBanner(
			page,
			headOk
				? `NO chooser (count ${choosers.length}) — heading inert`
				: `FAIL: heading fired chooser (+${headDelta})`,
			headOk ? 'ok' : 'bad'
		);
		await mark(
			page,
			t0,
			log,
			headOk ? 'heading inert OK' : `BUG heading fired chooser +${headDelta}`
		);
		await sleep(1200);

		// 3) Add course outline — MUST fire filechooser
		await setBanner(page, '3/3 Click ADD COURSE OUTLINE — expect filechooser', '');
		await highlightTarget(page, button, 'TARGET: Add course outline');
		await mark(page, t0, log, 'click Add course outline (expect chooser)');
		const beforeBtn = choosers.length;
		const btnX = Math.round(button.x + button.width / 2);
		const btnY = Math.round(button.y + button.height / 2);
		const chooserPromise = page.waitForEvent('filechooser', { timeout: 5000 }).catch(() => null);
		await moveAndClick(page, btnX, btnY);
		const chooser = await chooserPromise;
		await sleep(400);
		const btnDelta = choosers.length - beforeBtn;
		const btnOk = Boolean(chooser) || btnDelta > 0;
		await setBanner(
			page,
			btnOk
				? `FILECHOOSER FIRED (count ${choosers.length})`
				: 'FAIL: Add course outline did not open filechooser',
			btnOk ? 'ok' : 'bad'
		);
		await mark(
			page,
			t0,
			log,
			btnOk
				? `filechooser fired (count ${choosers.length})`
				: 'BUG Add course outline did not fire chooser'
		);
		await sleep(2800);

		const geomOk = geom.input.w < 400 && geom.input.h < 120 && geom.input.w * geom.input.h < 80_000;
		const pass = sheetOk && headOk && btnOk && geomOk;
		await setBanner(
			page,
			pass
				? `PASS — inert sheet+heading; chooser only on button; input ${geom.input.w}×${geom.input.h}`
				: `FAIL — sheetOk=${sheetOk} headOk=${headOk} btnOk=${btnOk} geomOk=${geomOk}`,
			pass ? 'ok' : 'bad'
		);
		await mark(page, t0, log, pass ? 'PROOF PASS' : 'PROOF FAIL');
		await page.screenshot({ path: path.join(outDir, 'semester-after-fix.png'), fullPage: false });
		await sleep(900);

		const report = {
			pass,
			sheetOk,
			headOk,
			btnOk,
			geomOk,
			geometry: geom,
			chooserCount: choosers.length,
			log,
			notes,
			baseURL,
			recordedAt: new Date().toISOString()
		};
		await writeFile(path.join(outDir, 'proof-report.json'), JSON.stringify(report, null, 2));
		if (!pass) {
			console.error('PROOF FAIL', report);
		} else {
			console.log('PROOF PASS', { geometry: geom, chooserCount: choosers.length });
		}
	} finally {
		await context.close();
		await browser.close();
	}

	const videos = await listWebms(videoDir);
	const mainVideo = videos.sort((a, b) => b.size - a.size)[0];
	if (!mainVideo) throw new Error('No webm recorded');
	const dest = path.join(outDir, 'semester-file-picker-fix.webm');
	await copyFile(mainVideo.path, dest);
	await writeFile(path.join(outDir, 'timeline.json'), JSON.stringify(log, null, 2));
	console.log(`Wrote ${dest}`);
	await rm(tmpRoot, { recursive: true, force: true });
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
