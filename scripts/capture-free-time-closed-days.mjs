/**
 * Proof: free-time paint grid grays college-closed days (Labour Day 2026-09-07).
 * Usage: node scripts/capture-free-time-closed-days.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:4173
 *
 * Writes:
 *   .artifacts/verify-mariTools/free-time/closed-days-labour-day.png
 *   .artifacts/verify-mariTools/free-time/CLOSED-DAYS.md
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const baseURL = process.argv[2] || 'http://127.0.0.1:4173';
const outDir = path.join(root, '.artifacts/verify-mariTools/free-time');

/** @param {number} ms */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
	await mkdir(outDir, { recursive: true });
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
	const page = await context.newPage();
	const log = /** @type {string[]} */ ([]);
	const bugs = /** @type {string[]} */ ([]);

	try {
		await page.goto(`${baseURL}/tools/free-time`, { waitUntil: 'networkidle' });
		log.push('opened /tools/free-time');
		const stamp = Date.now();
		await page.getByLabel('Board title').fill(`Closed days ${stamp}`);
		await Promise.all([
			page.waitForURL(/\/tools\/free-time\/[^/]+/, { timeout: 30000 }),
			page.getByRole('button', { name: 'Create board' }).click()
		]);
		log.push(`created board ${page.url()}`);
		await page.locator('.paint-cell').first().waitFor({ state: 'visible' });

		const labourHeading = /Week of September 7/i;
		for (let i = 0; i < 8; i += 1) {
			const heading = await page.locator('h1').first().textContent();
			if (heading && labourHeading.test(heading)) break;
			await page.getByRole('button', { name: 'Next week' }).click();
			await sleep(200);
		}
		const heading = await page.locator('h1').first().textContent();
		if (!heading || !labourHeading.test(heading)) {
			bugs.push(`did not reach Labour Day week; heading=${heading}`);
		} else {
			log.push(`reached ${heading.trim()}`);
		}

		const noClass = await page.getByText('No class').count();
		if (noClass < 1) bugs.push('missing "No class" label on Labour Day column');
		else log.push('No class label visible');

		const monDisabled = await page.locator('.paint-cell[data-cell="Mon-09:00"]').isDisabled();
		const tueDisabled = await page.locator('.paint-cell[data-cell="Tue-09:00"]').isDisabled();
		if (!monDisabled) bugs.push('Mon 09:00 should be disabled on Labour Day');
		else log.push('Mon 09:00 disabled');
		if (tueDisabled) bugs.push('Tue 09:00 should remain paintable');
		else log.push('Tue 09:00 paintable');

		const monClass = await page.locator('.paint-cell[data-cell="Mon-09:00"]').getAttribute('class');
		if (!monClass?.includes('no-class')) bugs.push('Mon cells missing no-class class');
		else log.push('Mon cells have no-class class');

		await page.locator('.paint-cell[data-cell="Mon-09:00"]').click({ force: true });
		const pressed = await page.locator('.paint-cell[data-cell="Mon-09:00"]').getAttribute('aria-pressed');
		if (pressed === 'true') bugs.push('forced click painted Labour Day cell');
		else log.push('forced click did not paint Labour Day');

		const shot = path.join(outDir, 'closed-days-labour-day.png');
		await page.locator('.paint-wrap').screenshot({ path: shot });
		log.push(`screenshot ${shot}`);

		const notes = `# Free-time closed / out-of-term days

## Result
${bugs.length === 0 ? 'PASS' : 'FAIL'}

## Checks
${log.map((line) => `- ${line}`).join('\n')}

## Bugs
${bugs.map((b) => `- ${b}`).join('\n') || '- none'}

## Base
- ${baseURL}
- Labour Day week: 2026-09-07 (Fall 2026 \`ACADEMIC_CALENDAR_RULES\`)
`;
		await writeFile(path.join(outDir, 'CLOSED-DAYS.md'), notes);
		console.log(notes);
		if (bugs.length) process.exitCode = 1;
	} finally {
		await context.close();
		await browser.close();
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
