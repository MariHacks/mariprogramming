import { memoryAdapter } from 'better-auth/adapters/memory';
import { betterAuth } from 'better-auth/minimal';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	AuthPersistenceUnavailableError,
	AuthProviderUnavailableError,
	createBetterAuthOptions
} from './config.js';
import { RateLimitUnavailableError } from '../security/rate-limit.js';

const ALLOWED_EMAIL = 'team@marihacks.com';
const BASIC_GOOGLE_SCOPES = ['email', 'openid', 'profile'];
const productionEnvironment = Object.freeze({
	appOrigin: 'https://books.example.com',
	betterAuthOrigin: 'https://books.example.com',
	betterAuthSecret: 'better-auth-secret-with-at-least-32-characters',
	googleClientId: 'google-client-id.apps.googleusercontent.com',
	googleClientSecret: 'google-client-secret'
});

/** @param {Record<string, unknown>} [overrides] */
function createMemoryDatabase(overrides = {}) {
	/** @type {Record<string, Record<string, unknown>[]>} */
	const data = {
		user: [],
		session: [],
		account: [],
		verification: [],
		rateLimit: []
	};
	const adapter = memoryAdapter(data);

	return {
		data,
		/** @param {import('better-auth').BetterAuthOptions} options */
		database(options) {
			return { ...adapter(options), ...overrides };
		}
	};
}

function createOptions(overrides = {}) {
	const { database } = createMemoryDatabase();
	/** @type {Map<string, number>} */
	const counters = new Map();
	const rateLimitStorage = {
		async consume(/** @type {string} */ key, /** @type {{ max: number, window: number }} */ rule) {
			const count = (counters.get(key) ?? 0) + 1;
			counters.set(key, count);
			return {
				allowed: count <= rule.max,
				retryAfter: count <= rule.max ? null : rule.window
			};
		}
	};

	return createBetterAuthOptions({
		database,
		environment: productionEnvironment,
		rateLimitStorage,
		fetchGoogleProfile: async () => ({
			sub: 'google-subject-123',
			email: ALLOWED_EMAIL,
			email_verified: true,
			name: 'MariHacks Team'
		}),
		...overrides
	});
}

/** @param {import('better-auth').BetterAuthOptions} options */
function getGoogleUserInfo(options) {
	const provider = options.socialProviders?.google;
	if (!provider || typeof provider === 'function' || typeof provider.getUserInfo !== 'function') {
		throw new TypeError('Google provider is unavailable in test configuration');
	}

	return provider.getUserInfo;
}

/**
 * @param {Record<string, unknown>} body
 * @param {string} [origin]
 * @param {Record<string, string>} [forwardingHeaders]
 */
function signInRequest(body, origin = productionEnvironment.appOrigin, forwardingHeaders = {}) {
	return new Request(`${productionEnvironment.appOrigin}/api/auth/sign-in/social`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			origin,
			'x-forwarded-for': '203.0.113.10',
			...forwardingHeaders
		},
		body: JSON.stringify({
			callbackURL: `${productionEnvironment.appOrigin}/staff`,
			errorCallbackURL: `${productionEnvironment.appOrigin}/staff/sign-in?state=unavailable`,
			disableRedirect: true,
			...body
		})
	});
}

/**
 * Completes a real Better Auth Google authorization-code flow against the memory adapter.
 * Only Google's external token exchange is replaced; Better Auth's state, callback, database,
 * admission, account, and session behavior remain real.
 *
 * @param {ReturnType<typeof betterAuth>} auth
 */
async function completeGoogleOAuth(auth) {
	const signInResponse = await auth.handler(
		signInRequest({ provider: 'google', disableRedirect: true })
	);
	const { url } = await signInResponse.json();
	const authorizationUrl = new URL(url);
	const state = authorizationUrl.searchParams.get('state');
	const stateCookie = signInResponse.headers.get('set-cookie')?.split(';', 1)[0];
	if (!state || !stateCookie) {
		throw new Error('OAuth state was not initialized');
	}

	const callbackUrl = new URL('/api/auth/callback/google', productionEnvironment.appOrigin);
	callbackUrl.searchParams.set('code', 'google-authorization-code');
	callbackUrl.searchParams.set('state', state);

	return auth.handler(
		new Request(callbackUrl, {
			headers: {
				cookie: stateCookie,
				'x-forwarded-for': '203.0.113.12'
			}
		})
	);
}

/** @param {Response} response */
function getSessionCookieHeader(response) {
	const setCookie = response.headers.get('set-cookie') ?? '';
	const match = setCookie.match(/__Secure-mari-staff\.session_token=([^;,\s]+)/);
	if (!match) {
		throw new Error('Session cookie was not issued');
	}

	return `__Secure-mari-staff.session_token=${match[1]}`;
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('Better Auth configuration', () => {
	it('enables only bounded Google OAuth with database sessions and controls', () => {
		const { database } = createMemoryDatabase();
		const options = createOptions({ database });

		expect(options).toMatchObject({
			appName: 'Marianopolis Programming Club Team',
			baseURL: productionEnvironment.appOrigin,
			basePath: '/api/auth',
			secret: productionEnvironment.betterAuthSecret,
			trustedOrigins: [productionEnvironment.appOrigin],
			account: {
				encryptOAuthTokens: true,
				storeStateStrategy: 'database',
				storeAccountCookie: false
			},
			session: {
				expiresIn: 28800,
				disableSessionRefresh: true,
				cookieCache: { enabled: false }
			},
			rateLimit: {
				enabled: true,
				window: 60,
				max: 100,
				customStorage: expect.objectContaining({ consume: expect.any(Function) })
			},
			advanced: {
				useSecureCookies: true,
				disableCSRFCheck: false,
				disableOriginCheck: false,
				defaultCookieAttributes: {
					httpOnly: true,
					secure: true,
					sameSite: 'lax',
					path: '/'
				}
			},
			telemetry: { enabled: false, debug: false },
			logger: { disabled: true }
		});
		expect(options.database).toEqual(expect.any(Function));
		expect(options.database).not.toBe(database);
		expect(Object.keys(options.socialProviders ?? {})).toEqual(['google']);
		const google = options.socialProviders?.google;
		expect(google).toMatchObject({
			clientId: productionEnvironment.googleClientId,
			clientSecret: productionEnvironment.googleClientSecret,
			disableIdTokenSignIn: true,
			disableDefaultScope: true,
			scope: BASIC_GOOGLE_SCOPES,
			accessType: 'online'
		});
		expect(google).not.toHaveProperty('mapProfileToUser');
		expect(options).not.toHaveProperty('emailAndPassword');
		expect(options.plugins).toEqual([]);
		expect(options.disabledPaths).toEqual(
			expect.arrayContaining(['/sign-up/email', '/sign-in/email', '/link-social', '/set-password'])
		);
	});

	it('normalizes a verified Google identity, including the staff mailbox', async () => {
		const getUserInfo = getGoogleUserInfo(
			createOptions({
				fetchGoogleProfile: async () => ({
					sub: 'google-subject-123',
					email: '  Team@MariHacks.Com  ',
					email_verified: true,
					name: '  MariHacks Team  ',
					picture: 'https://images.example.com/team.png'
				})
			})
		);

		await expect(getUserInfo({ accessToken: 'provider-access-token' })).resolves.toEqual({
			user: {
				id: 'google-subject-123',
				email: ALLOWED_EMAIL,
				emailVerified: true,
				name: 'MariHacks Team',
				image: 'https://images.example.com/team.png'
			},
			data: {
				sub: 'google-subject-123',
				email: ALLOWED_EMAIL,
				email_verified: true
			}
		});
	});

	it.each([
		['non-object profile', null],
		['array profile', []],
		['missing subject', { email: ALLOWED_EMAIL, email_verified: true }],
		['blank subject', { sub: '   ', email: ALLOWED_EMAIL, email_verified: true }],
		['oversized subject', { sub: 's'.repeat(256), email: ALLOWED_EMAIL, email_verified: true }],
		[
			'unverified email',
			{ sub: 'google-subject-123', email: ALLOWED_EMAIL, email_verified: false }
		],
		[
			'string verification claim',
			{ sub: 'google-subject-123', email: ALLOWED_EMAIL, email_verified: 'true' }
		],
		['missing email', { sub: 'google-subject-123', email_verified: true }],
		['malformed email', { sub: 'google-subject-123', email: 'not-an-email', email_verified: true }],
		[
			'oversized email',
			{ sub: 'google-subject-123', email: `${'a'.repeat(250)}@x.com`, email_verified: true }
		]
	])('returns null before issuance for %s', async (_case, profile) => {
		const getUserInfo = getGoogleUserInfo(
			createOptions({
				fetchGoogleProfile: async () => profile
			})
		);

		await expect(getUserInfo({ accessToken: 'provider-access-token' })).resolves.toBeNull();
	});

	it('admits a verified student Google mailbox', async () => {
		const getUserInfo = getGoogleUserInfo(
			createOptions({
				fetchGoogleProfile: async () => ({
					sub: 'google-subject-456',
					email: '  Ada@Gmail.Com  ',
					email_verified: true,
					name: 'Ada'
				})
			})
		);

		await expect(getUserInfo({ accessToken: 'provider-access-token' })).resolves.toMatchObject({
			user: {
				id: 'google-subject-456',
				email: 'ada@gmail.com',
				emailVerified: true,
				name: 'Ada'
			}
		});
	});

	it('returns null without contacting Google when the authorization-code token is absent', async () => {
		const fetchGoogleProfile = vi.fn();
		const getUserInfo = getGoogleUserInfo(createOptions({ fetchGoogleProfile }));

		await expect(getUserInfo({})).resolves.toBeNull();
		expect(fetchGoogleProfile).not.toHaveBeenCalled();
	});

	it('maps optional provider fields to bounded values', async () => {
		const getUserInfo = getGoogleUserInfo(
			createOptions({
				fetchGoogleProfile: async () => ({
					sub: 'google-subject-123',
					email: ALLOWED_EMAIL,
					email_verified: true,
					name: `  ${'n'.repeat(300)}  `,
					picture: 'data:text/html,not-an-image'
				})
			})
		);

		await expect(getUserInfo({ accessToken: 'provider-access-token' })).resolves.toEqual({
			user: {
				id: 'google-subject-123',
				email: ALLOWED_EMAIL,
				emailVerified: true,
				name: 'n'.repeat(255)
			},
			data: {
				sub: 'google-subject-123',
				email: ALLOWED_EMAIL,
				email_verified: true
			}
		});
	});

	it('uses a bounded fallback name and omits a malformed image URL', async () => {
		const getUserInfo = getGoogleUserInfo(
			createOptions({
				fetchGoogleProfile: async () => ({
					sub: 'google-subject-123',
					email: ALLOWED_EMAIL,
					email_verified: true,
					name: '   ',
					picture: 'not a URL'
				})
			})
		);

		await expect(getUserInfo({ accessToken: 'provider-access-token' })).resolves.toMatchObject({
			user: {
				id: 'google-subject-123',
				name: ALLOWED_EMAIL,
				email: ALLOWED_EMAIL,
				emailVerified: true
			}
		});
		await expect(getUserInfo({ accessToken: 'provider-access-token' })).resolves.not.toHaveProperty(
			'user.image'
		);
	});

	it('uses the Google OpenID user-info endpoint with the exchanged access token', async () => {
		const fetchMock = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({
				sub: 'google-subject-123',
				email: ALLOWED_EMAIL,
				email_verified: true
			})
		});
		vi.stubGlobal('fetch', fetchMock);
		const { database } = createMemoryDatabase();
		const getUserInfo = getGoogleUserInfo(
			createBetterAuthOptions({
				database,
				environment: productionEnvironment,
				rateLimitStorage: { consume: async () => ({ allowed: true, retryAfter: null }) }
			})
		);

		await getUserInfo({ accessToken: 'provider-access-token' });

		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('https://openidconnect.googleapis.com/v1/userinfo');
		expect(init).toMatchObject({
			headers: { authorization: 'Bearer provider-access-token' }
		});
		expect(init.signal).toBeInstanceOf(AbortSignal);
	});

	it.each([
		['provider rejection', async () => ({ ok: false, json: async () => ({}) })],
		['network failure', async () => Promise.reject(new Error('secret-provider-detail'))],
		[
			'malformed provider response',
			async () => ({
				ok: true,
				json: async () => Promise.reject(new Error('secret-json-detail'))
			})
		]
	])('fails closed with a generic error on %s', async (_case, fetchImplementation) => {
		vi.stubGlobal('fetch', vi.fn(fetchImplementation));
		const { database } = createMemoryDatabase();
		const getUserInfo = getGoogleUserInfo(
			createBetterAuthOptions({
				database,
				environment: productionEnvironment,
				rateLimitStorage: { consume: async () => ({ allowed: true, retryAfter: null }) }
			})
		);

		let thrown;
		try {
			await getUserInfo({ accessToken: 'provider-access-token' });
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(AuthProviderUnavailableError);
		expect(thrown).toMatchObject({
			name: 'AuthProviderUnavailableError',
			code: 'AUTH_PROVIDER_UNAVAILABLE',
			message: 'Identity provider is unavailable'
		});
		expect(JSON.stringify(thrown)).not.toContain('secret');
	});

	it.each([
		['missing database adapter', { database: null }],
		['missing environment', { environment: null }],
		['missing rate limit storage', { rateLimitStorage: null }],
		['invalid rate limit storage', { rateLimitStorage: {} }],
		['invalid profile fetcher', { fetchGoogleProfile: null }]
	])('rejects %s with a generic configuration error', (_case, override) => {
		expect(() => createOptions(override)).toThrow('Authentication configuration is invalid');
	});
});

describe('Better Auth runtime contract', () => {
	it('leaves non-sign-in auth endpoints unchanged', async () => {
		const auth = betterAuth(createOptions());

		const response = await auth.handler(
			new Request(`${productionEnvironment.appOrigin}/api/auth/get-session`, {
				headers: { 'x-forwarded-for': '203.0.113.9' }
			})
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toBeNull();
	});

	it('uses only the basic Google scopes and requests no offline access', async () => {
		const options = createOptions();
		const auth = betterAuth(options);

		const response = await auth.handler(
			signInRequest({ provider: 'google', disableRedirect: true })
		);
		const payload = await response.json();
		const authorizationUrl = new URL(payload.url);

		expect(response.status).toBe(200);
		expect(authorizationUrl.searchParams.get('scope')?.split(' ').sort()).toEqual(
			BASIC_GOOGLE_SCOPES
		);
		expect(authorizationUrl.searchParams.get('access_type')).toBe('online');
		expect(authorizationUrl.searchParams.has('prompt')).toBe(false);
	});

	it('rejects client-supplied additional Google scopes', async () => {
		const auth = betterAuth(createOptions());

		const response = await auth.handler(
			signInRequest({
				provider: 'google',
				disableRedirect: true,
				scopes: ['https://www.googleapis.com/auth/drive.readonly']
			})
		);
		const body = await response.text();

		expect(response.status).toBe(403);
		expect(body).toContain('Authentication request is invalid');
		expect(body).not.toContain('drive.readonly');
	});

	it('rejects direct ID-token sign-in and disabled registration paths', async () => {
		const auth = betterAuth(createOptions());
		const idTokenResponse = await auth.handler(
			signInRequest({
				provider: 'google',
				idToken: { token: 'untrusted-client-id-token' }
			})
		);
		const registrationResponse = await auth.handler(
			new Request(`${productionEnvironment.appOrigin}/api/auth/sign-up/email`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					origin: productionEnvironment.appOrigin,
					'x-forwarded-for': '203.0.113.11'
				},
				body: JSON.stringify({
					name: 'Not Staff',
					email: 'not-staff@example.com',
					password: 'not-a-real-password'
				})
			})
		);

		expect(idTokenResponse.status).toBe(403);
		expect(idTokenResponse.headers.has('set-cookie')).toBe(false);
		expect(registrationResponse.status).toBe(404);
		expect(registrationResponse.headers.has('set-cookie')).toBe(false);
	});

	it('removes provider tokens only after callback admission and before account create or update', async () => {
		const memory = createMemoryDatabase();
		/** @type {string[]} */
		const observedAccessTokens = [];
		const exchangedAccessTokens = ['first-provider-access-token', 'second-provider-access-token'];
		const auth = betterAuth(
			createOptions({
				database: memory.database,
				async fetchGoogleProfile(/** @type {string} */ accessToken) {
					expect(memory.data.account).toHaveLength(observedAccessTokens.length);
					observedAccessTokens.push(accessToken);
					return {
						sub: 'google-subject-123',
						email: ALLOWED_EMAIL,
						email_verified: true,
						name: 'MariHacks Team'
					};
				}
			})
		);
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input) => {
				const url = input instanceof Request ? input.url : String(input);
				if (url !== 'https://oauth2.googleapis.com/token') {
					throw new Error('Unexpected external request');
				}

				return Response.json({
					access_token: exchangedAccessTokens.shift(),
					refresh_token: 'plaintext-provider-refresh-token',
					id_token: 'plaintext-provider-id-token',
					expires_in: 3600,
					refresh_token_expires_in: 7200,
					token_type: 'Bearer',
					scope: BASIC_GOOGLE_SCOPES.join(' ')
				});
			})
		);

		const firstCallback = await completeGoogleOAuth(auth);
		expect(firstCallback.status).toBe(302);
		const sessionCookie = getSessionCookieHeader(firstCallback);
		const sessionResponse = await auth.handler(
			new Request(`${productionEnvironment.appOrigin}/api/auth/get-session`, {
				headers: {
					cookie: sessionCookie,
					'x-forwarded-for': '203.0.113.12'
				}
			})
		);
		expect(sessionResponse.status).toBe(200);
		expect(await sessionResponse.json()).toMatchObject({
			user: { email: ALLOWED_EMAIL },
			session: { userId: expect.any(String) }
		});
		expect(memory.data.account).toHaveLength(1);
		expect(memory.data.account[0]).toMatchObject({
			providerId: 'google',
			accountId: 'google-subject-123',
			accessToken: null,
			refreshToken: null,
			idToken: null,
			accessTokenExpiresAt: null,
			refreshTokenExpiresAt: null
		});

		const secondCallback = await completeGoogleOAuth(auth);
		expect(secondCallback.status).toBe(302);
		expect(memory.data.account).toHaveLength(1);
		expect(memory.data.account[0]).toMatchObject({
			accessToken: null,
			refreshToken: null,
			idToken: null,
			accessTokenExpiresAt: null,
			refreshTokenExpiresAt: null
		});
		expect(observedAccessTokens).toEqual([
			'first-provider-access-token',
			'second-provider-access-token'
		]);

		const signOutResponse = await auth.handler(
			new Request(`${productionEnvironment.appOrigin}/api/auth/sign-out`, {
				method: 'POST',
				headers: {
					cookie: getSessionCookieHeader(secondCallback),
					origin: productionEnvironment.appOrigin,
					'x-forwarded-for': '203.0.113.12'
				}
			})
		);
		expect(signOutResponse.status).toBe(200);
		expect(await signOutResponse.json()).toEqual({ success: true });
	});

	it.each([
		['GET', '/reset-password/untrusted-token?callbackURL=https%3A%2F%2Fbooks.example.com'],
		['POST', '/get-access-token'],
		['POST', '/refresh-token'],
		['GET', '/account-info'],
		['GET', '/list-accounts'],
		['POST', '/link-social'],
		['POST', '/unlink-account'],
		['POST', '/update-session'],
		['GET', '/list-sessions'],
		['POST', '/revoke-session'],
		['POST', '/revoke-sessions'],
		['POST', '/revoke-other-sessions']
	])('returns a generic not-found response for unused %s %s', async (method, path) => {
		const auth = betterAuth(createOptions());
		const response = await auth.handler(
			new Request(`${productionEnvironment.appOrigin}/api/auth${path}`, {
				method,
				headers: {
					'content-type': 'application/json',
					origin: productionEnvironment.appOrigin,
					'x-forwarded-for': '203.0.113.13'
				},
				...(method === 'POST' ? { body: '{}' } : {})
			})
		);
		const body = await response.text();

		expect(response.status).toBe(404);
		expect(body).toBe('Not Found');
		expect(response.headers.has('set-cookie')).toBe(false);
	});

	it('allows only the canonical origin', async () => {
		const auth = betterAuth(createOptions());

		const response = await auth.handler(
			signInRequest({ provider: 'google', disableRedirect: true }, 'https://evil.example.com')
		);

		expect(response.status).toBe(403);
		expect(response.headers.has('location')).toBe(false);
		expect(response.headers.has('set-cookie')).toBe(false);
	});

	it('allows the MariTools account callback pair', async () => {
		const auth = betterAuth(createOptions());
		const response = await auth.handler(
			signInRequest({
				provider: 'google',
				callbackURL: `${productionEnvironment.appOrigin}/tools/account`,
				errorCallbackURL: `${productionEnvironment.appOrigin}/tools/account?state=unavailable`,
				disableRedirect: true
			})
		);
		expect(response.status).toBeLessThan(400);
		expect((await response.json()).url).toContain('accounts.google.com');
	});

	it.each([
		['missing callback', { callbackURL: undefined }],
		['another internal callback', { callbackURL: `${productionEnvironment.appOrigin}/events` }],
		[
			'another internal error callback',
			{ errorCallbackURL: `${productionEnvironment.appOrigin}/staff/sign-in?state=reauthenticate` }
		],
		['external error callback', { errorCallbackURL: 'https://evil.example.com/error' }],
		['external callback', { callbackURL: 'https://evil.example.com/staff' }],
		['another provider', { provider: 'github' }],
		['redirecting handler response', { disableRedirect: false }],
		['client sign-up request', { requestSignUp: true }],
		['client login hint', { loginHint: ALLOWED_EMAIL }]
	])('rejects %s before OAuth state issuance', async (_case, override) => {
		const auth = betterAuth(createOptions());
		const response = await auth.handler(signInRequest({ provider: 'google', ...override }));
		expect(response.status).toBeGreaterThanOrEqual(400);
		expect(response.headers.has('location')).toBe(false);
		expect(response.headers.has('set-cookie')).toBe(false);
	});

	it('does not allow GET to initiate social sign-in', async () => {
		const auth = betterAuth(createOptions());
		const response = await auth.handler(
			new Request(`${productionEnvironment.appOrigin}/api/auth/sign-in/social`)
		);
		expect(response.status).toBeGreaterThanOrEqual(400);
		expect(response.headers.has('set-cookie')).toBe(false);
	});

	it('applies the production cookie contract and keeps loopback development usable', async () => {
		const productionAuth = betterAuth(createOptions());
		const { database } = createMemoryDatabase();
		const developmentAuth = betterAuth(
			createOptions({
				database,
				environment: {
					...productionEnvironment,
					appOrigin: 'http://127.0.0.1:5173',
					betterAuthOrigin: 'http://127.0.0.1:5173'
				}
			})
		);
		const productionContext = await productionAuth.$context;
		const developmentContext = await developmentAuth.$context;

		expect(productionContext.authCookies.sessionToken).toMatchObject({
			name: '__Secure-mari-staff.session_token',
			attributes: {
				secure: true,
				httpOnly: true,
				sameSite: 'lax',
				path: '/',
				maxAge: 28800
			}
		});
		expect(developmentContext.authCookies.sessionToken).toMatchObject({
			name: 'mari-staff.session_token',
			attributes: { secure: false, httpOnly: true, sameSite: 'lax', path: '/' }
		});
	});

	it('delegates Better Auth decisions to the injected durable storage without its raw database model', async () => {
		const consume = vi.fn(async () => ({ allowed: true, retryAfter: null }));
		const auth = betterAuth(createOptions({ rateLimitStorage: { consume } }));

		const response = await auth.handler(
			signInRequest({ provider: 'google', disableRedirect: true })
		);

		expect(response.status).toBe(200);
		expect(consume).toHaveBeenCalledWith(expect.any(String), { max: 3, window: 10 });
	});

	it('does not let ordinary forwarding headers partition the auth quota off Vercel', async () => {
		/** @type {{ key: string, rule: { max: number, window: number } }[]} */
		const consumed = [];
		const rateLimitStorage = {
			async consume(
				/** @type {string} */ key,
				/** @type {{ max: number, window: number }} */ rule
			) {
				consumed.push({ key, rule });
				return { allowed: true, retryAfter: null };
			}
		};
		const auth = betterAuth(
			createOptions({
				environment: { ...productionEnvironment, isVercel: false },
				rateLimitStorage
			})
		);

		for (const spoofedAddress of ['203.0.113.41', '198.51.100.92']) {
			const response = await auth.handler(
				signInRequest(
					{ provider: 'google', disableRedirect: true },
					productionEnvironment.appOrigin,
					{
						'x-forwarded-for': spoofedAddress,
						forwarded: `for=${spoofedAddress}`
					}
				)
			);
			expect(response.status).toBe(200);
		}

		const rawKeys = consumed.map(({ key }) => key);
		expect(rawKeys).toHaveLength(2);
		expect(new Set(rawKeys).size).toBe(1);
		expect(rawKeys.join('\n')).not.toContain('203.0.113.41');
		expect(rawKeys.join('\n')).not.toContain('198.51.100.92');
	});

	it('uses only the Vercel platform client header when the immutable deployment flag is set', async () => {
		/** @type {{ key: string, rule: { max: number, window: number } }[]} */
		const consumed = [];
		const rateLimitStorage = {
			async consume(
				/** @type {string} */ key,
				/** @type {{ max: number, window: number }} */ rule
			) {
				consumed.push({ key, rule });
				return { allowed: true, retryAfter: null };
			}
		};
		const auth = betterAuth(
			createOptions({
				environment: { ...productionEnvironment, isVercel: true },
				rateLimitStorage
			})
		);

		for (const [trustedAddress, spoofedAddress] of [
			['198.51.100.40', '203.0.113.41'],
			['198.51.100.41', '203.0.113.42']
		]) {
			const response = await auth.handler(
				signInRequest(
					{ provider: 'google', disableRedirect: true },
					productionEnvironment.appOrigin,
					{
						'x-forwarded-for': spoofedAddress,
						'x-vercel-forwarded-for': trustedAddress
					}
				)
			);
			expect(response.status).toBe(200);
		}

		expect(consumed.map(({ key }) => key)).toEqual([
			'198.51.100.40|/sign-in/social',
			'198.51.100.41|/sign-in/social'
		]);
	});

	it('fails closed with a generic error before OAuth issuance when rate-limit storage is unavailable', async () => {
		const auth = betterAuth(
			createOptions({
				rateLimitStorage: {
					consume: async () => {
						throw new RateLimitUnavailableError();
					}
				}
			})
		);

		let thrown;
		try {
			await auth.handler(signInRequest({ provider: 'google', disableRedirect: true }));
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(RateLimitUnavailableError);
		expect(thrown).toMatchObject({
			name: 'RateLimitUnavailableError',
			code: 'RATE_LIMIT_UNAVAILABLE',
			message: 'Rate limit service is unavailable'
		});
		expect(JSON.stringify(thrown)).not.toContain(productionEnvironment.betterAuthSecret);
	});

	it('redacts database failures at the Better Auth adapter boundary', async () => {
		const secretDatabaseError = new Error('secret SQL and credential detail');
		const memory = createMemoryDatabase({
			findOne: async () => {
				throw secretDatabaseError;
			}
		});
		const options = createOptions({ database: memory.database });
		if (typeof options.database !== 'function') {
			throw new TypeError('Database adapter is unavailable in test configuration');
		}
		const adapter = options.database(options);

		let thrown;
		try {
			await adapter.findOne({ model: 'session', where: [] });
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(AuthPersistenceUnavailableError);
		expect(thrown).toMatchObject({
			name: 'AuthPersistenceUnavailableError',
			code: 'AUTH_PERSISTENCE_UNAVAILABLE',
			message: 'Authentication service is unavailable'
		});
		expect(thrown).not.toBe(secretDatabaseError);
		expect(JSON.stringify(thrown)).not.toContain('secret');
	});
});
