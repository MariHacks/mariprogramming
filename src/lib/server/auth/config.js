import { APIError, createAuthMiddleware } from 'better-auth/api';

const ALLOWED_GOOGLE_EMAIL = 'team@marihacks.com';
const AUTH_CONFIGURATION_ERROR = 'Authentication configuration is invalid';
const BASIC_GOOGLE_SCOPES = Object.freeze(['email', 'openid', 'profile']);
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const MAX_PROFILE_FIELD_LENGTH = 255;
const MAX_PROFILE_IMAGE_LENGTH = 2048;
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

const DISABLED_AUTH_PATHS = Object.freeze([
	'/sign-up/email',
	'/sign-in/email',
	'/request-password-reset',
	'/reset-password',
	'/verify-password',
	'/change-password',
	'/update-user',
	'/change-email',
	'/delete-user',
	'/delete-user/callback',
	'/link-social',
	'/unlink-account',
	'/send-verification-email',
	'/verify-email',
	'/set-password',
	'/get-access-token',
	'/refresh-token',
	'/account-info',
	'/list-accounts',
	'/update-session',
	'/list-sessions',
	'/revoke-session',
	'/revoke-sessions',
	'/revoke-other-sessions'
]);
const DENIED_AUTH_ENDPOINTS = new Set([...DISABLED_AUTH_PATHS, '/reset-password/:token']);

export class AuthProviderUnavailableError extends Error {
	constructor() {
		super('Identity provider is unavailable');
		this.name = 'AuthProviderUnavailableError';
		this.code = 'AUTH_PROVIDER_UNAVAILABLE';
	}
}

export class AuthPersistenceUnavailableError extends Error {
	constructor() {
		super('Authentication service is unavailable');
		this.name = 'AuthPersistenceUnavailableError';
		this.code = 'AUTH_PERSISTENCE_UNAVAILABLE';
	}
}

/**
 * Prevents adapter details, SQL text, and credentials from crossing the auth boundary while
 * preserving the adapter's supported method surface.
 *
 * @param {import('better-auth').DBAdapterInstance} database
 * @returns {import('better-auth').DBAdapterInstance}
 */
function sanitizeDatabaseAdapter(database) {
	/** @param {import('better-auth').BetterAuthOptions} options */
	function createSanitizedAdapter(options) {
		const adapter = database(options);
		return new Proxy(adapter, {
			get(target, property, receiver) {
				const value = Reflect.get(target, property, receiver);
				if (typeof value !== 'function') {
					return value;
				}

				return async function () {
					try {
						return await Reflect.apply(value, target, arguments);
					} catch {
						throw new AuthPersistenceUnavailableError();
					}
				};
			}
		});
	}

	return createSanitizedAdapter;
}

/**
 * @param {string} canonicalOrigin
 */
function createAuthBoundaryHook(canonicalOrigin) {
	return createAuthMiddleware(async (context) => {
		if (DENIED_AUTH_ENDPOINTS.has(context.path)) {
			return new Response('Not Found', { status: 404 });
		}

		if (context.path !== '/sign-in/social') {
			return;
		}

		const body = context.body;
		if (
			context.headers?.get('origin') !== canonicalOrigin ||
			body?.provider !== 'google' ||
			body?.callbackURL !== `${canonicalOrigin}/staff` ||
			body?.errorCallbackURL !== `${canonicalOrigin}/staff/sign-in?state=unavailable` ||
			body?.disableRedirect !== true ||
			body?.scopes !== undefined ||
			body?.idToken !== undefined ||
			body?.newUserCallbackURL !== undefined ||
			body?.requestSignUp !== undefined ||
			body?.loginHint !== undefined ||
			body?.additionalData !== undefined
		) {
			throw new APIError('FORBIDDEN', {
				code: 'AUTH_ORIGIN_INVALID',
				message: 'Authentication request is invalid'
			});
		}
	});
}

async function discardProviderTokens() {
	return {
		data: {
			accessToken: null,
			refreshToken: null,
			idToken: null,
			accessTokenExpiresAt: null,
			refreshTokenExpiresAt: null
		}
	};
}

/**
 * @param {string} accessToken
 * @returns {Promise<unknown>}
 */
async function requestGoogleProfile(accessToken) {
	const response = await fetch(GOOGLE_USERINFO_URL, {
		headers: { authorization: `Bearer ${accessToken}` },
		signal: AbortSignal.timeout(5000)
	});

	if (!response.ok) {
		throw new AuthProviderUnavailableError();
	}

	return response.json();
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {unknown} value
 */
function boundedName(value) {
	if (typeof value !== 'string') {
		return ALLOWED_GOOGLE_EMAIL;
	}

	return value.trim().slice(0, MAX_PROFILE_FIELD_LENGTH) || ALLOWED_GOOGLE_EMAIL;
}

/**
 * @param {unknown} value
 */
function boundedHttpsImage(value) {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > MAX_PROFILE_IMAGE_LENGTH ||
		value !== value.trim()
	) {
		return undefined;
	}

	try {
		const image = new URL(value);
		return image.protocol === 'https:' ? image.toString() : undefined;
	} catch {
		return undefined;
	}
}

/**
 * @param {unknown} profile
 */
function admitGoogleProfile(profile) {
	if (!isRecord(profile)) {
		return null;
	}

	const { sub, email, email_verified: emailVerified } = profile;
	if (
		typeof sub !== 'string' ||
		sub.length === 0 ||
		sub.length > MAX_PROFILE_FIELD_LENGTH ||
		sub !== sub.trim() ||
		typeof email !== 'string' ||
		emailVerified !== true ||
		email.trim().toLowerCase() !== ALLOWED_GOOGLE_EMAIL
	) {
		return null;
	}

	const image = boundedHttpsImage(profile.picture);
	return {
		user: {
			id: sub,
			name: boundedName(profile.name),
			email: ALLOWED_GOOGLE_EMAIL,
			emailVerified: true,
			...(image ? { image } : {})
		},
		data: {
			sub,
			email: ALLOWED_GOOGLE_EMAIL,
			email_verified: true
		}
	};
}

/**
 * @typedef {{
 *   appOrigin: string,
 *   betterAuthOrigin: string,
 *   betterAuthSecret: string,
 *   googleClientId: string,
 *   googleClientSecret: string,
 *   isVercel?: boolean
 * }} AuthEnvironment
 */

/**
 * Creates the exact Better Auth options shared by runtime initialization, tests, and schema
 * generation. The database adapter is injected because WU2 owns the final Drizzle database.
 *
 * @param {{
 *   database: import('better-auth').DBAdapterInstance,
 *   environment: AuthEnvironment,
 *   rateLimitStorage: { consume: (key: string, rule: { max: number, window: number }) => Promise<{ allowed: boolean, retryAfter: number | null }> },
 *   fetchGoogleProfile?: (accessToken: string) => Promise<unknown>
 * }} dependencies
 * @returns {import('better-auth').BetterAuthOptions}
 */
export function createBetterAuthOptions({
	database,
	environment,
	rateLimitStorage,
	fetchGoogleProfile = requestGoogleProfile
}) {
	if (
		typeof database !== 'function' ||
		!isRecord(environment) ||
		!isRecord(rateLimitStorage) ||
		typeof rateLimitStorage.consume !== 'function' ||
		typeof fetchGoogleProfile !== 'function'
	) {
		throw new TypeError(AUTH_CONFIGURATION_ERROR);
	}

	const secureCookies = new URL(environment.appOrigin).protocol === 'https:';

	return {
		appName: 'Marianopolis Programming Club Staff',
		baseURL: environment.betterAuthOrigin,
		basePath: '/api/auth',
		secret: environment.betterAuthSecret,
		database: sanitizeDatabaseAdapter(database),
		trustedOrigins: [environment.appOrigin],
		socialProviders: {
			google: {
				clientId: environment.googleClientId,
				clientSecret: environment.googleClientSecret,
				disableIdTokenSignIn: true,
				disableDefaultScope: true,
				scope: [...BASIC_GOOGLE_SCOPES],
				accessType: 'online',
				async getUserInfo(tokens) {
					if (typeof tokens.accessToken !== 'string' || tokens.accessToken.length === 0) {
						return null;
					}

					try {
						return admitGoogleProfile(await fetchGoogleProfile(tokens.accessToken));
					} catch {
						throw new AuthProviderUnavailableError();
					}
				}
			}
		},
		plugins: [],
		disabledPaths: [...DISABLED_AUTH_PATHS],
		hooks: { before: createAuthBoundaryHook(environment.appOrigin) },
		databaseHooks: {
			account: {
				create: { before: discardProviderTokens },
				update: { before: discardProviderTokens }
			}
		},
		account: {
			encryptOAuthTokens: true,
			storeStateStrategy: 'database',
			storeAccountCookie: false
		},
		session: {
			expiresIn: SESSION_MAX_AGE_SECONDS,
			disableSessionRefresh: true,
			cookieCache: { enabled: false }
		},
		rateLimit: {
			enabled: true,
			window: 60,
			max: 100,
			customStorage:
				/** @type {NonNullable<NonNullable<import('better-auth').BetterAuthOptions['rateLimit']>['customStorage']>} */ (
					rateLimitStorage
				)
		},
		advanced: {
			cookiePrefix: 'mari-staff',
			useSecureCookies: secureCookies,
			ipAddress: {
				ipAddressHeaders: environment.isVercel === true ? ['x-vercel-forwarded-for'] : []
			},
			disableCSRFCheck: false,
			disableOriginCheck: false,
			defaultCookieAttributes: {
				httpOnly: true,
				secure: secureCookies,
				sameSite: 'lax',
				path: '/'
			}
		},
		telemetry: { enabled: false, debug: false },
		logger: { disabled: true }
	};
}
