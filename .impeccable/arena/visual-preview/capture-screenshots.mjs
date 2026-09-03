#!/usr/bin/env node
/**
 * Capture MariTools visual arena screenshots for critique + iteration.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(
	process.env.ARENA_VISUAL_ROOT ||
		'/Users/sony0627/Programming/mariprogramming/.impeccable/arena/visual-preview'
);
const OUT = path.join(ROOT, 'screenshots');
const ROUND = process.env.ARENA_ROUND || 'round-1';

const candidates = ['candidate-1', 'candidate-2', 'candidate-3', 'candidate-4'];
const pages = [
	{ id: 'schedule', select: 'schedule' },
	{ id: 'catalog', select: 'catalog' },
	{ id: 'forum', select: 'forum' }
];

async function setPage(page, value) {
	const picker = page.locator('#page-picker, #page-select');
	if (await picker.count() > 0) {
		await picker.first().selectOption(value);
		await page.waitForTimeout(400);
		return;
	}
	const nav = page.locator(`nav a[data-nav="${value}"], nav a[data-page-link="${value}"], [data-nav="${value}"]`).first();
	if (await nav.count() > 0) {
		await nav.click();
		await page.waitForTimeout(400);
	}
}

async function main() {
	await mkdir(path.join(OUT, ROUND), { recursive: true });
	const browser = await chromium.launch();

	for (const c of candidates) {
		const dir = path.join(ROOT, c);
		const file = path.join(dir, 'index.html');
		if (!existsSync(file)) {
			console.log('skip', c, 'no index.html');
			continue;
		}
		const url = `file://${file}`;

		for (const viewport of [
			{ name: 'desktop', width: 1440, height: 900 },
			{ name: 'mobile', width: 390, height: 844 }
		]) {
			const context = await browser.newContext({
				viewport: { width: viewport.width, height: viewport.height }
			});
			const page = await context.newPage();
			try {
				await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
				for (const p of pages) {
					await setPage(page, p.select);
					const shot = path.join(OUT, ROUND, `${c}-${p.id}-${viewport.name}.png`);
					await page.screenshot({ path: shot, fullPage: false });
					console.log('ok', shot);
				}
			} catch (e) {
				console.error('fail', c, viewport.name, e.message);
			}
			await context.close();
		}
	}

	await browser.close();
}

main();
