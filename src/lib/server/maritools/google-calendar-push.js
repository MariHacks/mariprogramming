import { generateOccurrences } from '$lib/maritools/schedule/occurrences.js';
import {
	exchangeGoogleCalendarCode,
	insertOccurrencesIntoGoogleCalendar,
	refreshGoogleCalendarAccessToken
} from '$lib/maritools/schedule/googleCalendar.js';
import { rulesForTerm } from '$lib/maritools/term/calendar.js';
import { googleCalendarRedirectUri } from './google-calendar-oauth.js';

/**
 * @param {Date | null | undefined} expiresAt
 * @returns {boolean}
 */
export function accessTokenExpired(expiresAt) {
	if (!expiresAt) return true;
	return expiresAt.getTime() <= Date.now() + 60_000;
}

/**
 * @param {import('./google-calendar-store.js').ReturnType<typeof import('./google-calendar-store.js').createGoogleCalendarStore>} store
 * @param {string} userId
 * @param {{ googleClientId: string, googleClientSecret: string }} environment
 * @param {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>} fetchImpl
 */
export async function resolveGoogleCalendarAccessToken(store, userId, environment, fetchImpl) {
	const grant = await store.getGrant(userId);
	if (!grant) {
		throw new Error('Google Calendar is not connected');
	}

	if (!accessTokenExpired(grant.accessTokenExpiresAt) && grant.accessToken) {
		return grant.accessToken;
	}

	const tokenResponse = await refreshGoogleCalendarAccessToken(
		environment.googleClientId,
		environment.googleClientSecret,
		grant.refreshToken,
		fetchImpl
	);

	const accessToken = String(tokenResponse.access_token ?? '');
	if (!accessToken) {
		throw new Error('Google token refresh returned no access token');
	}

	const expiresIn = Number(tokenResponse.expires_in ?? 3600);
	const accessTokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
	await store.updateAccessToken(userId, { accessToken, accessTokenExpiresAt });
	return accessToken;
}

/**
 * @param {{
 *   store: ReturnType<typeof import('./google-calendar-store.js').createGoogleCalendarStore>,
 *   userId: string,
 *   term: import('$lib/maritools/term/calendar.js').AcademicTerm,
 *   courses: import('$lib/maritools/schedule/parseOmnivox.js').ParsedCourse[],
 *   environment: { googleClientId: string, googleClientSecret: string, appOrigin: string },
 *   fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
 * }} input
 */
export async function pushScheduleToGoogleCalendar(input) {
	const fetchImpl = input.fetchImpl ?? fetch;
	const rules = rulesForTerm(input.term.id);
	if (!rules) {
		throw new Error('This term does not have calendar rules yet.');
	}

	const accessToken = await resolveGoogleCalendarAccessToken(
		input.store,
		input.userId,
		input.environment,
		fetchImpl
	);
	const occurrences = generateOccurrences(input.term, rules, input.courses);
	return insertOccurrencesIntoGoogleCalendar(occurrences, fetchImpl, accessToken);
}

/**
 * @param {{
 *   store: ReturnType<typeof import('./google-calendar-store.js').createGoogleCalendarStore>,
 *   userId: string,
 *   code: string,
 *   environment: { googleClientId: string, googleClientSecret: string, appOrigin: string },
 *   fetchImpl?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
 * }} input
 */
export async function completeGoogleCalendarConnect(input) {
	const fetchImpl = input.fetchImpl ?? fetch;
	const tokenResponse = await exchangeGoogleCalendarCode(
		input.environment.googleClientId,
		input.environment.googleClientSecret,
		googleCalendarRedirectUri(input.environment.appOrigin),
		input.code,
		fetchImpl
	);

	const refreshToken = String(tokenResponse.refresh_token ?? '');
	if (!refreshToken) {
		throw new Error('Google did not return a refresh token');
	}

	const accessToken = String(tokenResponse.access_token ?? '');
	const expiresIn = Number(tokenResponse.expires_in ?? 3600);
	await input.store.upsertGrant(input.userId, {
		refreshToken,
		accessToken: accessToken || null,
		accessTokenExpiresAt: accessToken ? new Date(Date.now() + expiresIn * 1000) : null
	});
}
