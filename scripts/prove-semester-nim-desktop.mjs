/**
 * Live proof: nick session uploads a real Desktop course outline on /tools/semester.
 * Usage: node scripts/prove-semester-nim-desktop.mjs [baseUrl] [pdfPath] [--visual-only]
 * Artifacts: .artifacts/verify-mariTools/semester/
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
const pdfPath =
	process.argv[3] ||
	path.join(process.env.HOME || '', 'Desktop', '420-SNT-MS_F26_Course_Outline.pdf');
const visualOnly = process.argv.includes('--visual-only');
const outDir = path.join(root, '.artifacts/verify-mariTools/semester');
const tmpRoot = path.join(outDir, '_capture-tmp-nim');
const NICK_EMAIL = 'nick.zhicheng@gmail.com';
const EXTRACT_WAIT_MS = 180_000;

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
	if (visualOnly) {
		await page.evaluate(
			(text) => {
				let hud = document.getElementById('nim-proof-hud');
				if (!hud) {
					hud = document.createElement('div');
					hud.id = 'nim-proof-hud';
					hud.setAttribute(
						'style',
						'position:fixed;left:12px;bottom:12px;z-index:99999;max-width:48ch;padding:8px 10px;background:#111c;color:#f5f5f5;font:12px/1.35 ui-monospace,monospace;border-radius:6px'
					);
					document.body.appendChild(hud);
				}
				hud.textContent = text;
			},
			`${t.toFixed(1)}s ${label}`
		);
	}
	await sleep(600);
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

async function mintNickCookie() {
	await loadEnvLocal(path.join(root, '.env.local'));
	const secret = process.env.BETTER_AUTH_SECRET;
	const databaseUrl = process.env.DATABASE_URL;
	if (!secret || !databaseUrl) throw new Error('BETTER_AUTH_SECRET or DATABASE_URL missing');

	const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
	try {
		const user = await pool.query('select id from "user" where email = $1 limit 1', [NICK_EMAIL]);
		if (!user.rows[0]) throw new Error(`${NICK_EMAIL} not in user table`);
		const profile = await pool.query(
			`select nim_disclosure_accepted_at is not null as nim
			 from mt_student_profiles where user_id = $1`,
			[user.rows[0].id]
		);
		if (!profile.rows[0]?.nim) throw new Error(`${NICK_EMAIL} missing NIM disclosure`);

		const token = `proofNim${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
		const id = `proofNimSess${Date.now().toString(36)}`;
		await pool.query(
			`insert into session (id, token, user_id, expires_at, created_at, updated_at)
			 values ($1, $2, $3, now() + interval '7 days', now(), now())`,
			[id, token, user.rows[0].id]
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
	} finally {
		await pool.end();
	}
}

async function confirmSsrNim() {
	await loadEnvLocal(path.join(root, '.env.local'));
	const key = String(process.env.NVIDIA_NIM_API_KEY ?? '').trim();
	const model = process.env.NVIDIA_NIM_MODEL || 'qwen/qwen3.5-122b-a10b';
	const health = await fetch(`${baseURL}/tools/semester`);
	return {
		semesterHttp: health.status,
		keyPresent: key.length > 10,
		model,
		pdfPath
	};
}

async function main() {
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(tmpRoot, { recursive: true });
	await mkdir(outDir, { recursive: true });

	const ssr = await confirmSsrNim();
	if (ssr.semesterHttp !== 200) throw new Error(`semester HTTP ${ssr.semesterHttp}`);
	if (!ssr.keyPresent) throw new Error('NVIDIA_NIM_API_KEY missing from .env.local');

	const cookie = await mintNickCookie();
	const videoDir = path.join(tmpRoot, 'video');
	await mkdir(videoDir, { recursive: true });

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 800 },
		recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
		baseURL
	});
	await context.addCookies([cookie]);
	const page = await context.newPage();
	const log = /** @type {Array<{t:number,label:string}>} */ ([]);
	const bugs = /** @type {string[]} */ ([]);
	const t0 = Date.now();
	/** @type {Record<string, unknown>} */
	let outcome = {
		ssr,
		httpStatus: null,
		extractionOk: null,
		reason: null,
		assessmentRows: 0,
		assessmentsFilled: 0,
		sampleTitles: []
	};

	page.on('response', (res) => {
		if (res.url().includes('/tools/semester') && res.request().method() === 'POST') {
			outcome.httpStatus = res.status();
			console.log(`  POST ${res.status()} ${res.url()}`);
		}
	});
	page.on('pageerror', (error) => console.log(`  page error: ${error.message}`));
	page.on('requestfailed', (request) => {
		if (request.url().includes('/tools/semester')) {
			console.log(`  POST request failed: ${request.failure()?.errorText ?? 'unknown'}`);
		}
	});
	if (visualOnly) {
		await page.route('**/tools/semester**', async (route) => {
			if (route.request().method() === 'POST') await sleep(3200);
			await route.continue();
		});
	}

	try {
		await page.goto('/tools/semester', { waitUntil: 'networkidle' });
		await page.exposeFunction('__nimProcessingSeen', () => {
			outcome.sawProcessingUi = true;
		});
		await page.evaluate(() => {
			const observer = new MutationObserver(() => {
				if (/Extracting your outline/i.test(document.body.innerText)) {
					observer.disconnect();
					/** @type {any} */ (window).__nimProcessingSeen?.();
				}
			});
			observer.observe(document.body, { childList: true, subtree: true, characterData: true });
		});
		await mark(page, t0, log, 'nick session on /tools/semester');
		await page.screenshot({ path: path.join(outDir, 'nim-zero-state.png'), fullPage: false });
		await sleep(1400);
		const addOutline = page.getByRole('button', { name: 'Add outline PDF' });
		if ((await addOutline.count()) < 1) {
			bugs.push('upload control missing for nick');
			await page.screenshot({ path: path.join(outDir, 'nim-fail-gated.png'), fullPage: false });
		} else {
			const extractButton = page.getByRole('button', { name: 'Extract outline' });
			if ((await extractButton.count()) > 0) {
				bugs.push('legacy Extract outline button still present (must be one-control auto-submit)');
			}
			if ((await page.getByText('No file selected').count()) > 0) {
				bugs.push('visible No file selected chrome still present');
			}
			await addOutline.click();
			const pickerHeading = page.getByRole('heading', { name: 'Choose outline PDF' });
			const upload = page.getByLabel('Choose outline PDF');
			await pickerHeading.waitFor({ state: 'visible' });
			await upload.waitFor({ state: 'visible' });
			outcome.sawPickerUi = true;
			await page.screenshot({ path: path.join(outDir, 'nim-picker-open.png'), fullPage: false });
			await mark(page, t0, log, 'visible in-page file picker open');
			await sleep(1200);
			await mark(page, t0, log, `choosing ${path.basename(pdfPath)} (auto-submit)`);
			const extractDone = page
				.locator('input[name="courseCode"]')
				.waitFor({ state: 'visible', timeout: EXTRACT_WAIT_MS });
			const chooserPromise = page.waitForEvent('filechooser');
			await upload.click();
			const chooser = await chooserPromise;
			await chooser.setFiles(pdfPath);
			const pickedState = page.getByRole('status').filter({ hasText: 'PDF selected' });
			await pickedState.waitFor({ state: 'visible', timeout: 1000 });
			outcome.sawPickedUi = true;
			await page.screenshot({ path: path.join(outDir, 'nim-picked-state.png'), fullPage: false });
			await mark(page, t0, log, 'in-page file selection visible');

			// Capture real product processing chrome (not only the proof HUD).
			let sawProcessing = false;
			let sawStaleEmpty = false;
			const processingDeadline = Date.now() + Math.min(EXTRACT_WAIT_MS, 90_000);
			while (Date.now() < processingDeadline) {
				const bodyMid = await page
					.locator('body')
					.innerText()
					.catch(() => '');
				if (outcome.sawProcessingUi === true) sawProcessing = true;
				if (/Extracting your outline/i.test(bodyMid)) {
					sawProcessing = true;
					if (/No file selected|Choose a PDF to upload/i.test(bodyMid)) {
						sawStaleEmpty = true;
					}
					await mark(page, t0, log, 'product processing view visible');
					await page.screenshot({
						path: path.join(outDir, 'nim-processing.png'),
						fullPage: false
					});
					break;
				}
				if (
					page.url().includes('?/extract') &&
					(await page.locator('input[name="courseCode"]').count()) > 0
				) {
					break;
				}
				await sleep(400);
			}
			outcome.sawProcessingUi = sawProcessing;
			if (!sawProcessing) bugs.push('product processing view never appeared on camera');
			if (sawStaleEmpty) bugs.push('stale empty upload chrome still visible during extract');

			await extractDone;
			await mark(page, t0, log, 'extract action returned review UI');

			const body = await page.locator('body').innerText();
			const missingKey = /Automatic extraction is unavailable/i.test(body);
			const failedClosed = /We could not extract this outline automatically/i.test(body);
			const cacheHit = /Used a saved extraction for this file/i.test(body);
			outcome.cacheHit = cacheHit;
			outcome.extractionOk = !missingKey && !failedClosed;
			outcome.reason = missingKey
				? 'missing-key'
				: failedClosed
					? 'failed-closed'
					: cacheHit
						? 'cache-hit'
						: 'ok';
			if (outcome.httpStatus === 500) bugs.push('extract returned HTTP 500');
			if (missingKey) bugs.push('SSR missing NIM key');

			const courseCode = page.locator('input[name="courseCode"]');
			const titleInput = page.locator('input[name="title"]');
			const sectionInput = page.locator('input[name="section"]');
			const teacherInput = page.locator('input[name="teacherName"]');
			const identity = {
				courseCode: String((await courseCode.inputValue().catch(() => '')) ?? '').trim(),
				title: String((await titleInput.inputValue().catch(() => '')) ?? '').trim(),
				section: String((await sectionInput.inputValue().catch(() => '')) ?? '').trim(),
				teacher: String((await teacherInput.inputValue().catch(() => '')) ?? '').trim()
			};
			outcome.identity = identity;
			const identityFilled = Object.values(identity).filter(Boolean).length;
			outcome.identityFilled = identityFilled;
			const expectedIdentity = {
				courseCode: '420-SNT-MS',
				title: 'Object-Oriented Programming',
				section: '01',
				teacher: 'Robert Vincent'
			};
			if (JSON.stringify(identity) !== JSON.stringify(expectedIdentity)) {
				bugs.push(`NIM identity mismatch: ${JSON.stringify(identity)}`);
			}

			const titles = page.locator('.review-row input[aria-label="Assessment"]');
			const weights = page.locator('.review-row input[aria-label="Weight"]');
			const dates = page.locator('.review-row input[aria-label="Date"]');
			const rowCount = await titles.count();
			outcome.assessmentRows = rowCount;
			const sampleTitles = [];
			let filled = 0;
			for (let i = 0; i < rowCount; i += 1) {
				const title = String((await titles.nth(i).inputValue()) ?? '').trim();
				const weight = String((await weights.nth(i).inputValue()) ?? '').trim();
				const date = String((await dates.nth(i).inputValue()) ?? '').trim();
				if (title) {
					filled += 1;
					sampleTitles.push({ title, weight, date });
				}
			}
			outcome.assessmentsFilled = filled;
			outcome.sampleTitles = sampleTitles.slice(0, 5);
			if (rowCount !== 5 || filled !== 5) {
				bugs.push(
					`NIM assessment row mismatch: ${filled} filled of ${rowCount} rows (need 5 of 5)`
				);
			}

			if (filled < 1 && outcome.extractionOk) {
				bugs.push('extraction ok but assessment title fields empty');
			}
			const coreIdentity = Boolean(identity.courseCode && identity.title && identity.teacher);
			if (!coreIdentity && outcome.extractionOk) {
				bugs.push(
					`course identity incomplete: ${identityFilled}/4 (need code+title+teacher; section=${identity.section || '∅ — often absent from Science outlines'})`
				);
			} else if (!identity.section && outcome.extractionOk) {
				await mark(
					page,
					t0,
					log,
					'section absent from outline (3/4 identity — dates still required)'
				);
			}
			if (failedClosed) {
				await mark(page, t0, log, 'graceful failure (no 500) — manual fields shown');
			} else {
				await mark(
					page,
					t0,
					log,
					`identity ${identityFilled}/4, assessments ${filled} of ${rowCount}`
				);
			}

			// Live extract must fill every visible fact from the outline — never Playwright-fill.
			await sleep(1200);
			let dueFilled = 0;
			let weightsFilled = 0;
			for (let i = 0; i < rowCount; i += 1) {
				const date = String((await dates.nth(i).inputValue()) ?? '').trim();
				const weight = String((await weights.nth(i).inputValue()) ?? '').trim();
				if (date && date !== 'YYYY-MM-DD') dueFilled += 1;
				if (weight) weightsFilled += 1;
			}
			outcome.assessmentDueFilled = dueFilled;
			outcome.assessmentWeightsFilled = weightsFilled;
			if (dueFilled !== rowCount || weightsFilled !== rowCount) {
				bugs.push(
					`live extract left assessment facts incomplete (due ${dueFilled}/${rowCount}; weights ${weightsFilled}/${rowCount})`
				);
			} else {
				await mark(
					page,
					t0,
					log,
					`${visualOnly ? 'share-ready review' : 'share-ready from live extract'} (${dueFilled}/${rowCount} due, ${weightsFilled}/${rowCount} weights)`
				);
			}
			outcome.shareReady =
				rowCount > 0 &&
				dueFilled === rowCount &&
				weightsFilled === rowCount &&
				filled === rowCount &&
				coreIdentity;
			if (cacheHit && !visualOnly) {
				bugs.push('cache-hit on camera — need live extract filling identity+dates');
			}

			await page.screenshot({
				path: path.join(outDir, 'nim-desktop-extract.png'),
				fullPage: false
			});
			await sleep(1000);
			if (rowCount > 0) {
				await titles.nth(rowCount - 1).scrollIntoViewIfNeeded();
				await mark(page, t0, log, 'all extracted assessment rows visible');
				await page.screenshot({
					path: path.join(outDir, 'nim-desktop-assessments.png'),
					fullPage: false
				});
			}
			await sleep(1000);
		}
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
	const dest = path.join(outDir, 'nim-desktop-extract.webm');
	await copyFile(mainVideo, dest);

	const pass =
		bugs.length === 0 &&
		outcome.extractionOk === true &&
		Number(outcome.assessmentsFilled) > 0 &&
		Number(outcome.identityFilled) >= 3 &&
		outcome.sawProcessingUi === true &&
		outcome.sawPickerUi === true &&
		outcome.sawPickedUi === true &&
		outcome.shareReady === true &&
		outcome.httpStatus !== 500;

	const report = {
		pass,
		mode: visualOnly ? 'visual-only' : 'live-extraction',
		continuousOneTake: true,
		pickerMechanism: 'visible in-page native file input clicked on camera',
		proofOverlay: visualOnly,
		sawPickerUi: outcome.sawPickerUi,
		sawPickedUi: outcome.sawPickedUi,
		model: ssr.model,
		assessmentsFilled: outcome.assessmentsFilled,
		assessmentRows: outcome.assessmentRows,
		extractionOk: outcome.extractionOk,
		reason: outcome.reason,
		cacheHit: outcome.cacheHit,
		identity: outcome.identity,
		assessmentDueFilled: outcome.assessmentDueFilled,
		assessmentWeightsFilled: outcome.assessmentWeightsFilled,
		httpStatus: outcome.httpStatus,
		video: dest,
		screenshot: path.join(outDir, 'nim-desktop-extract.png'),
		pdf: path.basename(pdfPath),
		sampleTitles: outcome.sampleTitles,
		bugs,
		moments: log,
		ssr
	};
	await writeFile(
		path.join(outDir, 'nim-desktop-report.json'),
		JSON.stringify(report, null, 2),
		'utf8'
	);
	const notes = `# Semester NIM Desktop outline proof

Result: ${pass ? 'PASS' : 'FAIL'}
Model: \`${ssr.model}\`
PDF: \`${path.basename(pdfPath)}\`
Assessments filled: ${outcome.assessmentsFilled} / ${outcome.assessmentRows}
Extraction: ${outcome.reason}
HTTP (POST): ${outcome.httpStatus}
Video: \`${path.relative(root, dest)}\`

## Bugs
${bugs.map((b) => `- ${b}`).join('\n') || '- none'}

## Sample titles
${(report.sampleTitles || []).map((r) => `- ${r.title} (weight=${r.weight}, date=${r.date})`).join('\n') || '- none'}

## Moments
${log.map((e) => `- **${e.t.toFixed(2)}s** ${e.label}`).join('\n')}
`;
	await writeFile(path.join(outDir, 'nim-desktop-NOTES.md'), notes, 'utf8');
	await rm(tmpRoot, { recursive: true, force: true });
	console.log(notes);
	if (!pass) process.exitCode = 1;
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
