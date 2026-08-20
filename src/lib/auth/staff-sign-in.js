const GENERIC_SIGN_IN_ERROR = 'Sign-in is unavailable';
const GOOGLE_AUTH_ORIGIN = 'https://accounts.google.com';
const GOOGLE_AUTH_PATH = '/o/oauth2/v2/auth';

/** @returns {never} */
function unavailable() {
	throw new Error(GENERIC_SIGN_IN_ERROR);
}

/** @param {unknown} value @param {string} callbackURL */
export function validateGoogleAuthorizationUrl(value, callbackURL) {
	if (typeof value !== 'string') return unavailable();
	let url, callback;
	try {
		url = new URL(value);
		callback = new URL(callbackURL);
	} catch {
		return unavailable();
	}

	const scopes = (url.searchParams.get('scope') ?? '').split(' ').sort();
	const redirectUris = url.searchParams.getAll('redirect_uri');
	const accessTypes = url.searchParams.getAll('access_type');
	if (
		url.origin !== GOOGLE_AUTH_ORIGIN ||
		url.pathname !== GOOGLE_AUTH_PATH ||
		url.username ||
		url.password ||
		url.hash ||
		url.searchParams.get('response_type') !== 'code' ||
		accessTypes.length !== 1 ||
		accessTypes[0] !== 'online' ||
		redirectUris.length !== 1 ||
		redirectUris[0] !== `${callback.origin}/api/auth/callback/google` ||
		!url.searchParams.get('state') ||
		!url.searchParams.get('code_challenge') ||
		url.searchParams.get('code_challenge_method') !== 'S256' ||
		JSON.stringify(scopes) !== JSON.stringify(['email', 'openid', 'profile'])
	) {
		return unavailable();
	}

	return url.toString();
}

/** @param {string} callbackURL */
export async function requestStaffAuthorization(callbackURL) {
	try {
		const errorCallbackURL = `${new URL(callbackURL).origin}/staff/sign-in?state=unavailable`;
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
