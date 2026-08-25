import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestStudentAuthorization } from './student-sign-in.js';
import { validateGoogleAuthorizationUrl } from './staff-sign-in.js';

const callbackURL = 'https://club.example.com/tools/account';
const googleUrl =
	'https://accounts.google.com/o/oauth2/v2/auth?client_id=client-id&redirect_uri=https%3A%2F%2Fclub.example.com%2Fapi%2Fauth%2Fcallback%2Fgoogle&response_type=code&scope=openid+email+profile&state=state-value&code_challenge=challenge&code_challenge_method=S256&access_type=online';

afterEach(() => vi.unstubAllGlobals());

describe('student sign-in client boundary', () => {
	it('posts the tools account callback pair and returns a validated Google URL', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(Response.json({ url: googleUrl, redirect: false }, { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		await expect(requestStudentAuthorization(callbackURL)).resolves.toBe(
			validateGoogleAuthorizationUrl(googleUrl, callbackURL)
		);
		expect(fetchMock).toHaveBeenCalledWith('/api/auth/sign-in/social', {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				provider: 'google',
				callbackURL,
				errorCallbackURL: 'https://club.example.com/tools/account?state=unavailable',
				disableRedirect: true
			})
		});
	});

	it.each([
		['server rejection', new Response('database secret', { status: 503 })],
		['malformed response', Response.json({ url: 'https://evil.example' })],
		['network failure', new Error('network secret')]
	])('returns one generic error for %s', async (_case, result) => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => {
				if (result instanceof Error) throw result;
				return result;
			})
		);
		await expect(requestStudentAuthorization(callbackURL)).rejects.toThrow('Sign-in is unavailable');
	});

	it('rejects a redirecting handler response and a malformed callback', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => Response.json({ url: googleUrl, redirect: true }, { status: 200 }))
		);
		await expect(requestStudentAuthorization(callbackURL)).rejects.toThrow('Sign-in is unavailable');
		await expect(requestStudentAuthorization('not-a-url')).rejects.toThrow('Sign-in is unavailable');
	});
});
