#!/usr/bin/env node
/**
 * Prove MariTools Google Calendar Connect + push (post Console redirect gate).
 *
 * Prefers an existing Chrome with remote debugging (GCAL_CDP_URL, default
 * http://127.0.0.1:9337) so Google sessions stay intact. Falls back to a
 * persistent profile copy only when CDP is down.
 *
 * Usage:
 *   GCAL_CDP_URL=http://127.0.0.1:9337 node scripts/prove-google-calendar-connect.mjs [baseUrl]
 */
import { chromium } from '@playwright/test';
import { makeSignature } from 'better-auth/crypto';
import { spawn } from 'node:child_process';
import { copyFile, cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { generateOccurrences } from '../src/lib/maritools/schedule/occurrences.js';
import { parseOmnivox } from '../src/lib/maritools/schedule/parseOmnivox.js';
import { ACADEMIC_TERMS, rulesForTerm } from '../src/lib/maritools/term/calendar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const baseURL = (process.argv[2] || 'http://127.0.0.1:5174').replace(/\/$/, '');
const outDir = path.join(root, '.artifacts/verify-mariTools/google-calendar-connect');
const tmpRoot = path.join(root, '.artifacts/verify-mariTools/_capture-tmp-gcal');
const NICK_EMAIL = 'nick.zhicheng@gmail.com';
const TEAM_EMAIL = 'team@marihacks.com';
const CDP_URL = process.env.GCAL_CDP_URL || 'http://127.0.0.1:9337';
const SOURCE_PROFILE_CANDIDATES = [
	'/tmp/cursor-console-chrome3',
	path.join(outDir, 'chrome-user-data')
];

const MONDAY_PROOF_SCHEDULE = `1  \tBadminton and Conditioning
PHE-103-A1 sec.00002, teacher: Alexandre Vachon-Gee
Mon 08:15 - 10:05, classroom GYM
`;

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
	await page
		.evaluate((text) => {
			let hud = document.getElementById('verify-hud');
			if (!hud) {
				hud = document.createElement('div');
				hud.id = 'verify-hud';
				hud.setAttribute(
					'style',
					[
						'position:fixed',
						'left:12px',
						'bottom:12px',
						'z-index:2147483647',
						'max-width:70vw',
						'padding:8px 10px',
						'border-radius:8px',
						'background:rgba(10,16,28,0.88)',
						'color:#f4f7fb',
						'font:600 13px/1.35 ui-sans-serif,system-ui,sans-serif',
						'pointer-events:none'
					].join(';')
				);
				document.documentElement.appendChild(hud);
			}
			hud.textContent = text;
		}, label)
		.catch(() => {});
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

async function mintNickSessionCookie() {
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
		const token = `proofGcal${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
		const id = `proofGcalSess${Date.now().toString(36)}`;
		await pool.query(
			`insert into session (id, token, user_id, expires_at, created_at, updated_at)
			 values ($1, $2, $3, now() + interval '7 days', now(), now())`,
			[id, token, userId]
		);
		const signed = `${token}.${await makeSignature(token, secret)}`;
		return {
			userId,
			cookie: {
				name: 'mari-staff.session_token',
				value: signed,
				domain: '127.0.0.1',
				path: '/',
				httpOnly: true,
				secure: false,
				sameSite: 'Lax'
			}
		};
	} finally {
		await pool.end();
	}
}

/** @param {string} userId */
async function readGrant(userId) {
	const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
	try {
		const g = await pool.query(
			`select refresh_token is not null as has_refresh,
			        access_token is not null as has_access,
			        access_token
			 from mt_google_calendar_grants where user_id = $1`,
			[userId]
		);
		return g.rows[0] ?? null;
	} finally {
		await pool.end();
	}
}

/**
 * @param {string} accessToken
 * @param {string} timeMin
 * @param {string} timeMax
 */
async function listPrimaryEvents(accessToken, timeMin, timeMax) {
	const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
	url.searchParams.set('timeMin', timeMin);
	url.searchParams.set('timeMax', timeMax);
	url.searchParams.set('singleEvents', 'true');
	url.searchParams.set('orderBy', 'startTime');
	url.searchParams.set('maxResults', '50');
	url.searchParams.set('q', 'Badminton');
	const response = await fetch(url, {
		headers: { authorization: `Bearer ${accessToken}` }
	});
	const body = await response.text();
	if (!response.ok) {
		throw new Error(`Calendar list failed (${response.status}): ${body.slice(0, 200)}`);
	}
	return JSON.parse(body);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} framesDir
 */
async function startScreencast(page, framesDir) {
	await mkdir(framesDir, { recursive: true });
	const client = await page.context().newCDPSession(page);
	let frameIndex = 0;
	client.on('Page.screencastFrame', async (frame) => {
		const idx = frameIndex++;
		const file = path.join(framesDir, `frame-${String(idx).padStart(5, '0')}.jpg`);
		await writeFile(file, Buffer.from(frame.data, 'base64')).catch(() => {});
		await client.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
	});
	await client.send('Page.startScreencast', {
		format: 'jpeg',
		quality: 70,
		maxWidth: 1280,
		maxHeight: 800,
		everyNthFrame: 2
	});
	return {
		stop: async () => {
			await client.send('Page.stopScreencast').catch(() => {});
			return frameIndex;
		}
	};
}

/** @param {string} framesDir @param {string} dest @param {number} wallSeconds */
async function encodeWebm(framesDir, dest, wallSeconds) {
	const frames = (await readdir(framesDir)).filter((n) => n.endsWith('.jpg')).sort();
	if (frames.length === 0) throw new Error('no screencast frames');
	const fps = Math.max(1, Math.min(30, frames.length / Math.max(wallSeconds, 1)));
	await new Promise((resolve, reject) => {
		const ff = spawn(
			'ffmpeg',
			[
				'-y',
				'-framerate',
				String(fps.toFixed(3)),
				'-i',
				path.join(framesDir, 'frame-%05d.jpg'),
				'-c:v',
				'libvpx',
				'-b:v',
				'1.5M',
				'-pix_fmt',
				'yuv420p',
				dest
			],
			{ stdio: ['ignore', 'ignore', 'pipe'] }
		);
		let err = '';
		ff.stderr.on('data', (chunk) => {
			err += String(chunk);
		});
		ff.on('close', (code) => {
			if (code === 0) resolve(undefined);
			else reject(new Error(`ffmpeg exit ${code}: ${err.slice(-400)}`));
		});
	});
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} t0
 * @param {Array<{t:number,label:string}>} log
 * @param {string[]} bugs
 */
async function completeGoogleConsent(page, t0, log, bugs) {
	const deadline = Date.now() + 120_000;
	while (Date.now() < deadline) {
		const url = page.url();
		if (/gcal=connected/i.test(url)) {
			await mark(page, t0, log, `gcal=connected: ${url}`);
			return;
		}
		if (/\/tools\/schedule/i.test(url) && !/accounts\.google/i.test(url) && !/gcal=error/i.test(url)) {
			await mark(page, t0, log, `back on schedule: ${url}`);
			return;
		}
		if (/gcal=error/i.test(url) || /redirect_uri_mismatch/i.test(url) || /signin\/oauth\/error/i.test(url)) {
			bugs.push(`OAuth error surface: ${url}`);
			await page.screenshot({ path: path.join(outDir, 'oauth-mismatch.png'), fullPage: true });
			return;
		}

		// Primary actions first. Never click the email text on consent/id screens.
		const continueBtn = page.getByRole('button', {
			name: /^(Continue|Allow|Confirm|Accept|Yes|I understand)/i
		});
		if (await continueBtn.count()) {
			await continueBtn.first().click();
			await mark(page, t0, log, 'clicked Google consent continue/allow');
			await sleep(1500);
			continue;
		}

		if (/accountchooser/i.test(url)) {
			const nickRow = page.locator(
				`[data-identifier="${NICK_EMAIL}"], [data-email="${NICK_EMAIL}"]`
			);
			const teamRow = page.locator(
				`[data-identifier="${TEAM_EMAIL}"], [data-email="${TEAM_EMAIL}"]`
			);
			if (await nickRow.count()) {
				await nickRow.first().click();
				await mark(page, t0, log, 'chose nick on accountchooser');
				await sleep(1500);
				continue;
			}
			if (await teamRow.count()) {
				await teamRow.first().click();
				await mark(page, t0, log, 'chose team on accountchooser');
				await sleep(1500);
				continue;
			}
		}

		const emailInput = page.locator('input[type="email"], input[name="identifier"]').first();
		if (await emailInput.count()) {
			const value = await emailInput.inputValue().catch(() => '');
			if (!value) {
				await emailInput.fill(NICK_EMAIL);
				await mark(page, t0, log, `filled identifier ${NICK_EMAIL}`);
				await sleep(400);
			}
			const nextBtn = page.getByRole('button', { name: /^Next$/i });
			if (await nextBtn.count()) {
				await nextBtn.first().click();
				await mark(page, t0, log, 'clicked Next after email');
				await sleep(1500);
				continue;
			}
		}

		await sleep(900);
	}
	bugs.push(`OAuth consent timed out at ${page.url()}`);
	await page.screenshot({ path: path.join(outDir, 'oauth-timeout.png'), fullPage: true });
}

async function cdpAvailable() {
	try {
		const res = await fetch(`${CDP_URL}/json/version`);
		return res.ok;
	} catch {
		return false;
	}
}

async function main() {
	await loadEnvLocal(path.join(root, '.env.local'));
	await rm(tmpRoot, { recursive: true, force: true });
	await mkdir(tmpRoot, { recursive: true });
	await mkdir(outDir, { recursive: true });

	const probe = await fetch(`${baseURL}/tools/schedule`).catch(() => null);
	if (!probe?.ok) throw new Error(`Dev server not ready at ${baseURL}/tools/schedule`);

	const { userId, cookie } = await mintNickSessionCookie();
	/** @type {string[]} */
	const bugs = [];
	/** @type {Array<{t:number,label:string}>} */
	const log = [];
	const t0 = Date.now();

	const fall = ACADEMIC_TERMS.find((term) => term.id === 'fall-2026');
	const rules = rulesForTerm('fall-2026');
	if (!fall || !rules) throw new Error('Fall 2026 calendar missing');
	const expectedOcc = generateOccurrences(
		fall,
		rules,
		parseOmnivox(MONDAY_PROOF_SCHEDULE).courses
	);
	const expectedSep8 = expectedOcc.filter((o) => o.date === '2026-09-08').length;
	const expectedSep7 = expectedOcc.filter((o) => o.date === '2026-09-07').length;
	if (expectedSep8 < 1 || expectedSep7 !== 0) {
		bugs.push(`fixture dates wrong sep8=${expectedSep8} sep7=${expectedSep7}`);
	}

	const preferCdp = process.env.GCAL_FORCE_PROFILE !== '1' && (await cdpAvailable());
	/** @type {import('@playwright/test').Browser | null} */
	let browser = null;
	/** @type {import('@playwright/test').BrowserContext} */
	let context;
	/** @type {string} */
	let launchMode;
	/** @type {boolean} */
	let useCdp = false;

	if (preferCdp) {
		try {
			launchMode = `cdp:${CDP_URL}`;
			browser = await chromium.connectOverCDP(CDP_URL, { timeout: 12_000 });
			context = browser.contexts()[0];
			if (!context) throw new Error('CDP browser has no context');
			useCdp = true;
		} catch (error) {
			console.warn(
				`CDP connect failed (${error instanceof Error ? error.message : String(error)}); falling back to profile copy`
			);
			browser = null;
		}
	}

	if (!useCdp) {
		launchMode = 'persistent-profile-copy';
		let profileSource = '';
		for (const candidate of SOURCE_PROFILE_CANDIDATES) {
			try {
				await stat(path.join(candidate, 'Default'));
				profileSource = candidate;
				break;
			} catch {
				/* next */
			}
		}
		if (!profileSource) throw new Error('No Chrome profile and CDP unavailable');
		const profileDir = path.join(tmpRoot, 'chrome-profile');
		await cp(profileSource, profileDir, { recursive: true, force: true });
		for (const lockName of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
			await rm(path.join(profileDir, lockName), { force: true }).catch(() => {});
		}
		const videoDir = path.join(tmpRoot, 'video');
		await mkdir(videoDir, { recursive: true });
		context = await chromium.launchPersistentContext(profileDir, {
			channel: 'chrome',
			headless: false,
			viewport: { width: 1280, height: 800 },
			recordVideo: { dir: videoDir, size: { width: 1280, height: 800 } },
			args: ['--disable-blink-features=AutomationControlled']
		});
	}

	await context.addCookies([cookie]);
	const page = await context.newPage();
	page.setDefaultTimeout(25000);

	const framesDir = path.join(tmpRoot, 'frames');
	const screencast = useCdp ? await startScreencast(page, framesDir) : null;

	try {
		await page.goto(`${baseURL}/tools/schedule`, { waitUntil: 'domcontentloaded' });
		await page.evaluate(() => localStorage.setItem('maritools.omnivox-tutorial.dismissed', '1'));
		await page.reload({ waitUntil: 'networkidle' });
		await mark(page, t0, log, `signed-in schedule via ${launchMode}`);

		await page.getByRole('button', { name: 'Import Omnivox' }).first().click();
		await page.getByLabel('Omnivox course list').fill(MONDAY_PROOF_SCHEDULE);
		await page.getByRole('button', { name: 'Read schedule' }).click();
		await page.getByLabel('Weekly course schedule').waitFor({ state: 'visible' });
		await mark(page, t0, log, 'parsed Monday-only Fall schedule');

		await page.getByRole('button', { name: 'Add to Google Calendar' }).click();
		await page.locator('.calendar-modal').waitFor({ state: 'visible' });
		await mark(page, t0, log, 'opened calendar export modal');

		const modalBefore = await page.locator('.calendar-modal').innerText();
		if (/Connect Google Calendar/i.test(modalBefore)) {
			const connectNav = page.waitForURL(
				/(accounts\.google\.com|gcal=connected|gcal=error|redirect_uri_mismatch)/i,
				{ timeout: 45000 }
			);
			await page.getByRole('link', { name: 'Connect Google Calendar' }).click();
			await connectNav.catch(() => {});
			const oauthUrl = page.url();
			await mark(page, t0, log, `after Connect → ${oauthUrl.slice(0, 160)}`);
			if (/redirect_uri_mismatch/i.test(oauthUrl) || /signin\/oauth\/error/i.test(oauthUrl)) {
				bugs.push(`redirect_uri_mismatch or OAuth error: ${oauthUrl}`);
			} else {
				await completeGoogleConsent(page, t0, log, bugs);
			}
		} else if (/Push to Google Calendar/i.test(modalBefore)) {
			await mark(page, t0, log, 'already connected (grant present)');
		} else {
			bugs.push('Connect Google Calendar CTA missing');
		}

		await page.waitForURL(/\/tools\/schedule/i, { timeout: 20000 }).catch(() => {});
		if (/gcal=error/i.test(page.url())) bugs.push(`connect callback error: ${page.url()}`);

		const grant = await readGrant(userId);
		if (!grant?.has_refresh) {
			bugs.push('mt_google_calendar_grants missing refresh token after Connect');
		} else {
			await mark(page, t0, log, 'grant persisted (refresh token present)');
		}

		await page.goto(`${baseURL}/tools/schedule`, { waitUntil: 'networkidle' });
		await page.evaluate(() => localStorage.setItem('maritools.omnivox-tutorial.dismissed', '1'));
		await page.getByRole('button', { name: 'Import Omnivox' }).first().click();
		await page.getByLabel('Omnivox course list').fill(MONDAY_PROOF_SCHEDULE);
		await page.getByRole('button', { name: 'Read schedule' }).click();
		await page.getByLabel('Weekly course schedule').waitFor({ state: 'visible' });
		await page.getByRole('button', { name: 'Add to Google Calendar' }).click();
		await page.locator('.calendar-modal').waitFor({ state: 'visible' });
		const modalAfter = await page.locator('.calendar-modal').innerText();
		if (!/Push to Google Calendar/i.test(modalAfter)) {
			bugs.push('Push to Google Calendar missing after Connect');
			await page.screenshot({ path: path.join(outDir, 'no-push-cta.png'), fullPage: true });
		} else {
			await mark(page, t0, log, 'Push CTA visible after Connect', 1500);
			const pushResponsePromise = page.waitForResponse(
				(res) => {
					const req = res.request();
					if (req.method() !== 'POST') return false;
					const u = res.url();
					return (
						u.includes('/tools/schedule') &&
						(u.includes('pushGoogleCalendar') ||
							Boolean(req.postData()?.includes('pushGoogleCalendar')) ||
							Boolean(req.postData()?.includes('termId')))
					);
				},
				{ timeout: 120_000 }
			);
			const pushBtn = page.getByRole('button', { name: 'Push to Google Calendar' });
			await pushBtn.scrollIntoViewIfNeeded();
			await mark(page, t0, log, 'about to click Push to Google Calendar', 1800);
			await pushBtn.click();
			await mark(page, t0, log, 'clicked Push to Google Calendar', 1200);
			const pushResponse = await pushResponsePromise.catch(() => null);
			if (pushResponse) {
				const pushBody = await pushResponse.text().catch(() => '');
				await mark(page, t0, log, `push HTTP ${pushResponse.status()} body=${pushBody.slice(0, 120)}`);
				if (/pushError|Could not push/i.test(pushBody)) {
					bugs.push(`push action failure body: ${pushBody.slice(0, 240)}`);
				}
				if (/pushSuccess|events added/i.test(pushBody)) {
					await mark(page, t0, log, 'pushSuccess present in action response');
				}
			} else {
				// Fallback: wait for modal close / error without matching the POST shape.
				await Promise.race([
					page.locator('.calendar-modal').waitFor({ state: 'hidden', timeout: 120_000 }),
					page.locator('.calendar-modal .field-error').waitFor({ state: 'visible', timeout: 120_000 })
				]).catch(() => {});
				if (await page.locator('.calendar-modal').isVisible().catch(() => false)) {
					const err =
						(await page.locator('.calendar-modal .field-error').textContent().catch(() => '')) ??
						'';
					if (err.trim()) bugs.push(`push error UI: ${err.trim()}`);
					else bugs.push('no push form response observed');
				} else {
					await mark(page, t0, log, 'modal closed after push (success path)');
				}
			}
			await sleep(1500);
			const stillOpen = await page.locator('.calendar-modal').isVisible().catch(() => false);
			const alertText = stillOpen
				? ((await page.locator('.calendar-modal .field-error').textContent().catch(() => '')) ??
					'')
				: '';
			if (alertText) bugs.push(`push error UI: ${alertText.trim()}`);
			if (stillOpen && !alertText && !bugs.some((b) => /push/i.test(b))) {
				bugs.push('modal still open after push without error');
			}
			if (!stillOpen) await mark(page, t0, log, 'modal closed after push (success path)');
		}

		const grantAfter = await readGrant(userId);
		if (grantAfter?.access_token) {
			try {
				const listed = await listPrimaryEvents(
					grantAfter.access_token,
					'2026-09-07T00:00:00-04:00',
					'2026-09-09T00:00:00-04:00'
				);
				const items = listed.items ?? [];
				const onSep8 = items.filter((ev) =>
					String(ev.start?.dateTime ?? '').startsWith('2026-09-08')
				);
				const onSep7 = items.filter((ev) =>
					String(ev.start?.dateTime ?? '').startsWith('2026-09-07')
				);
				await writeFile(
					path.join(outDir, 'calendar-list-sep7-8.json'),
					JSON.stringify({ count: items.length, onSep8, onSep7 }, null, 2)
				);
				if (onSep8.length < 1) bugs.push('Calendar API: no Badminton event on 2026-09-08');
				if (onSep8.length > 1) {
					bugs.push(`Calendar API: ${onSep8.length} Badminton events on 2026-09-08 (expected 1)`);
				}
				if (onSep7.length > 0) {
					bugs.push('Calendar API: event wrongly on 2026-09-07 (Labour Day)');
				}
				await mark(page, t0, log, `Calendar API sep8=${onSep8.length} sep7=${onSep7.length}`, 1200);

				// Proof surface is calendar.google.com itself (no debug overlay).
				const calUrl =
					'https://calendar.google.com/calendar/u/0/r/day/2026/9/8';
				await mark(page, t0, log, `opening ${calUrl}`, 800);
				await page.goto(calUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch((error) => {
					bugs.push(
						`calendar.google.com navigation failed: ${error instanceof Error ? error.message : String(error)}`
					);
				});
				await sleep(4000);
				const calBody = await page.locator('body').innerText().catch(() => '');
				if (!/Badminton|calendar\.google|Google Calendar/i.test(calBody) && !bugs.length) {
					// Signed-out Google may show login. Still require the URL for the tape.
					await mark(page, t0, log, `on ${page.url()} (body sample may be login wall)`, 1200);
				} else {
					await mark(page, t0, log, 'calendar.google.com day view for 2026-09-08', 2000);
				}
				if (!/calendar\.google\.com/i.test(page.url())) {
					bugs.push(`expected calendar.google.com, got ${page.url()}`);
				}
				await page.screenshot({
					path: path.join(outDir, 'calendar-google-com.png'),
					fullPage: false
				});
			} catch (error) {
				bugs.push(
					`Calendar API verify failed: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		} else if (grantAfter?.has_refresh) {
			bugs.push('grant has refresh but no access token for Calendar API verify');
		}

		await page.screenshot({ path: path.join(outDir, 'final.png'), fullPage: false });
		await sleep(1000);
	} finally {
		if (screencast) await screencast.stop();
		await page.close().catch(() => {});
		if (!useCdp) await context.close().catch(() => {});
		if (browser) await browser.close().catch(() => {});
	}

	const dest = path.join(outDir, 'google-calendar-connect.webm');
	const wallSeconds = Math.max(1, (Date.now() - t0) / 1000);
	if (useCdp) {
		await encodeWebm(framesDir, dest, wallSeconds);
	} else {
		const videoDir = path.join(tmpRoot, 'video');
		const videos = [];
		for (const name of await readdir(videoDir).catch(() => [])) {
			if (!name.endsWith('.webm')) continue;
			const p = path.join(videoDir, name);
			videos.push({ path: p, size: (await stat(p)).size });
		}
		videos.sort((a, b) => b.size - a.size);
		if (!videos[0]) throw new Error('No webm recorded');
		await copyFile(videos[0].path, dest);
	}

	const pass = bugs.length === 0;
	const report = {
		pass,
		baseURL,
		launchMode,
		expectedOccurrences: expectedOcc.length,
		expectedSep8,
		expectedSep7,
		bugs,
		log,
		video: path.relative(root, dest),
		userId,
		nick: NICK_EMAIL
	};
	await writeFile(path.join(outDir, 'prove-report.json'), JSON.stringify(report, null, 2));
	await writeFile(
		path.join(outDir, 'NOTES.md'),
		[
			'# Google Calendar Connect + push proof',
			'',
			`Result: **${pass ? 'PASS' : 'FAIL'}**`,
			'',
			`- Video: \`${path.relative(root, dest)}\``,
			`- Launch: \`${launchMode}\``,
			`- Student: \`${NICK_EMAIL}\``,
			`- Expected Mon meetings on 2026-09-08: ${expectedSep8}; on 2026-09-07: ${expectedSep7}`,
			'',
			'## On-camera moments',
			...log.map((m) => `- ${m.t.toFixed(2)}s ${m.label}`),
			'',
			'## Bugs',
			...(bugs.length ? bugs.map((b) => `- ${b}`) : ['- (none)']),
			''
		].join('\n')
	);

	console.log(JSON.stringify({ pass, bugs, video: dest, launchMode }, null, 2));
	process.exit(pass ? 0 : 1);
}

main().catch(async (error) => {
	console.error(error);
	await writeFile(
		path.join(outDir, 'prove-fatal.json'),
		JSON.stringify({ pass: false, error: String(error?.stack ?? error) }, null, 2)
	).catch(() => {});
	process.exit(1);
});
