#!/usr/bin/env node
/**
 * Probes Google's authorize endpoint with the MariTools Calendar redirect URI.
 * Exit 0 when Google accepts the redirect (consent / account chooser).
 * Exit 1 on redirect_uri_mismatch or missing env.
 *
 * Usage (repo root, with .env.local loaded by the shell or present on disk):
 *   node scripts/check-google-calendar-oauth-redirect.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal() {
	const path = resolve(process.cwd(), '.env.local');
	if (!existsSync(path)) return {};
	/** @type {Record<string, string>} */
	const out = {};
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		if (!line || line.startsWith('#')) continue;
		const i = line.indexOf('=');
		if (i < 0) continue;
		const key = line.slice(0, i).trim();
		let value = line.slice(i + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		out[key] = value;
	}
	return out;
}

/**
 * @param {string} finalUrl
 * @returns {{ errorPath: boolean, errorName: string | null }}
 */
function classifyGoogleOAuthLanding(finalUrl) {
	const url = new URL(finalUrl);
	const errorPath = /\/signin\/oauth\/error\/?$/i.test(url.pathname);
	let errorName = null;
	const authError = url.searchParams.get('authError');
	if (authError) {
		try {
			const pad = '='.repeat((4 - (authError.length % 4)) % 4);
			const decoded = Buffer.from(authError + pad, 'base64').toString('utf8');
			const match = decoded.match(/redirect_uri_mismatch|invalid_client|access_denied|[a-z0-9_]{8,}/i);
			errorName = match?.[0] ?? null;
			if (/redirect_uri_mismatch/i.test(decoded)) errorName = 'redirect_uri_mismatch';
		} catch {
			errorName = null;
		}
	}
	if (!errorName && /redirect_uri_mismatch/i.test(finalUrl)) {
		errorName = 'redirect_uri_mismatch';
	}
	return { errorPath, errorName };
}

const fileEnv = loadEnvLocal();
const clientId = process.env.GOOGLE_CLIENT_ID || fileEnv.GOOGLE_CLIENT_ID || '';
const appOrigin = (process.env.APP_ORIGIN || fileEnv.APP_ORIGIN || '').replace(/\/$/, '');

if (!clientId || !appOrigin) {
	console.error('FAIL missing GOOGLE_CLIENT_ID or APP_ORIGIN');
	process.exit(1);
}

const calendarRedirect = `${appOrigin}/tools/schedule/google-calendar/callback`;
const authRedirect = `${appOrigin}/api/auth/callback/google`;

/**
 * @param {string} redirectUri
 * @param {string} scope
 */
async function probe(redirectUri, scope) {
	const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
	url.searchParams.set('client_id', clientId);
	url.searchParams.set('redirect_uri', redirectUri);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('scope', scope);
	url.searchParams.set('state', 'oauth-redirect-probe');
	const response = await fetch(url, { redirect: 'follow' });
	const finalUrl = response.url;
	const { errorPath, errorName } = classifyGoogleOAuthLanding(finalUrl);
	const mismatch = errorPath || errorName === 'redirect_uri_mismatch';
	const accepted =
		!mismatch &&
		(/accounts\.google\.com\/(?:v3\/signin|o\/oauth2|signin\/oauth\/(?:legacy\/)?consent)/i.test(
			finalUrl
		) ||
			/consent/i.test(finalUrl));
	return {
		redirectUri,
		finalPath: new URL(finalUrl).pathname,
		errorName,
		mismatch,
		accepted,
		status: response.status
	};
}

const calendar = await probe(calendarRedirect, 'https://www.googleapis.com/auth/calendar.events');
const auth = await probe(authRedirect, 'openid email profile');

console.log(
	JSON.stringify(
		{
			appOrigin,
			calendarRedirect,
			authRedirect,
			calendar,
			auth
		},
		null,
		2
	)
);

if (calendar.mismatch) {
	console.error(
		`FAIL calendar redirect_uri_mismatch for ${calendarRedirect}. Add that exact URI to the Web client in Google Cloud Console, then rerun.`
	);
	process.exit(1);
}

if (!calendar.accepted) {
	console.error(
		`FAIL unexpected Google response for calendar redirect (path ${calendar.finalPath}, error ${calendar.errorName})`
	);
	process.exit(1);
}

console.error('PASS calendar redirect accepted by Google (consent or sign-in surface)');
process.exit(0);
