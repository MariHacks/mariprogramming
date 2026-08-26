import { redirect } from '@sveltejs/kit';
import { readRuntimeEnvironment } from '$lib/server/config/environment.js';
import { completeGoogleCalendarConnect } from '$lib/server/maritools/google-calendar-push.js';
import {
	GCAL_STATE_COOKIE,
	verifyOAuthState
} from '$lib/server/maritools/google-calendar-oauth.js';
import { openGoogleCalendarStore } from '$lib/server/maritools/google-calendar-store.js';

export const prerender = false;

/** @type {import('./$types').RequestHandler} */
export async function GET(event) {
	const session = event.locals.maritools;
	if (!session?.userId) {
		throw redirect(303, '/tools/account');
	}

	const storedState = event.cookies.get(GCAL_STATE_COOKIE);
	const returnedState = event.url.searchParams.get('state') ?? '';
	const code = event.url.searchParams.get('code') ?? '';
	const environment = readRuntimeEnvironment();

	event.cookies.delete(GCAL_STATE_COOKIE, { path: '/tools/schedule/google-calendar' });

	if (
		!code ||
		!storedState ||
		storedState !== returnedState ||
		!verifyOAuthState(returnedState, environment.betterAuthSecret)
	) {
		throw redirect(303, '/tools/schedule?gcal=error');
	}

	try {
		await completeGoogleCalendarConnect({
			store: openGoogleCalendarStore(),
			userId: session.userId,
			code,
			environment
		});
	} catch {
		throw redirect(303, '/tools/schedule?gcal=error');
	}

	throw redirect(303, '/tools/schedule?gcal=connected');
}
