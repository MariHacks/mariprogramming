import { fail, redirect } from '@sveltejs/kit';
import {
	ServerConfigurationError,
	isGoogleOAuthConfigured,
	readStaffSignInEnvironment
} from '$lib/server/config/environment.js';
import { NIM_DISCLOSURE, accountPageView } from '$lib/server/maritools/community.js';
import {
	MaritoolsInputError,
	MaritoolsUnavailableError,
	openStudentStore
} from '$lib/server/maritools/student-store.js';

export const prerender = false;

/** @param {string | null} state */
function recoveryMessageFor(state) {
	if (state === 'unavailable') return 'We could not finish sign-in. Try again.';
	return null;
}

/**
 * Stale OAuth error callbacks can land on ?state=unavailable after a later
 * attempt already created a session. Drop the query so signed-in users never
 * see a contradictory failure banner.
 * @param {URL} url
 * @param {unknown} session
 */
function clearStaleSignInFailure(url, session) {
	if (!session || url.searchParams.get('state') !== 'unavailable') return;
	throw redirect(303, `${url.pathname}${url.hash}`);
}

/** @param {Record<string, any>} [dependencies] */
export function _createHandlers(dependencies = {}) {
	const readEnvironment = dependencies.readEnvironment ?? readStaffSignInEnvironment;
	const createRepository = dependencies.createRepository ?? openStudentStore;
	const googleSignInConfigured =
		dependencies.isGoogleSignInConfigured ?? (() => isGoogleOAuthConfigured());

	/** @param {any} event */
	async function load(event) {
		const signInConfigured = googleSignInConfigured();
		const session = event.locals.maritools ?? null;
		clearStaleSignInFailure(event.url, session);
		let appOrigin;
		try {
			({ appOrigin } = readEnvironment());
		} catch (error) {
			if (error instanceof ServerConfigurationError) {
				return {
					view: accountPageView(session, null),
					callbackURL: `${event.url.origin}/tools/account`,
					recoveryMessage: recoveryMessageFor(event.url.searchParams.get('state')),
					nimDisclosure: NIM_DISCLOSURE,
					googleSignInConfigured: signInConfigured,
					...(session ? { unavailable: true } : {})
				};
			}
			throw error;
		}
		let profile = null;
		let unavailable = false;
		if (session) {
			try {
				profile = await createRepository().getProfile(session.userId);
			} catch {
				unavailable = true;
			}
		}
		return {
			view: accountPageView(session, profile),
			callbackURL: `${appOrigin}/tools/account`,
			recoveryMessage: recoveryMessageFor(event.url.searchParams.get('state')),
			nimDisclosure: NIM_DISCLOSURE,
			googleSignInConfigured: signInConfigured,
			...(unavailable ? { unavailable: true } : {})
		};
	}

	/** @param {any} event */
	async function complete(event) {
		const session = event.locals.maritools;
		if (!session) return fail(401, { error: 'Sign in with Google first.' });
		const data = await event.request.formData();
		try {
			await createRepository().completeProfile({
				userId: session.userId,
				email: session.email,
				studentId: String(data.get('studentId') ?? ''),
				displayName: String(data.get('displayName') ?? ''),
				nimAccepted: data.get('nimAccepted') === 'on'
			});
			return { success: true };
		} catch (error) {
			if (error instanceof MaritoolsInputError) {
				if (error.code === 'nim-required') {
					return fail(400, { error: 'Confirm the NVIDIA disclosure before saving.' });
				}
				return fail(400, { error: 'Enter your student number as 5 to 8 digits.' });
			}
			if (error instanceof MaritoolsUnavailableError) {
				return fail(503, { error: 'Saving your account is unavailable. Try again.' });
			}
			throw error;
		}
	}

	return { load, actions: { complete } };
}

const handlers = _createHandlers();
export const load = handlers.load;
export const actions = handlers.actions;
