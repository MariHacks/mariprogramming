import { validateGoogleAuthorizationUrl } from './staff-sign-in.js';

const GENERIC_SIGN_IN_ERROR = 'Sign-in is unavailable';

/** @returns {never} */
function unavailable() {
	throw new Error(GENERIC_SIGN_IN_ERROR);
}

/** @param {string} callbackURL */
export async function requestStudentAuthorization(callbackURL) {
	try {
		const errorCallbackURL = `${new URL(callbackURL).origin}/tools/account?state=unavailable`;
		const response = await fetch('/api/auth/sign-in/social', {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				provider: 'google',
				callbackURL,
				errorCallbackURL,
				disableRedirect: true
			})
		});
		if (!response.ok) return unavailable();
		const body = await response.json();
		if (body?.redirect !== false) return unavailable();
		return validateGoogleAuthorizationUrl(body?.url, callbackURL);
	} catch {
		return unavailable();
	}
}