import { validateGoogleAuthorizationUrl } from './staff-sign-in.js';

const GENERIC_SIGN_IN_ERROR = 'Sign-in is unavailable';
const AUTH_SERVICE_UNAVAILABLE = 'Authentication service is unavailable';
const GOOGLE_NOT_CONFIGURED = 'Google sign-in is not configured';

/** @returns {never} */
function unavailable(message = GENERIC_SIGN_IN_ERROR) {
	throw new Error(message);
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
		if (!response.ok) {
			if (response.status === 503) {
				const detail = await response.text();
				if (detail === AUTH_SERVICE_UNAVAILABLE) return unavailable(GOOGLE_NOT_CONFIGURED);
			}
			return unavailable();
		}
		const body = await response.json();
		if (body?.redirect !== false) return unavailable();
		return validateGoogleAuthorizationUrl(body?.url, callbackURL);
	} catch (error) {
		if (error instanceof Error && error.message === GOOGLE_NOT_CONFIGURED) throw error;
		return unavailable();
	}
}