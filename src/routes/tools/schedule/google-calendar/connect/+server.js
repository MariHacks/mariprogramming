import { redirect } from '@sveltejs/kit';
import { readRuntimeEnvironment } from '$lib/server/config/environment.js';
import {
	GCAL_STATE_COOKIE,
	beginGoogleCalendarConnect
} from '$lib/server/maritools/google-calendar-oauth.js';

export const prerender = false;

/** @type {import('./$types').RequestHandler} */
export async function GET(event) {
	const session = event.locals.maritools;
	if (!session?.userId) {
		throw redirect(303, '/tools/account');
	}

	const environment = readRuntimeEnvironment();
	const { state, authorizeUrl } = beginGoogleCalendarConnect({
		clientId: environment.googleClientId,
		appOrigin: environment.appOrigin,
		secret: environment.betterAuthSecret
	});

	event.cookies.set(GCAL_STATE_COOKIE, state, {
		path: '/tools/schedule/google-calendar',
		httpOnly: true,
		sameSite: 'lax',
		secure: environment.appOrigin.startsWith('https:'),
		maxAge: 600
	});

	throw redirect(302, authorizeUrl);
}
