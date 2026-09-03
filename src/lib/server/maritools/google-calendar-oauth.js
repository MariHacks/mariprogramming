import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { redirect } from '@sveltejs/kit';
import { buildGoogleCalendarAuthorizeUrl } from '$lib/maritools/schedule/googleCalendar.js';

export const GCAL_STATE_COOKIE = 'maritools.gcal-oauth-state';

/**
 * @param {string} secret
 * @returns {string}
 */
export function createOAuthState(secret) {
	const nonce = randomBytes(16).toString('hex');
	const signature = createHmac('sha256', secret).update(nonce).digest('hex');
	return `${nonce}.${signature}`;
}

/**
 * @param {string} state
 * @param {string} secret
 * @returns {boolean}
 */
export function verifyOAuthState(state, secret) {
	const [nonce, signature] = String(state ?? '').split('.');
	if (!nonce || !signature || nonce.length !== 32 || signature.length !== 64) return false;
	const expected = createHmac('sha256', secret).update(nonce).digest('hex');
	try {
		return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
	} catch {
		return false;
	}
}

/**
 * @param {string} appOrigin
 * @returns {string}
 */
export function googleCalendarRedirectUri(appOrigin) {
	return `${appOrigin}/tools/schedule/google-calendar/callback`;
}

/**
 * @param {{ clientId: string, appOrigin: string, secret: string }} config
 * @returns {{ state: string, authorizeUrl: string }}
 */
export function beginGoogleCalendarConnect(config) {
	const state = createOAuthState(config.secret);
	const authorizeUrl = buildGoogleCalendarAuthorizeUrl(
		config.clientId,
		googleCalendarRedirectUri(config.appOrigin),
		state
	);
	return { state, authorizeUrl };
}

/**
 * @param {string} returnPath
 */
export function redirectToSchedule(returnPath = '/tools/schedule') {
	throw redirect(303, returnPath);
}
