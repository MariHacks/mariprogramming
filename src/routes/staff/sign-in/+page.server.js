import { readStaffSignInEnvironment } from '$lib/server/config/environment.js';

/** @param {string | null} state */
function recoveryMessageFor(state) {
	if (state === 'unavailable') return "We couldn't complete sign-in. Try again.";
	if (state === 'reauthenticate') {
		return 'Your team session is no longer active. Sign in again.';
	}
	return null;
}

/** @param {{ readEnvironment?: () => { appOrigin: string } }} [dependencies] */
export function _createLoad({ readEnvironment = readStaffSignInEnvironment } = {}) {
	return function load(/** @type {{ url: URL }} */ { url }) {
		const { appOrigin } = readEnvironment();
		const recoveryMessage = recoveryMessageFor(url.searchParams.get('state'));
		return { callbackURL: `${appOrigin}/staff`, recoveryMessage };
	};
}

export const load = _createLoad();
