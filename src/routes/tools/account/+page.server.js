import { fail } from '@sveltejs/kit';
import {
	ServerConfigurationError,
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

/** @param {Record<string, any>} [dependencies] */
export function _createHandlers(dependencies = {}) {
	const readEnvironment = dependencies.readEnvironment ?? readStaffSignInEnvironment;
	const createRepository = dependencies.createRepository ?? openStudentStore;

	/** @param {any} event */
	async function load(event) {
		let appOrigin;
		try {
			({ appOrigin } = readEnvironment());
		} catch (error) {
			if (error instanceof ServerConfigurationError) {
				const session = event.locals.maritools ?? null;
				return {
					view: accountPageView(session, null),
					callbackURL: `${event.url.origin}/tools/account`,
					recoveryMessage: recoveryMessageFor(event.url.searchParams.get('state')),
					nimDisclosure: NIM_DISCLOSURE,
					...(session ? { unavailable: true } : {})
				};
			}
			throw error;
		}
		const session = event.locals.maritools ?? null;
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
