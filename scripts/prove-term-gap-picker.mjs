/**
 * Term-gap fail-safe proof. Forces asOf=2027-01-05, asserts unavailable status,
 * then pins Fall 2026 and checks schedule export no longer asks to choose a term.
 *
 * Usage: node scripts/prove-term-gap-picker.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:5173
 *
 * Fail conditions:
 * - Gap date does not show "Current-term data is unavailable."
 * - Selecting Fall 2026 does not show "Showing Fall 2026."
 * - Export still says "Choose a term" after the pin
 */
import { chromium } from '@playwright/test';
import { copyFile, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANONICAL_OMNIVOX_SCHEDULE } from '../src/lib/maritools/schedule/fixture.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const baseURL = process.argv[2] || 'http://127.0.0.1:5173';
const outDir = path.join(root, '.artifacts/verify-mariTools/term-gap-picker');
const tmpRoot = path.join(root, '.artifacts/verify-mariTools/_capture-tmp-term-gap');
const VIDEO_NAME = 'term-gap-picker.webm';
const GAP = '2027-01-05';

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} t0
 * @param {Array<{t:number,label:string}>} log
 * @param {string} label
 * @param {number} [dwellMs]
 */
async function mark(page, t0, log, label, dwellMs = 700) {
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
	await sleep(dwellMs);
}

async function main() {
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(tmpRoot, { recursive: true });
	await mkdir(outDir, { recursive: true });

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		recordVideo: { dir: tmpRoot, size: { width: 1280, height: 720 } },
		viewport: { width: 1280, height: 720 }
	});
	await context.addInitScript(() => {
		localStorage.setItem('maritools.omnivox-tutorial.dismissed', '1');
	});
	const page = await context.newPage();
	const t0 = Date.now();
	/** @type {Array<{t:number,label:string}>} */
	const log = [];
	/** @type {string[]} */
	const failures = [];

	try {
		const gapUrl = `${baseURL}/tools/schedule?asOf=${GAP}`;
		await page.goto(gapUrl, { waitUntil: 'networkidle' });
		await mark(page, t0, log, `opened schedule asOf=${GAP}`);

		const status = page.getByRole('status');
		const unavailable = await status
			.filter({ hasText: 'Current-term data is unavailable.' })
			.count();
		if (unavailable < 1) {
			failures.push('gap date did not show Current-term data is unavailable.');
		} else {
			await mark(page, t0, log, 'gap status visible');
		}

		const term = page.getByLabel('Term');
		await term.selectOption('fall-2026');
		await mark(page, t0, log, 'selected Fall 2026');

		const showing = await status.filter({ hasText: 'Showing Fall 2026.' }).count();
		if (showing < 1) {
			failures.push('Fall 2026 pin did not show Showing Fall 2026.');
		} else {
			await mark(page, t0, log, 'Fall 2026 status visible');
		}

		await page.getByRole('button', { name: 'Import Omnivox' }).first().click();
		await page.getByLabel('Omnivox course list').fill(CANONICAL_OMNIVOX_SCHEDULE);
		await page.getByRole('button', { name: 'Read schedule' }).click();
		await mark(page, t0, log, 'parsed canonical schedule');

		await page.getByRole('button', { name: 'Add to Google Calendar' }).click();
		await mark(page, t0, log, 'opened export');

		const chooseTerm = await page
			.getByText('Choose a term before downloading a calendar.')
			.count();
		if (chooseTerm > 0) {
			failures.push('export still asked to choose a term after Fall 2026 pin');
		} else {
			await mark(page, t0, log, 'export did not demand a term');
		}

		await sleep(500);
	} finally {
		await context.close();
		await browser.close();
	}

	const videos = (await readdir(tmpRoot)).filter((name) => name.endsWith('.webm'));
	if (videos.length === 0) {
		failures.push('no video recorded');
	} else {
		const src = path.join(tmpRoot, videos[0]);
		const dest = path.join(outDir, VIDEO_NAME);
		await copyFile(src, dest);
		const info = await stat(dest);
		console.log(`video: ${dest} (${info.size} bytes)`);
	}

	const report = {
		baseURL,
		asOf: GAP,
		failures,
		log,
		ok: failures.length === 0
	};
	await writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
	await rm(tmpRoot, { recursive: true, force: true });

	if (failures.length) {
		console.error('FAIL', failures);
		process.exit(1);
	}
	console.log('PASS term-gap picker proof');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
