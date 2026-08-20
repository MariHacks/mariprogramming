// @vitest-environment node

import { createHmac } from 'node:crypto';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import {
	AUTH_RATE_LIMIT_RULES,
	RATE_LIMIT_POLICIES,
	RateLimitInputError,
	RateLimitUnavailableError,
	consumeRateLimit,
	consumeRateLimitInTransaction,
	createBetterAuthRateLimitStorage,
	createCheckoutClientAddressBucketKey,
	createCheckoutEmailBucketKey,
	createStaffActionBucketKey,
	createStaffSessionBucketKey,
	createBookRequestClientAddressBucketKey,
	createBookRequestEmailBucketKey,
	deriveRateLimitBucketKey,
	extractTrustedVercelClientAddress,
	normalizeRateLimitEmail
} from './rate-limit.js';

const HMAC_KEY = 'rate-limit-test-key-that-is-longer-than-thirty-two-characters';
const OTHER_HMAC_KEY = 'rotated-rate-limit-key-that-is-also-long-enough';
const NOW = new Date('2026-08-13T14:00:00.000Z');

/** @param {Record<string, string>} values */
function headers(values) {
	return new Headers(values);
}

/** @param {number} count @param {Date} [startedAt] @param {Date} [expiresAt] */
function transactionReturning(
	count,
	startedAt = NOW,
	expiresAt = new Date(NOW.getTime() + 15 * 60 * 1000)
) {
	return {
		execute: vi.fn(async () => ({
			rows: [
				{
					count,
					window_started_at: startedAt.toISOString(),
					expires_at: expiresAt.toISOString()
				}
			]
		}))
	};
}

describe('rate-limit identifiers', () => {
	it.each([
		[' Student@Example.COM ', 'student@example.com'],
		['TEAM@MARIHACKS.COM', 'team@marihacks.com'],
		['mixed.Case+tag@example.com', 'mixed.case+tag@example.com']
	])('normalizes %j exactly once before hashing', (input, expected) => {
		expect(normalizeRateLimitEmail(input)).toBe(expected);
	});

	it.each([null, '', '   ', `a@${'b'.repeat(319)}`, 'line\nbreak@example.com'])(
		'rejects invalid normalization input without echoing it: %j',
		(input) => {
			let thrown;
			try {
				normalizeRateLimitEmail(input);
			} catch (error) {
				thrown = error;
			}

			expect(thrown).toBeInstanceOf(RateLimitInputError);
			expect(thrown).toMatchObject({
				code: 'RATE_LIMIT_INPUT_INVALID',
				message: 'Rate limit input is invalid'
			});
			if (String(input).length > 0) {
				expect(JSON.stringify(thrown)).not.toContain(String(input));
			}
		}
	);

	it('uses a versioned, domain-separated HMAC without exposing its subject', () => {
		const subject = 'student@example.com';
		const expectedDigest = createHmac('sha256', HMAC_KEY)
			.update('rate-limit\0v1\0checkout_email\0student@example.com')
			.digest('base64url');

		const bucketKey = deriveRateLimitBucketKey({
			hmacKey: HMAC_KEY,
			version: 'v1',
			domain: 'checkout_email',
			subject
		});

		expect(bucketKey).toBe(`rl:v1:checkout_email:${expectedDigest}`);
		expect(bucketKey).not.toContain(subject);
		expect(bucketKey).not.toContain(HMAC_KEY);
	});

	it('separates domains and changes output for both key and version rotation', () => {
		const base = {
			hmacKey: HMAC_KEY,
			version: 'v1',
			domain: 'checkout_email',
			subject: 'same-subject'
		};
		const original = deriveRateLimitBucketKey(base);

		expect(
			new Set([
				original,
				deriveRateLimitBucketKey({ ...base, domain: 'checkout_client_address' }),
				deriveRateLimitBucketKey({ ...base, version: 'v2' }),
				deriveRateLimitBucketKey({ ...base, hmacKey: OTHER_HMAC_KEY })
			]).size
		).toBe(4);
		expect(deriveRateLimitBucketKey({ ...base, version: 'v2' })).toMatch(
			/^rl:v2:checkout_email:[A-Za-z0-9_-]{43}$/u
		);
	});

	it.each([
		{ hmacKey: 'short', version: 'v1', domain: 'checkout_email', subject: 'value' },
		{ hmacKey: HMAC_KEY, version: '1', domain: 'checkout_email', subject: 'value' },
		{ hmacKey: HMAC_KEY, version: 'v1', domain: 'unknown', subject: 'value' },
		{ hmacKey: HMAC_KEY, version: 'v1', domain: 'checkout_email', subject: '' },
		{ hmacKey: HMAC_KEY, version: 'v1', domain: 'checkout_email', subject: 'x'.repeat(2049) }
	])('rejects malformed derivation options with one generic error', (options) => {
		expect(() => deriveRateLimitBucketKey(options)).toThrow(RateLimitInputError);
	});

	it('derives normalized checkout, session, and action keys in distinct domains', () => {
		const emailKey = createCheckoutEmailBucketKey(' Student@Example.com ', {
			hmacKey: HMAC_KEY
		});
		const sessionKey = createStaffSessionBucketKey('opaque-session-value', {
			hmacKey: HMAC_KEY
		});
		const actionKey = createStaffActionBucketKey(
			{ sessionId: 'opaque-session-value', action: 'order_mark_received' },
			{ hmacKey: HMAC_KEY }
		);

		expect(emailKey).toMatch(/^rl:v1:checkout_email:/u);
		expect(sessionKey).toMatch(/^rl:v1:staff_session:/u);
		expect(actionKey).toMatch(/^rl:v1:staff_action:/u);
		expect(new Set([emailKey, sessionKey, actionKey]).size).toBe(3);
		expect(emailKey + sessionKey + actionKey).not.toContain('opaque-session-value');
		expect(emailKey).toBe(
			createCheckoutEmailBucketKey('student@example.COM', { hmacKey: HMAC_KEY })
		);
	});

	it('derives book-request email and client-address keys in distinct domains', () => {
		const emailKey = createBookRequestEmailBucketKey(' Student@Example.com ', {
			hmacKey: HMAC_KEY
		});
		const addressKey = createBookRequestClientAddressBucketKey(headers({}), {
			hmacKey: HMAC_KEY
		});
		expect(emailKey).toMatch(/^rl:v1:book_request_email:/u);
		expect(addressKey).toMatch(/^rl:v1:book_request_client_address:/u);
		expect(emailKey).not.toBe(
			createCheckoutEmailBucketKey('student@example.com', { hmacKey: HMAC_KEY })
		);
		expect(emailKey).toBe(
			createBookRequestEmailBucketKey('student@example.COM', { hmacKey: HMAC_KEY })
		);
	});

	it('publishes only the two Better Auth rules used by the configured auth surface', () => {
		expect(AUTH_RATE_LIMIT_RULES).toEqual([
			{ limit: 3, windowMs: 10000 },
			{ limit: 100, windowMs: 60000 }
		]);
		expect(Object.isFrozen(AUTH_RATE_LIMIT_RULES)).toBe(true);
		for (const rule of AUTH_RATE_LIMIT_RULES) expect(Object.isFrozen(rule)).toBe(true);
	});

	it.each([
		[() => createStaffSessionBucketKey('', { hmacKey: HMAC_KEY })],
		[
			() =>
				createStaffActionBucketKey(
					{ sessionId: 'session', action: 'attacker supplied value' },
					{ hmacKey: HMAC_KEY }
				)
		],
		[
			() =>
				createStaffActionBucketKey(
					{ sessionId: 'session', action: `order_${'a'.repeat(80)}` },
					{ hmacKey: HMAC_KEY }
				)
		]
	])('rejects unsafe staff subjects and action codes', (operation) => {
		expect(operation).toThrow(RateLimitInputError);
	});

	it('publishes the exact approved fixed-window policies as immutable values', () => {
		expect(RATE_LIMIT_POLICIES).toEqual({
			auth_request: { limit: 100, windowMs: 60 * 1000 },
			checkout_email: { limit: 10, windowMs: 15 * 60 * 1000 },
			checkout_client_address: { limit: 60, windowMs: 60 * 60 * 1000 },
			staff_session: { limit: 60, windowMs: 60 * 1000 },
			staff_action: { limit: 60, windowMs: 60 * 1000 },
			book_request_email: { limit: 10, windowMs: 15 * 60 * 1000 },
			book_request_client_address: { limit: 60, windowMs: 60 * 60 * 1000 }
		});
		for (const policy of Object.values(RATE_LIMIT_POLICIES)) {
			expect(Object.isFrozen(policy)).toBe(true);
		}
		try {
			/** @type {any} */ (RATE_LIMIT_POLICIES.checkout_email).limit = 999;
		} catch {
			// ES modules are strict; either a thrown assignment or retained value proves immutability.
		}
		expect(RATE_LIMIT_POLICIES.checkout_email.limit).toBe(10);
	});
});

describe('Better Auth durable rate-limit storage', () => {
	it.each([
		['missing database', null, { hmacKey: HMAC_KEY, now: () => NOW }],
		['database without execute', {}, { hmacKey: HMAC_KEY, now: () => NOW }],
		['short HMAC key', { execute: vi.fn() }, { hmacKey: 'short', now: () => NOW }],
		['invalid clock', { execute: vi.fn() }, { hmacKey: HMAC_KEY, now: null }]
	])('rejects %s before creating auth storage', (_label, database, options) => {
		expect(() => createBetterAuthRateLimitStorage(database, /** @type {any} */ (options))).toThrow(
			RateLimitInputError
		);
	});

	it.each([
		['203.0.113.10|/sign-in/social', { max: 3, window: 10 }, 10000],
		['203.0.113.10|/callback/google', { max: 100, window: 60 }, 60000],
		['no-trusted-ip|/get-session', { max: 100, window: 60 }, 60000]
	])('HMACs %s before one atomic durable consume', async (rawKey, rule, windowMs) => {
		const expectedKey = `rl:v1:auth_request:${createHmac('sha256', HMAC_KEY)
			.update(`rate-limit\0v1\0auth_request\0${rawKey}`)
			.digest('base64url')}`;
		const database = {
			execute: vi.fn(async (query) => {
				const compiled = new PgDialect().sqlToQuery(query);
				expect(compiled.sql).not.toContain(rawKey);
				expect(JSON.stringify(compiled.params)).not.toContain(rawKey);
				expect(compiled.params).toContain(expectedKey);
				expect(compiled.params).toContain('auth_request');
				return {
					rows: [
						{
							count: 1,
							window_started_at: NOW,
							expires_at: new Date(NOW.getTime() + windowMs)
						}
					]
				};
			})
		};
		const storage = createBetterAuthRateLimitStorage(database, {
			hmacKey: HMAC_KEY,
			now: () => NOW
		});

		await expect(storage.consume(rawKey, rule)).resolves.toEqual({
			allowed: true,
			retryAfter: null
		});
		expect(database.execute).toHaveBeenCalledOnce();
	});

	it('maps every unknown path for one client to one strict fallback bucket', async () => {
		/** @type {{ bucketKey: string, expiresAt: Date }[]} */
		const observed = [];
		const database = {
			execute: vi.fn(async (query) => {
				const compiled = new PgDialect().sqlToQuery(query);
				const bucketKey = compiled.params.find(
					(value) => typeof value === 'string' && value.startsWith('rl:v1:auth_request:')
				);
				const expiresAt = compiled.params.find(
					(value) => value instanceof Date && value.getTime() > NOW.getTime()
				);
				if (typeof bucketKey !== 'string' || !(expiresAt instanceof Date)) {
					throw new Error('Expected a bounded auth bucket query');
				}
				observed.push({ bucketKey, expiresAt });
				return { rows: [{ count: 1, window_started_at: NOW, expires_at: expiresAt }] };
			})
		};
		const storage = createBetterAuthRateLimitStorage(database, {
			hmacKey: HMAC_KEY,
			now: () => NOW
		});
		const sameClientRequests = [
			['203.0.113.10|/not-a-route-1', { max: 100, window: 60 }],
			['203.0.113.10|/not-a-route-2', { max: 100, window: 60 }],
			['203.0.113.10|/sign-in/not-a-route', { max: 3, window: 10 }]
		];

		for (const [rawKey, rule] of sameClientRequests) {
			await storage.consume(
				/** @type {string} */ (rawKey),
				/** @type {{ max: number, window: number }} */ (rule)
			);
		}
		await storage.consume('203.0.113.11|/not-a-route-3', { max: 100, window: 60 });

		expect(new Set(observed.slice(0, 3).map(({ bucketKey }) => bucketKey)).size).toBe(1);
		expect(observed[3].bucketKey).not.toBe(observed[0].bucketKey);
		expect(observed.map(({ expiresAt }) => expiresAt.toISOString())).toEqual([
			'2026-08-13T14:00:10.000Z',
			'2026-08-13T14:00:10.000Z',
			'2026-08-13T14:00:10.000Z',
			'2026-08-13T14:00:10.000Z'
		]);
		expect(JSON.stringify(observed)).not.toContain('not-a-route');
	});

	it.each([
		'missing-delimiter',
		'not-an-ip|/get-session',
		'203.0.113.10|not-a-path',
		'203.0.113.10|',
		'203.0.113.10|/line\nbreak',
		`203.0.113.10|/${'a'.repeat(2048)}`
	])('rejects malformed raw Better Auth key %j before database work', async (rawKey) => {
		const database = { execute: vi.fn() };
		const storage = createBetterAuthRateLimitStorage(database, {
			hmacKey: HMAC_KEY,
			now: () => NOW
		});

		await expect(storage.consume(rawKey, { max: 100, window: 60 })).rejects.toBeInstanceOf(
			RateLimitInputError
		);
		expect(database.execute).not.toHaveBeenCalled();
	});

	it.each([
		['203.0.113.10|/sign-in/social', { max: 100, window: 60 }],
		['203.0.113.10|/callback/google', { max: 3, window: 10 }],
		['203.0.113.10|/get-session', { max: 3, window: 10 }]
	])('rejects the wrong fixed rule for known Better Auth key %j', async (rawKey, rule) => {
		const database = { execute: vi.fn() };
		const storage = createBetterAuthRateLimitStorage(database, {
			hmacKey: HMAC_KEY,
			now: () => NOW
		});

		await expect(storage.consume(rawKey, rule)).rejects.toBeInstanceOf(RateLimitInputError);
		expect(database.execute).not.toHaveBeenCalled();
	});

	it('returns a bounded retry and rejects rules outside the configured Better Auth surface', async () => {
		const database = {
			execute: vi.fn(async () => ({
				rows: [
					{
						count: 4,
						window_started_at: NOW,
						expires_at: new Date(NOW.getTime() + 10000)
					}
				]
			}))
		};
		const storage = createBetterAuthRateLimitStorage(database, {
			hmacKey: HMAC_KEY,
			now: () => NOW
		});

		await expect(
			storage.consume('203.0.113.10|/sign-in/social', { max: 3, window: 10 })
		).resolves.toEqual({ allowed: false, retryAfter: 10 });
		await expect(
			storage.consume('203.0.113.10|/sign-in/social', { max: 4, window: 10 })
		).rejects.toBeInstanceOf(RateLimitInputError);
		await expect(
			storage.consume('203.0.113.10|/callback/google', { max: 100, window: 30 })
		).rejects.toBeInstanceOf(RateLimitInputError);
		await expect(storage.consume(null, { max: 100, window: 60 })).rejects.toBeInstanceOf(
			RateLimitInputError
		);
		await expect(storage.consume('203.0.113.10|/callback/google', null)).rejects.toBeInstanceOf(
			RateLimitInputError
		);
		await expect(storage.consume('203.0.113.10|/callback/google', [])).rejects.toBeInstanceOf(
			RateLimitInputError
		);
		await expect(
			storage.consume('203.0.113.10|/callback/google', { max: 100.5, window: 60 })
		).rejects.toBeInstanceOf(RateLimitInputError);
		await expect(
			storage.consume('203.0.113.10|/callback/google', { max: 100, window: 60.5 })
		).rejects.toBeInstanceOf(RateLimitInputError);
		expect(database.execute).toHaveBeenCalledOnce();
	});

	it('fails closed without exposing the raw Better Auth key or database cause', async () => {
		const rawKey = '203.0.113.77|/callback/google';
		const storage = createBetterAuthRateLimitStorage(
			{ execute: vi.fn(async () => Promise.reject(new Error('database-secret-detail'))) },
			{ hmacKey: HMAC_KEY, now: () => NOW }
		);
		const failure = await storage.consume(rawKey, { max: 100, window: 60 }).catch((error) => error);

		expect(failure).toBeInstanceOf(RateLimitUnavailableError);
		expect(JSON.stringify(failure)).not.toContain(rawKey);
		expect(JSON.stringify(failure)).not.toContain('database-secret-detail');
	});

	it('fails closed if Better Auth falls back from the required atomic consume primitive', async () => {
		const storage = createBetterAuthRateLimitStorage(
			{ execute: vi.fn() },
			{ hmacKey: HMAC_KEY, now: () => NOW }
		);
		await expect(storage.get()).rejects.toBeInstanceOf(RateLimitUnavailableError);
		await expect(storage.set()).rejects.toBeInstanceOf(RateLimitUnavailableError);
	});

	it('uses the current clock when Better Auth storage consumes a slot', async () => {
		const windowMs = 60 * 1000;
		const database = {
			execute: vi.fn(async (query) => {
				const compiled = new PgDialect().sqlToQuery(query);
				const startedAt = compiled.params.find((value) => value instanceof Date);
				if (!(startedAt instanceof Date)) throw new Error('Expected a clock parameter');
				return {
					rows: [
						{
							count: 1,
							window_started_at: startedAt.toISOString(),
							expires_at: new Date(startedAt.getTime() + windowMs).toISOString()
						}
					]
				};
			})
		};
		const storage = createBetterAuthRateLimitStorage(database, { hmacKey: HMAC_KEY });
		await expect(
			storage.consume('203.0.113.10|/callback/google', { max: 100, window: 60 })
		).resolves.toEqual({ allowed: true, retryAfter: null });
	});
});

describe('trusted Vercel client address', () => {
	it.each(['203.0.113.9', '2001:db8::9'])(
		'accepts one platform address on Vercel: %s',
		(address) => {
			expect(
				extractTrustedVercelClientAddress(
					headers({ 'x-vercel-forwarded-for': address, 'x-forwarded-for': '198.51.100.4' }),
					{ VERCEL: '1' }
				)
			).toBe(address);
		}
	);

	it.each([
		['not on Vercel', { VERCEL: undefined }, '203.0.113.9'],
		['missing platform header', { VERCEL: '1' }, null],
		['ordinary forwarding header only', { VERCEL: '1' }, null],
		['comma list', { VERCEL: '1' }, '203.0.113.9, 198.51.100.4'],
		['host and port', { VERCEL: '1' }, '203.0.113.9:443'],
		['malformed address', { VERCEL: '1' }, 'client.example.com']
	])('uses the anonymous fallback for %s', (_label, environment, platformAddress) => {
		const requestHeaders = headers({
			...(platformAddress ? { 'x-vercel-forwarded-for': platformAddress } : {}),
			'x-forwarded-for': '198.51.100.4',
			'x-real-ip': '198.51.100.5'
		});
		expect(extractTrustedVercelClientAddress(requestHeaders, environment)).toBeNull();
	});

	it('rejects malformed header adapters and exact values with surrounding whitespace', () => {
		expect(extractTrustedVercelClientAddress(null, { VERCEL: '1' })).toBeNull();
		expect(
			extractTrustedVercelClientAddress(
				{
					get() {
						throw new Error('untrusted header adapter');
					}
				},
				{ VERCEL: '1' }
			)
		).toBeNull();
		expect(
			extractTrustedVercelClientAddress({ get: () => ' 203.0.113.9 ' }, { VERCEL: '1' })
		).toBeNull();
		expect(extractTrustedVercelClientAddress({ get: () => 203 }, { VERCEL: '1' })).toBeNull();
	});

	it('hashes trusted addresses and shares one stricter anonymous bucket otherwise', () => {
		const trusted = createCheckoutClientAddressBucketKey(
			headers({ 'x-vercel-forwarded-for': '203.0.113.9' }),
			{ hmacKey: HMAC_KEY, environment: { VERCEL: '1' } }
		);
		const missing = createCheckoutClientAddressBucketKey(headers({}), {
			hmacKey: HMAC_KEY,
			environment: { VERCEL: '1' }
		});
		const untrusted = createCheckoutClientAddressBucketKey(
			headers({
				'x-vercel-forwarded-for': '203.0.113.9',
				'x-forwarded-for': '198.51.100.4'
			}),
			{ hmacKey: HMAC_KEY, environment: {} }
		);

		expect(trusted).toMatch(/^rl:v1:checkout_client_address:/u);
		expect(trusted).not.toContain('203.0.113.9');
		expect(missing).toBe(untrusted);
		expect(missing).not.toContain('anonymous');
		expect(trusted).not.toBe(missing);
	});
});

describe('atomic fixed-window rate buckets', () => {
	it('issues one parameterized INSERT ON CONFLICT increment and returns the allowed result', async () => {
		const transaction = transactionReturning(1);
		const bucketKey = createCheckoutEmailBucketKey('student@example.com', {
			hmacKey: HMAC_KEY
		});

		await expect(
			consumeRateLimitInTransaction(transaction, {
				bucketKey,
				scope: 'checkout_email',
				...RATE_LIMIT_POLICIES.checkout_email,
				now: NOW
			})
		).resolves.toEqual({
			allowed: true,
			limit: 10,
			used: 1,
			remaining: 9,
			resetAt: '2026-08-13T14:15:00.000Z',
			retryAfterSeconds: 0
		});

		const query = /** @type {any} */ (transaction.execute).mock.calls[0][0];
		const compiled = new PgDialect().sqlToQuery(query);
		expect(compiled.sql).toMatch(/^insert into "rate_limit_buckets"/iu);
		expect(compiled.sql).toContain('on conflict ("bucket_key") do update');
		expect(compiled.sql).toContain('case when "rate_limit_buckets"."expires_at" <= $');
		expect(compiled.sql).toContain('"rate_limit_buckets"."count" + 1');
		expect(compiled.sql).toContain('where "rate_limit_buckets"."scope" = $');
		expect(compiled.sql).toContain('returning "count", "window_started_at", "expires_at"');
		expect(compiled.sql).not.toContain(bucketKey);
		expect(compiled.sql).not.toContain('student@example.com');
		expect(compiled.params).toContain(bucketKey);
		expect(compiled.params).toContain('checkout_email');
		expect(compiled.params).toContainEqual(NOW);
		expect(compiled.params).toContainEqual(new Date('2026-08-13T14:15:00.000Z'));
	});

	it.each([
		[10, true, 0, 0],
		[11, false, 0, 900]
	])(
		'treats count %i at the exact limit boundary correctly',
		async (count, allowed, remaining, retry) => {
			const transaction = transactionReturning(count);
			await expect(
				consumeRateLimitInTransaction(transaction, {
					bucketKey: 'rl:v1:checkout_email:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
					scope: 'checkout_email',
					...RATE_LIMIT_POLICIES.checkout_email,
					now: NOW
				})
			).resolves.toMatchObject({
				allowed,
				used: count,
				remaining,
				retryAfterSeconds: retry
			});
		}
	);

	it('reports the reset returned by PostgreSQL after an expired window', async () => {
		const resetStartedAt = new Date('2026-08-13T14:15:00.000Z');
		const resetExpiresAt = new Date('2026-08-13T14:30:00.000Z');
		const transaction = transactionReturning(1, resetStartedAt, resetExpiresAt);

		await expect(
			consumeRateLimitInTransaction(transaction, {
				bucketKey: 'rl:v1:checkout_email:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
				scope: 'checkout_email',
				...RATE_LIMIT_POLICIES.checkout_email,
				now: resetStartedAt
			})
		).resolves.toMatchObject({
			allowed: true,
			used: 1,
			resetAt: resetExpiresAt.toISOString(),
			retryAfterSeconds: 0
		});
	});

	it('accepts a valid active window that began before this request', async () => {
		const startedAt = new Date(NOW.getTime() - 5 * 60 * 1000);
		const expiresAt = new Date(startedAt.getTime() + RATE_LIMIT_POLICIES.checkout_email.windowMs);

		await expect(
			consumeRateLimitInTransaction(transactionReturning(4, startedAt, expiresAt), {
				bucketKey: 'rl:v1:checkout_email:IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII',
				scope: 'checkout_email',
				...RATE_LIMIT_POLICIES.checkout_email,
				now: NOW
			})
		).resolves.toMatchObject({
			allowed: true,
			used: 4,
			resetAt: expiresAt.toISOString(),
			retryAfterSeconds: 0
		});
	});

	it.each([
		[
			'future start',
			new Date(NOW.getTime() + 10 * 60 * 1000),
			new Date(NOW.getTime() + 25 * 60 * 1000)
		],
		['short duration', NOW, new Date(NOW.getTime() + 15 * 60 * 1000 - 1)],
		['long duration', NOW, new Date(NOW.getTime() + 15 * 60 * 1000 + 1)]
	])('fails closed for a corrupt returned window with %s', async (_label, startedAt, expiresAt) => {
		await expect(
			consumeRateLimitInTransaction(transactionReturning(11, startedAt, expiresAt), {
				bucketKey: 'rl:v1:checkout_email:JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ',
				scope: 'checkout_email',
				...RATE_LIMIT_POLICIES.checkout_email,
				now: NOW
			})
		).rejects.toBeInstanceOf(RateLimitUnavailableError);
	});

	it('accepts native Date values returned by the database driver', async () => {
		const expiresAt = new Date(NOW.getTime() + 60 * 1000);
		const transaction = {
			execute: vi.fn(async () => ({
				rows: [{ count: 1, window_started_at: NOW, expires_at: expiresAt }]
			}))
		};

		await expect(
			consumeRateLimitInTransaction(transaction, {
				bucketKey: 'rl:v1:staff_session:HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH',
				scope: 'staff_session',
				...RATE_LIMIT_POLICIES.staff_session,
				now: NOW
			})
		).resolves.toMatchObject({ resetAt: expiresAt.toISOString() });
	});

	it.each([
		['missing transaction', null, undefined],
		['non-record options', { execute: vi.fn() }, null],
		['invalid bucket key', { execute: vi.fn() }, { bucketKey: 'student@example.com' }],
		['non-string bucket key', { execute: vi.fn() }, { bucketKey: null }],
		[
			'bucket scope mismatch',
			{ execute: vi.fn() },
			{
				bucketKey: 'rl:v1:staff_session:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC'
			}
		],
		['invalid scope', { execute: vi.fn() }, { scope: 'raw_ip' }],
		['invalid limit', { execute: vi.fn() }, { limit: 0 }],
		['weakened approved limit', { execute: vi.fn() }, { limit: 9 }],
		['invalid window', { execute: vi.fn() }, { windowMs: 0 }],
		['weakened approved window', { execute: vi.fn() }, { windowMs: 1000 }],
		['invalid timestamp', { execute: vi.fn() }, { now: new Date('invalid') }]
	])('rejects %s before database work', async (_label, transaction, overrides) => {
		const options =
			overrides === null
				? null
				: {
						bucketKey: 'rl:v1:checkout_email:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC',
						scope: 'checkout_email',
						...RATE_LIMIT_POLICIES.checkout_email,
						now: NOW,
						.../** @type {Record<string, unknown>} */ (overrides ?? {})
					};
		await expect(consumeRateLimitInTransaction(transaction, options)).rejects.toBeInstanceOf(
			RateLimitInputError
		);
		if (transaction) expect(transaction.execute).not.toHaveBeenCalled();
	});

	it.each([
		['database rejection', async () => Promise.reject(new Error('postgresql://secret'))],
		['malformed query result', async () => null],
		['no returned row', async () => ({ rows: [] })],
		[
			'malformed returned count',
			async () => ({
				rows: [
					{
						count: 'one',
						window_started_at: NOW.toISOString(),
						expires_at: new Date(NOW.getTime() + 1000).toISOString()
					}
				]
			})
		],
		[
			'malformed returned window',
			async () => ({ rows: [{ count: 1, window_started_at: 'invalid', expires_at: 'invalid' }] })
		],
		[
			'non-date returned window',
			async () => ({
				rows: [
					{
						count: 1,
						window_started_at: 42,
						expires_at: new Date(NOW.getTime() + 1000).toISOString()
					}
				]
			})
		]
	])('fails closed with one non-sensitive error on %s', async (_label, execute) => {
		const transaction = { execute: vi.fn(execute) };
		const failure = await consumeRateLimitInTransaction(transaction, {
			bucketKey: 'rl:v1:checkout_email:DDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD',
			scope: 'checkout_email',
			...RATE_LIMIT_POLICIES.checkout_email,
			now: NOW
		}).catch((error) => error);

		expect(failure).toBeInstanceOf(RateLimitUnavailableError);
		expect(failure).toMatchObject({
			code: 'RATE_LIMIT_UNAVAILABLE',
			message: 'Rate limit service is unavailable'
		});
		expect(JSON.stringify(failure)).not.toContain('postgresql://secret');
	});

	it('runs the standalone primitive through one request-scoped transaction', async () => {
		const transaction = transactionReturning(
			1,
			NOW,
			new Date(NOW.getTime() + RATE_LIMIT_POLICIES.staff_session.windowMs)
		);
		const withTransaction = vi.fn(async (operation, options) => {
			expect(options).toEqual({ databaseUrl: 'postgresql://runtime.example/books' });
			return operation(transaction);
		});

		await expect(
			consumeRateLimit(
				{
					bucketKey: 'rl:v1:staff_session:EEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE',
					scope: 'staff_session',
					...RATE_LIMIT_POLICIES.staff_session,
					now: NOW
				},
				{
					databaseUrl: 'postgresql://runtime.example/books',
					withTransaction
				}
			)
		).resolves.toMatchObject({ allowed: true, used: 1 });
		expect(withTransaction).toHaveBeenCalledOnce();
		expect(transaction.execute).toHaveBeenCalledOnce();
	});

	it('fails closed when the standalone transaction boundary is unavailable', async () => {
		const infrastructureFailure = new Error('database credentials and host');
		const withTransaction = vi.fn(async () => Promise.reject(infrastructureFailure));

		const failure = await consumeRateLimit(
			{
				bucketKey: 'rl:v1:staff_action:FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF',
				scope: 'staff_action',
				...RATE_LIMIT_POLICIES.staff_action,
				now: NOW
			},
			{ databaseUrl: 'postgresql://runtime.example/books', withTransaction }
		).catch((error) => error);

		expect(failure).toBeInstanceOf(RateLimitUnavailableError);
		expect(failure.cause).toBe(infrastructureFailure);
		expect(JSON.stringify(failure)).not.toContain('database credentials');
	});

	it('preserves internal validation failures through the standalone wrapper', async () => {
		const withTransaction = vi.fn(async (operation) => operation({ execute: vi.fn() }));
		await expect(
			consumeRateLimit(
				{
					bucketKey: 'raw-value',
					scope: 'staff_session',
					...RATE_LIMIT_POLICIES.staff_session,
					now: NOW
				},
				{ databaseUrl: 'postgresql://runtime.example/books', withTransaction }
			)
		).rejects.toBeInstanceOf(RateLimitInputError);
	});

	it.each([
		['missing database URL', { databaseUrl: '', withTransaction: vi.fn() }],
		[
			'invalid transaction dependency',
			{ databaseUrl: 'postgresql://runtime.example/books', withTransaction: null }
		]
	])('rejects %s before opening a standalone transaction', async (_label, runtime) => {
		await expect(
			consumeRateLimit(
				{
					bucketKey: 'rl:v1:staff_session:GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG',
					scope: 'staff_session',
					...RATE_LIMIT_POLICIES.staff_session,
					now: NOW
				},
				/** @type {any} */ (runtime)
			)
		).rejects.toBeInstanceOf(RateLimitInputError);
		if (typeof runtime.withTransaction === 'function') {
			expect(runtime.withTransaction).not.toHaveBeenCalled();
		}
	});
});
