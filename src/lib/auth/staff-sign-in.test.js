import { afterEach, describe, expect, it, vi } from 'vitest';
import { requestStaffAuthorization, validateGoogleAuthorizationUrl } from './staff-sign-in.js';

const callbackURL = 'https://club.example.com/staff';
const googleUrl =
	'https://accounts.google.com/o/oauth2/v2/auth?client_id=client-id&redirect_uri=https%3A%2F%2Fclub.example.com%2Fapi%2Fauth%2Fcallback%2Fgoogle&response_type=code&scope=openid+email+profile&state=state-value&code_challenge=challenge&code_challenge_method=S256&access_type=online';

afterEach(() => vi.unstubAllGlobals());

describe('staff sign-in client boundary', () => {
	it('accepts only the expected Google authorization endpoint and protocol', () => {
		expect(validateGoogleAuthorizationUrl(googleUrl, callbackURL)).toBe(googleUrl);
	});

	it.each([
		['non-string value', null],
		['malformed value', 'not-a-url'],
		['wrong protocol', googleUrl.replace('https:', 'http:')],
		[
			'lookalike host',
			googleUrl.replace('accounts.google.com', 'accounts.google.com.evil.example')
		],
		['wrong Google path', googleUrl.replace('/o/oauth2/v2/auth', '/redirect')],
		['URL credentials', googleUrl.replace('https://', 'https://attacker@')],
		['URL password', googleUrl.replace('https://', 'https://:password@')],
		['fragment', `${googleUrl}#unexpected`],
		['missing state', googleUrl.replace(/&state=[^&]+/, '')],
		['wrong response type', googleUrl.replace('response_type=code', 'response_type=token')],
		['missing scope', googleUrl.replace(/&scope=[^&]+/, '')],
		['missing PKCE', googleUrl.replace(/&code_challenge=[^&]+/, '')],
		[
			'extra scope',
			googleUrl.replace('scope=openid+email+profile', 'scope=openid+email+profile+drive')
		],
		['offline access', googleUrl.replace('access_type=online', 'access_type=offline')],
		[
			'changed redirect URI',
			googleUrl.replace(
				'redirect_uri=https%3A%2F%2Fclub.example.com%2Fapi%2Fauth%2Fcallback%2Fgoogle',
				'redirect_uri=https%3A%2F%2Fevil.example%2Fcallback'
			)
		],
		['duplicate redirect URI', `${googleUrl}&redirect_uri=https%3A%2F%2Fevil.example%2Fcallback`]
	])('rejects %s', (_case, value) => {
		expect(() => validateGoogleAuthorizationUrl(value, callbackURL)).toThrow(
			'Sign-in is unavailable'
		);
	});

	it('rejects a malformed canonical callback', () => {
		expect(() => validateGoogleAuthorizationUrl(googleUrl, 'not-a-callback')).toThrow(
			'Sign-in is unavailable'
		);
	});

	it('posts the one approved Google request and returns a validated authorization URL', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValue(Response.json({ url: googleUrl, redirect: false }, { status: 200 }));
		vi.stubGlobal('fetch', fetchMock);
		await expect(requestStaffAuthorization(callbackURL)).resolves.toBe(googleUrl);
		expect(fetchMock).toHaveBeenCalledWith('/api/auth/sign-in/social', {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				provider: 'google',
				callbackURL,
				errorCallbackURL: 'https://club.example.com/staff/sign-in?state=unavailable',
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
		await expect(requestStaffAuthorization(callbackURL)).rejects.toThrow('Sign-in is unavailable');
	});
});
