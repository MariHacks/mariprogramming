// The generated SvelteKit declarations are outside this repository's JS include.
// @ts-ignore
import { env as privateEnvironment } from '$env/dynamic/private';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { sql } from 'drizzle-orm';
import { rateLimitBuckets } from '../db/schema';
import { withDatabaseTransaction } from '../db/transaction';

const RATE_LIMIT_DOMAINS = new Set([
	'auth_request',
	'checkout_email',
	'checkout_client_address',
	'staff_session',
	'staff_action',
	'book_request_email',
	'book_request_client_address'
]);
const RATE_LIMIT_VERSION_PATTERN = /^v[1-9][0-9]{0,2}$/u;
const RATE_LIMIT_BUCKET_PATTERN =
	/^rl:v[1-9][0-9]{0,2}:(auth_request|checkout_email|checkout_client_address|staff_session|staff_action|book_request_email|book_request_client_address):[A-Za-z0-9_-]{43}$/u;
const STAFF_ACTION_PATTERN = /^[a-z][a-z0-9_]{0,79}$/u;
const MAX_HMAC_KEY_LENGTH = 2048;
const MAX_SUBJECT_LENGTH = 2048;
const MAX_SESSION_ID_LENGTH = 512;
const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_LIMIT = 1000000;
const ANONYMOUS_CLIENT_SUBJECT = 'anonymous';
const BETTER_AUTH_NO_TRUSTED_IP = 'no-trusted-ip';
const BETTER_AUTH_FALLBACK_PATH = '/__unmatched__';
const MAX_BETTER_AUTH_PATH_LENGTH = 2048;

export const RATE_LIMIT_POLICIES = Object.freeze({
	auth_request: Object.freeze({ limit: 100, windowMs: 60 * 1000 }),
	checkout_email: Object.freeze({ limit: 10, windowMs: 15 * 60 * 1000 }),
	checkout_client_address: Object.freeze({ limit: 60, windowMs: 60 * 60 * 1000 }),
	staff_session: Object.freeze({ limit: 60, windowMs: 60 * 1000 }),
	staff_action: Object.freeze({ limit: 60, windowMs: 60 * 1000 }),
	book_request_email: Object.freeze({ limit: 10, windowMs: 15 * 60 * 1000 }),
	book_request_client_address: Object.freeze({ limit: 60, windowMs: 60 * 60 * 1000 })
});

export const AUTH_RATE_LIMIT_RULES = Object.freeze([
	Object.freeze({ limit: 3, windowMs: 10 * 1000 }),
	RATE_LIMIT_POLICIES.auth_request
]);

const BETTER_AUTH_INITIATION_PATH = '/sign-in/social';
const BETTER_AUTH_DEFAULT_PATHS = new Set([
	'/callback/google',
	'/error',
	'/get-session',
	'/ok',
	'/sign-out'
]);

export class RateLimitInputError extends Error {
	constructor() {
		super('Rate limit input is invalid');
		this.name = 'RateLimitInputError';
		this.code = 'RATE_LIMIT_INPUT_INVALID';
	}
}

export class RateLimitUnavailableError extends Error {
	/** @param {unknown} [cause] */
	constructor(cause) {
		super('Rate limit service is unavailable', cause === undefined ? undefined : { cause });
		this.name = 'RateLimitUnavailableError';
		this.code = 'RATE_LIMIT_UNAVAILABLE';
	}
}

/** @returns {never} */
function invalidInput() {
	throw new RateLimitInputError();
}

/** @param {unknown} [cause] @returns {never} */
function unavailable(cause) {
	throw new RateLimitUnavailableError(cause);
}

/** @param {unknown} value @param {number} maximum */
function boundedOpaqueSubject(value, maximum) {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > maximum ||
		value !== value.trim() ||
		value.includes('\0') ||
		value.includes('\r') ||
		value.includes('\n')
	) {
		return invalidInput();
	}
	return value;
}

/**
 * Mirrors the checkout/auth normalization contract without interpreting email aliases.
 * @param {unknown} value
 */
export function normalizeRateLimitEmail(value) {
	if (typeof value !== 'string') return invalidInput();
	const normalized = value.trim().toLowerCase();
	if (
		normalized.length === 0 ||
		normalized.length > 320 ||
		normalized.includes('\0') ||
		normalized.includes('\r') ||
		normalized.includes('\n')
	) {
		return invalidInput();
	}
	return normalized;
}

/**
 * @param {{ hmacKey: unknown, version?: unknown, domain: unknown, subject: unknown }} options
 */
export function deriveRateLimitBucketKey({ hmacKey, version = 'v1', domain, subject }) {
	if (
		typeof hmacKey !== 'string' ||
		hmacKey.length < 32 ||
		hmacKey.length > MAX_HMAC_KEY_LENGTH ||
		hmacKey !== hmacKey.trim() ||
		typeof version !== 'string' ||
		!RATE_LIMIT_VERSION_PATTERN.test(version) ||
		typeof domain !== 'string' ||
		!RATE_LIMIT_DOMAINS.has(domain) ||
		typeof subject !== 'string' ||
		subject.length === 0 ||
		subject.length > MAX_SUBJECT_LENGTH
	) {
		return invalidInput();
	}

	const digest = createHmac('sha256', hmacKey)
		.update(`rate-limit\0${version}\0${domain}\0${subject}`)
		.digest('base64url');
	return `rl:${version}:${domain}:${digest}`;
}

/** @param {unknown} email @param {{ hmacKey: unknown, version?: unknown }} options */
export function createCheckoutEmailBucketKey(email, { hmacKey, version = 'v1' }) {
	return deriveRateLimitBucketKey({
		hmacKey,
		version,
		domain: 'checkout_email',
		subject: normalizeRateLimitEmail(email)
	});
}

/**
 * Vercel documents this platform header as its copy of the client address. We use it only when
 * the immutable deployment environment confirms Vercel, reject lists, and ignore ordinary
 * forwarding headers. See https://vercel.com/docs/headers/request-headers.
 *
 * @param {unknown} requestHeaders
 * @param {unknown} [environment]
 * @returns {string | null}
 */
export function extractTrustedVercelClientAddress(
	requestHeaders,
	environment = privateEnvironment
) {
	if (
		environment === null ||
		typeof environment !== 'object' ||
		Array.isArray(environment) ||
		/** @type {Record<string, unknown>} */ (environment).VERCEL !== '1' ||
		requestHeaders === null ||
		typeof requestHeaders !== 'object' ||
		typeof (/** @type {{ get?: unknown }} */ (requestHeaders).get) !== 'function'
	) {
		return null;
	}

	let value;
	try {
		value = /** @type {{ get: (name: string) => unknown }} */ (requestHeaders).get(
			'x-vercel-forwarded-for'
		);
	} catch {
		return null;
	}

	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value !== value.trim() ||
		value.includes(',') ||
		isIP(value) === 0
	) {
		return null;
	}
	return value.toLowerCase();
}

/**
 * @param {unknown} requestHeaders
 * @param {{ hmacKey: unknown, version?: unknown, environment?: unknown }} options
 */
export function createCheckoutClientAddressBucketKey(
	requestHeaders,
	{ hmacKey, version = 'v1', environment = privateEnvironment }
) {
	const address = extractTrustedVercelClientAddress(requestHeaders, environment);
	return deriveRateLimitBucketKey({
		hmacKey,
		version,
		domain: 'checkout_client_address',
		subject: address ?? ANONYMOUS_CLIENT_SUBJECT
	});
}

/** @param {unknown} email @param {{ hmacKey: unknown, version?: unknown }} options */
export function createBookRequestEmailBucketKey(email, { hmacKey, version = 'v1' }) {
	return deriveRateLimitBucketKey({
		hmacKey,
		version,
		domain: 'book_request_email',
		subject: normalizeRateLimitEmail(email)
	});
}

/**
 * @param {unknown} requestHeaders
 * @param {{ hmacKey: unknown, version?: unknown, environment?: unknown }} options
 */
export function createBookRequestClientAddressBucketKey(
	requestHeaders,
	{ hmacKey, version = 'v1', environment = privateEnvironment }
) {
	const address = extractTrustedVercelClientAddress(requestHeaders, environment);
	return deriveRateLimitBucketKey({
		hmacKey,
		version,
		domain: 'book_request_client_address',
		subject: address ?? ANONYMOUS_CLIENT_SUBJECT
	});
}

/** @param {unknown} sessionId @param {{ hmacKey: unknown, version?: unknown }} options */
export function createStaffSessionBucketKey(sessionId, { hmacKey, version = 'v1' }) {
	return deriveRateLimitBucketKey({
		hmacKey,
		version,
		domain: 'staff_session',
		subject: boundedOpaqueSubject(sessionId, MAX_SESSION_ID_LENGTH)
	});
}

/**
 * @param {{ sessionId: unknown, action: unknown }} subject
 * @param {{ hmacKey: unknown, version?: unknown }} options
 */
export function createStaffActionBucketKey({ sessionId, action }, { hmacKey, version = 'v1' }) {
	const normalizedSessionId = boundedOpaqueSubject(sessionId, MAX_SESSION_ID_LENGTH);
	if (typeof action !== 'string' || !STAFF_ACTION_PATTERN.test(action)) return invalidInput();
	return deriveRateLimitBucketKey({
		hmacKey,
		version,
		domain: 'staff_action',
		subject: JSON.stringify([normalizedSessionId, action])
	});
}

/** @param {unknown} rawRule */
function approvedBetterAuthRule(rawRule) {
	if (rawRule === null || typeof rawRule !== 'object' || Array.isArray(rawRule)) {
		return invalidInput();
	}
	const { max, window } = /** @type {{ max?: unknown, window?: unknown }} */ (rawRule);
	if (!Number.isSafeInteger(max) || !Number.isSafeInteger(window)) return invalidInput();
	const rule = AUTH_RATE_LIMIT_RULES.find(
		(candidate) =>
			candidate.limit === max && candidate.windowMs === /** @type {number} */ (window) * 1000
	);
	return rule ?? invalidInput();
}

/**
 * Better Auth runs its limiter before route matching and includes the request path in its raw key.
 * Preserve fixed, enabled auth routes while collapsing every unknown shape to one stricter bucket
 * per trusted client so invalid paths cannot create an unbounded durable keyspace.
 *
 * @param {unknown} rawKey
 * @param {unknown} rawRule
 */
function canonicalBetterAuthRateLimitRequest(rawKey, rawRule) {
	if (typeof rawKey !== 'string') return invalidInput();
	const separator = rawKey.indexOf('|');
	if (separator < 1) return invalidInput();
	const client = rawKey.slice(0, separator);
	const path = rawKey.slice(separator + 1);
	if (
		(client !== BETTER_AUTH_NO_TRUSTED_IP && isIP(client) === 0) ||
		path.length === 0 ||
		path.length > MAX_BETTER_AUTH_PATH_LENGTH ||
		!path.startsWith('/') ||
		path.includes('\0') ||
		path.includes('\r') ||
		path.includes('\n')
	) {
		return invalidInput();
	}

	const requestedRule = approvedBetterAuthRule(rawRule);
	if (path === BETTER_AUTH_INITIATION_PATH) {
		if (requestedRule !== AUTH_RATE_LIMIT_RULES[0]) return invalidInput();
		return { subject: rawKey, rule: requestedRule };
	}
	if (BETTER_AUTH_DEFAULT_PATHS.has(path)) {
		if (requestedRule !== AUTH_RATE_LIMIT_RULES[1]) return invalidInput();
		return { subject: rawKey, rule: requestedRule };
	}
	return {
		subject: `${client}|${BETTER_AUTH_FALLBACK_PATH}`,
		rule: AUTH_RATE_LIMIT_RULES[0]
	};
}

/** @param {unknown} options */
function validateConsumptionOptions(options) {
	if (options === null || typeof options !== 'object' || Array.isArray(options)) {
		return invalidInput();
	}
	const { bucketKey, scope, limit, windowMs, now = new Date() } = /** @type {any} */ (options);
	const bucketMatch =
		typeof bucketKey === 'string' ? RATE_LIMIT_BUCKET_PATTERN.exec(bucketKey) : null;
	const policies =
		scope === 'auth_request'
			? AUTH_RATE_LIMIT_RULES
			: typeof scope === 'string' && RATE_LIMIT_DOMAINS.has(scope)
				? [
						/** @type {Record<string, { limit: number, windowMs: number }>} */ (
							RATE_LIMIT_POLICIES
						)[scope]
					]
				: [];
	const policy = policies.find(
		(candidate) => candidate?.limit === limit && candidate.windowMs === windowMs
	);
	if (
		!bucketMatch ||
		bucketMatch[1] !== scope ||
		!policy ||
		!Number.isSafeInteger(limit) ||
		limit < 1 ||
		limit > MAX_LIMIT ||
		!Number.isSafeInteger(windowMs) ||
		windowMs < 1 ||
		windowMs > MAX_WINDOW_MS ||
		!(now instanceof Date) ||
		!Number.isFinite(now.getTime())
	) {
		return invalidInput();
	}
	return { bucketKey, scope, limit, windowMs, now };
}

/**
 * Better Auth derives a request key before delegating storage. This adapter immediately applies
 * the application's versioned HMAC and stores only the digest in the shared bounded table.
 *
 * @param {unknown} database
 * @param {{ hmacKey: unknown, now?: () => Date }} options
 */
export function createBetterAuthRateLimitStorage(database, { hmacKey, now = () => new Date() }) {
	if (
		database === null ||
		typeof database !== 'object' ||
		typeof (/** @type {{ execute?: unknown }} */ (database).execute) !== 'function' ||
		typeof now !== 'function'
	) {
		return invalidInput();
	}
	deriveRateLimitBucketKey({ hmacKey, domain: 'auth_request', subject: 'configuration-check' });

	return Object.freeze({
		async get() {
			return unavailable();
		},
		async set() {
			return unavailable();
		},
		/** @param {unknown} rawKey @param {unknown} rawRule */
		async consume(rawKey, rawRule) {
			const { subject, rule } = canonicalBetterAuthRateLimitRequest(rawKey, rawRule);
			const bucketKey = deriveRateLimitBucketKey({
				hmacKey,
				domain: 'auth_request',
				subject
			});
			const result = await consumeRateLimitInTransaction(database, {
				bucketKey,
				scope: 'auth_request',
				...rule,
				now: now()
			});
			return Object.freeze({
				allowed: result.allowed,
				retryAfter: result.allowed ? null : result.retryAfterSeconds
			});
		}
	});
}

/** @param {unknown} value */
function parseReturnedDate(value) {
	if (!(typeof value === 'string' || value instanceof Date)) return unavailable();
	const parsed = new Date(value);
	if (!Number.isFinite(parsed.getTime())) return unavailable();
	return parsed;
}

/**
 * Consumes one fixed-window slot on an existing transaction connection. PostgreSQL serializes
 * conflicting upserts on the primary key, so every concurrent request receives a distinct count.
 *
 * @param {unknown} transaction
 * @param {unknown} options
 */
export async function consumeRateLimitInTransaction(transaction, options) {
	if (
		transaction === null ||
		typeof transaction !== 'object' ||
		typeof (/** @type {{ execute?: unknown }} */ (transaction).execute) !== 'function'
	) {
		return invalidInput();
	}
	const { bucketKey, scope, limit, windowMs, now } = validateConsumptionOptions(options);
	const expiresAt = new Date(now.getTime() + windowMs);

	try {
		const query = sql`insert into ${rateLimitBuckets} ("bucket_key", "scope", "count", "window_started_at", "expires_at", "version", "created_at", "updated_at")
			values (${bucketKey}, ${scope}, ${1}, ${now}, ${expiresAt}, ${1}, ${now}, ${now})
			on conflict ("bucket_key") do update set
				"count" = case when ${rateLimitBuckets.expiresAt} <= ${now} then 1 else ${rateLimitBuckets.count} + 1 end,
				"window_started_at" = case when ${rateLimitBuckets.expiresAt} <= ${now} then ${now} else ${rateLimitBuckets.windowStartedAt} end,
				"expires_at" = case when ${rateLimitBuckets.expiresAt} <= ${now} then ${expiresAt} else ${rateLimitBuckets.expiresAt} end,
				"version" = ${rateLimitBuckets.version} + 1,
				"updated_at" = ${now}
			where ${rateLimitBuckets.scope} = ${scope}
			returning "count", "window_started_at", "expires_at"`;
		const result = await /** @type {{ execute: (query: unknown) => Promise<unknown> }} */ (
			transaction
		).execute(query);
		const rows =
			result !== null &&
			typeof result === 'object' &&
			Array.isArray(/** @type {{ rows?: unknown }} */ (result).rows)
				? /** @type {{ rows: unknown[] }} */ (result).rows
				: [];
		if (rows.length !== 1 || rows[0] === null || typeof rows[0] !== 'object') unavailable();
		const row = /** @type {Record<string, unknown>} */ (rows[0]);
		const count = row.count;
		const windowStartedAt = parseReturnedDate(row.window_started_at);
		const returnedExpiresAt = parseReturnedDate(row.expires_at);
		const nowTime = now.getTime();
		const windowStartedTime = windowStartedAt.getTime();
		const returnedExpiresTime = returnedExpiresAt.getTime();
		if (
			!Number.isSafeInteger(count) ||
			/** @type {number} */ (count) < 1 ||
			windowStartedTime > nowTime ||
			returnedExpiresTime - windowStartedTime !== windowMs ||
			returnedExpiresTime <= nowTime ||
			returnedExpiresTime > nowTime + windowMs
		) {
			unavailable();
		}

		const used = /** @type {number} */ (count);
		const allowed = used <= limit;
		return Object.freeze({
			allowed,
			limit,
			used,
			remaining: Math.max(0, limit - used),
			resetAt: returnedExpiresAt.toISOString(),
			retryAfterSeconds: allowed
				? 0
				: Math.max(1, Math.ceil((returnedExpiresTime - nowTime) / 1000))
		});
	} catch (error) {
		if (error instanceof RateLimitUnavailableError) throw error;
		return unavailable(error);
	}
}

/**
 * Opens one request-scoped transaction around the same primitive for callers that do not already
 * hold the order/staff mutation transaction.
 *
 * @param {unknown} options
 * @param {{ databaseUrl: unknown, withTransaction?: typeof withDatabaseTransaction }} runtime
 */
export async function consumeRateLimit(
	options,
	{ databaseUrl, withTransaction = withDatabaseTransaction }
) {
	if (
		typeof databaseUrl !== 'string' ||
		databaseUrl.length === 0 ||
		databaseUrl !== databaseUrl.trim() ||
		typeof withTransaction !== 'function'
	) {
		return invalidInput();
	}

	try {
		return await withTransaction(
			(transaction) => consumeRateLimitInTransaction(transaction, options),
			{ databaseUrl }
		);
	} catch (error) {
		if (error instanceof RateLimitInputError || error instanceof RateLimitUnavailableError) {
			throw error;
		}
		return unavailable(error);
	}
}
