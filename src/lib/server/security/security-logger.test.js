// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import {
	SECURITY_EVENT_CODES,
	SECURITY_REASON_CODES,
	createSecurityLogger
} from './security-logger.js';

const FIXED_TIME = new Date('2026-08-13T15:30:00.000Z');

/** @param {ReturnType<typeof createSecurityLogger>} logger @param {unknown} event @param {unknown} metadata */
function log(logger, event, metadata) {
	return logger.log(event, metadata);
}

describe('default-deny structured security logger', () => {
	it('emits only bounded authorization and webhook event codes with safe scalar metadata', () => {
		const write = vi.fn();
		const logger = createSecurityLogger({ write, now: () => FIXED_TIME });

		expect(
			log(logger, SECURITY_EVENT_CODES.authorizationDenied, {
				route: '/staff/orders/[orderId]?capability=must-not-appear#fragment',
				reason: SECURITY_REASON_CODES.emailNotAllowed,
				scope: 'staff_session',
				status: 403,
				retryAfterSeconds: 0
			})
		).toBe(true);
		expect(
			log(logger, SECURITY_EVENT_CODES.webhookVerificationFailed, {
				route: '/api/stripe/webhook?signature=must-not-appear',
				reason: SECURITY_REASON_CODES.invalidSignature,
				status: 400
			})
		).toBe(true);

		expect(write).toHaveBeenNthCalledWith(1, {
			timestamp: '2026-08-13T15:30:00.000Z',
			event: 'authorization_denied',
			route: '/staff/orders/[orderId]',
			reason: 'email_not_allowed',
			scope: 'staff_session',
			status: 403,
			retryAfterSeconds: 0
		});
		expect(write).toHaveBeenNthCalledWith(2, {
			timestamp: '2026-08-13T15:30:00.000Z',
			event: 'webhook_verification_failed',
			route: '/api/stripe/webhook',
			reason: 'invalid_signature',
			status: 400
		});
	});

	it('allows the fixed staff purchase export route without retaining a query string', () => {
		const write = vi.fn();
		const logger = createSecurityLogger({ write, now: () => FIXED_TIME });
		expect(
			log(logger, SECURITY_EVENT_CODES.rateLimitDenied, {
				route: '/staff/orders/export?query=student@example.com',
				reason: SECURITY_REASON_CODES.limitExceeded,
				scope: 'staff_action',
				status: 429
			})
		).toBe(true);
		expect(write).toHaveBeenCalledWith({
			timestamp: '2026-08-13T15:30:00.000Z',
			event: 'rate_limit_denied',
			route: '/staff/orders/export',
			reason: 'limit_exceeded',
			scope: 'staff_action',
			status: 429
		});
	});

	it('drops unknown event codes instead of logging raw attacker-controlled names', () => {
		const write = vi.fn();
		const logger = createSecurityLogger({ write, now: () => FIXED_TIME });

		expect(log(logger, 'student@example.com', { status: 403 })).toBe(false);
		expect(log(logger, '', {})).toBe(false);
		expect(log(logger, null, {})).toBe(false);
		expect(write).not.toHaveBeenCalled();
	});

	it('drops all non-allowlisted fields and prohibited values, including nested provider data', () => {
		const write = vi.fn();
		const logger = createSecurityLogger({ write, now: () => FIXED_TIME });
		const prohibited = [
			'student@example.com',
			'session=secret-cookie',
			'ya29.oauth-secret',
			'cs_test_stripe-session',
			'pi_stripe-payment-intent',
			'guest-confirmation-capability',
			'whsec_webhook-secret',
			'attacker-supplied-payload'
		];

		log(logger, SECURITY_EVENT_CODES.rateLimitDenied, {
			route: '/api/book-checkout?email=student@example.com',
			reason: SECURITY_REASON_CODES.limitExceeded,
			scope: 'checkout_email',
			status: 429,
			retryAfterSeconds: 42,
			customerEmail: prohibited[0],
			cookie: prohibited[1],
			oauthToken: prohibited[2],
			stripeSessionId: prohibited[3],
			paymentIntentId: prohibited[4],
			capability: prohibited[5],
			secret: prohibited[6],
			providerPayload: { body: prohibited[7], authorization: prohibited[2] },
			rawAttackerInput: prohibited[7]
		});

		const serialized = JSON.stringify(write.mock.calls[0][0]);
		for (const value of prohibited) expect(serialized).not.toContain(value);
		expect(write.mock.calls[0][0]).toEqual({
			timestamp: '2026-08-13T15:30:00.000Z',
			event: 'rate_limit_denied',
			route: '/api/book-checkout',
			reason: 'limit_exceeded',
			scope: 'checkout_email',
			status: 429,
			retryAfterSeconds: 42
		});
	});

	it('drops invalid values even when their metadata field name is allowlisted', () => {
		const write = vi.fn();
		const logger = createSecurityLogger({ write, now: () => FIXED_TIME });

		log(logger, SECURITY_EVENT_CODES.authorizationDenied, {
			route: '/staff/orders/real-order-id?token=secret',
			reason: 'student@example.com',
			scope: 'raw_ip',
			status: 999,
			retryAfterSeconds: -1,
			error: 'secret string is not an Error'
		});

		expect(write).toHaveBeenCalledWith({
			timestamp: '2026-08-13T15:30:00.000Z',
			event: 'authorization_denied'
		});
	});

	it('serializes nested errors and AggregateError causes without messages, stacks, or custom fields', () => {
		const write = vi.fn();
		const logger = createSecurityLogger({ write, now: () => FIXED_TIME });
		const inner = Object.assign(new TypeError('student@example.com and cs_test_secret'), {
			code: 'RATE_LIMIT_UNAVAILABLE',
			cookie: 'session=secret-cookie'
		});
		const aggregateMember = Object.assign(new RangeError('pi_secret and ya29.secret'), {
			code: 'SERVER_CONFIGURATION_INVALID',
			providerPayload: { secret: 'whsec_nested-secret' }
		});
		const failure = Object.assign(
			new globalThis.AggregateError(
				[aggregateMember, new Error('guest-confirmation-capability'), 'raw nested string'],
				'outer attacker-supplied-payload',
				{ cause: inner }
			),
			{ code: 'RATE_LIMIT_UNAVAILABLE', email: 'student@example.com' }
		);

		log(logger, SECURITY_EVENT_CODES.rateLimitUnavailable, {
			route: '/api/book-checkout',
			reason: SECURITY_REASON_CODES.databaseUnavailable,
			status: 503,
			error: failure
		});

		expect(write.mock.calls[0][0]).toEqual({
			timestamp: '2026-08-13T15:30:00.000Z',
			event: 'rate_limit_unavailable',
			route: '/api/book-checkout',
			reason: 'database_unavailable',
			status: 503,
			error: {
				name: 'AggregateError',
				code: 'RATE_LIMIT_UNAVAILABLE',
				cause: { name: 'TypeError', code: 'RATE_LIMIT_UNAVAILABLE' },
				errors: [{ name: 'RangeError', code: 'SERVER_CONFIGURATION_INVALID' }, { name: 'Error' }]
			}
		});
		const serialized = JSON.stringify(write.mock.calls[0][0]);
		for (const prohibited of [
			'student@example.com',
			'cs_test_secret',
			'session=secret-cookie',
			'pi_secret',
			'ya29.secret',
			'whsec_nested-secret',
			'guest-confirmation-capability',
			'attacker-supplied-payload',
			'stack',
			'message'
		]) {
			expect(serialized).not.toContain(prohibited);
		}
	});

	it('bounds nested causes, cycles, and AggregateError fan-out without throwing', () => {
		const write = vi.fn();
		const logger = createSecurityLogger({ write, now: () => FIXED_TIME });
		const cycle = new Error('cycle secret');
		cycle.cause = cycle;
		const nested = new Error('level zero', {
			cause: new Error('level one', {
				cause: new Error('level two', { cause: new Error('level three secret') })
			})
		});
		const failure = new globalThis.AggregateError(
			[cycle, nested, new Error('third'), new Error('fourth secret')],
			'outer'
		);

		expect(() =>
			log(logger, SECURITY_EVENT_CODES.webhookVerificationFailed, { error: failure })
		).not.toThrow();
		const record = write.mock.calls[0][0];
		expect(record.error.errors).toHaveLength(3);
		expect(record.error.errors[0]).toEqual({
			name: 'Error',
			cause: { name: 'Error', truncated: true }
		});
		expect(record.error.errors[1].cause.cause.cause).toEqual({
			name: 'Error',
			truncated: true
		});
		expect(JSON.stringify(record)).not.toContain('fourth secret');
	});

	it('skips accessor AggregateError entries without invoking getters or toJSON', () => {
		const entryGetter = vi.fn(() => {
			throw new Error('aggregate entry getter must not run');
		});
		const toJSONGetter = vi.fn(() => {
			throw new Error('error toJSON getter must not run');
		});
		const safeEntry = new Error('message is never serialized');
		Object.defineProperty(safeEntry, 'toJSON', { get: toJSONGetter });
		/** @type {Error[]} */
		const entries = [];
		Object.defineProperty(entries, '0', { get: entryGetter, enumerable: true });
		Object.defineProperty(entries, '1', { value: safeEntry, enumerable: true });
		entries.length = 2;
		const failure = new globalThis.AggregateError([], 'outer');
		Object.defineProperty(failure, 'errors', { value: entries });
		/** @type {string[]} */
		const serialized = [];
		const logger = createSecurityLogger({
			write: (record) => serialized.push(JSON.stringify(record)),
			now: () => FIXED_TIME
		});

		let result;
		expect(() => {
			result = log(logger, SECURITY_EVENT_CODES.rateLimitUnavailable, { error: failure });
		}).not.toThrow();
		expect(result).toBe(true);
		expect(entryGetter).not.toHaveBeenCalled();
		expect(toJSONGetter).not.toHaveBeenCalled();
		expect(JSON.parse(serialized[0]).error.errors).toEqual([{ name: 'Error' }]);
	});

	it('ignores a non-array AggregateError errors value', () => {
		const failure = new globalThis.AggregateError([], 'outer');
		Object.defineProperty(failure, 'errors', { value: { attacker: 'payload' } });
		const write = vi.fn();
		const logger = createSecurityLogger({ write, now: () => FIXED_TIME });

		expect(log(logger, SECURITY_EVENT_CODES.rateLimitUnavailable, { error: failure })).toBe(true);
		expect(write).toHaveBeenCalledWith({
			timestamp: '2026-08-13T15:30:00.000Z',
			event: 'rate_limit_unavailable',
			error: { name: 'AggregateError' }
		});
	});

	it('inspects a fixed bounded set of own AggregateError entry descriptors only', () => {
		const inheritedEntry = new Error('inherited entry must be ignored');
		const ownEntry = new TypeError('own entry');
		/** @type {Error[]} */
		const target = [];
		Object.setPrototypeOf(
			target,
			Object.create(Array.prototype, {
				0: { value: inheritedEntry, enumerable: true }
			})
		);
		Object.defineProperty(target, '7', { value: ownEntry, enumerable: true });
		target.length = 1000;
		const getTrap = vi.fn(() => {
			throw new Error('ordinary element reads must not run');
		});
		const hasTrap = vi.fn(() => {
			throw new Error('prototype membership checks must not run');
		});
		const descriptorTrap = vi.fn((array, key) => Reflect.getOwnPropertyDescriptor(array, key));
		const entries = new Proxy(target, {
			get: getTrap,
			has: hasTrap,
			getOwnPropertyDescriptor: descriptorTrap
		});
		const failure = new globalThis.AggregateError([], 'outer');
		Object.defineProperty(failure, 'errors', { value: entries });
		const write = vi.fn();
		const logger = createSecurityLogger({ write, now: () => FIXED_TIME });

		let result;
		expect(() => {
			result = log(logger, SECURITY_EVENT_CODES.rateLimitUnavailable, { error: failure });
		}).not.toThrow();
		expect(result).toBe(true);
		expect(getTrap).not.toHaveBeenCalled();
		expect(hasTrap).not.toHaveBeenCalled();
		expect(descriptorTrap.mock.calls.length).toBeLessThanOrEqual(17);
		expect(write.mock.calls[0][0].error.errors).toEqual([{ name: 'TypeError' }]);
	});

	it.each([
		[
			'metadata descriptor trap',
			() =>
				new Proxy(
					{},
					{
						getOwnPropertyDescriptor: () => {
							throw new Error('metadata trap');
						}
					}
				)
		],
		[
			'error prototype trap',
			() => ({
				error: new Proxy(new Error('secret'), {
					getPrototypeOf: () => {
						throw new Error('error trap');
					}
				})
			})
		],
		[
			'revoked AggregateError array',
			() => {
				const revoked = Proxy.revocable([], {});
				revoked.revoke();
				const failure = new globalThis.AggregateError([], 'outer');
				Object.defineProperty(failure, 'errors', { value: revoked.proxy });
				return { error: failure };
			}
		]
	])('contains a hostile %s without invoking the writer', (_label, metadataFactory) => {
		const write = vi.fn();
		const logger = createSecurityLogger({ write, now: () => FIXED_TIME });

		let result;
		expect(() => {
			result = log(logger, SECURITY_EVENT_CODES.authorizationDenied, metadataFactory());
		}).not.toThrow();
		expect(result).toBe(false);
		expect(write).not.toHaveBeenCalled();
	});

	it('contains clock failures and bypasses an own toISOString accessor', () => {
		const write = vi.fn();
		const toISOStringGetter = vi.fn(() => {
			throw new Error('clock accessor must not run');
		});
		const clockValue = new Date(FIXED_TIME);
		Object.defineProperty(clockValue, 'toISOString', { get: toISOStringGetter });
		const safeLogger = createSecurityLogger({ write, now: () => clockValue });
		const failingLogger = createSecurityLogger({
			write,
			now: () => {
				throw new Error('clock unavailable');
			}
		});

		expect(log(safeLogger, SECURITY_EVENT_CODES.authorizationDenied, {})).toBe(true);
		expect(toISOStringGetter).not.toHaveBeenCalled();
		expect(write).toHaveBeenCalledWith({
			timestamp: '2026-08-13T15:30:00.000Z',
			event: 'authorization_denied'
		});
		let failureResult;
		expect(() => {
			failureResult = log(failingLogger, SECURITY_EVENT_CODES.authorizationDenied, {});
		}).not.toThrow();
		expect(failureResult).toBe(false);
		expect(write).toHaveBeenCalledTimes(1);
	});

	it('rejects a non-Date clock value without invoking the writer', () => {
		const write = vi.fn();
		const logger = createSecurityLogger({ write, now: () => /** @type {any} */ ('not-a-date') });

		expect(log(logger, SECURITY_EVENT_CODES.authorizationDenied, {})).toBe(false);
		expect(write).not.toHaveBeenCalled();
	});

	it('ignores metadata getters, non-record metadata, and writer failures', () => {
		const write = vi.fn(() => {
			throw new Error('logging backend unavailable');
		});
		const logger = createSecurityLogger({ write, now: () => FIXED_TIME });
		const metadata = {};
		Object.defineProperty(metadata, 'route', {
			get() {
				throw new Error('getter secret');
			}
		});

		expect(log(logger, SECURITY_EVENT_CODES.authorizationDenied, metadata)).toBe(false);
		expect(log(logger, SECURITY_EVENT_CODES.authorizationDenied, null)).toBe(false);
		expect(log(logger, SECURITY_EVENT_CODES.authorizationDenied, [])).toBe(false);
		expect(write).toHaveBeenCalledTimes(3);
	});

	it('uses the default JSON writer without exposing unknown metadata', () => {
		vi.useFakeTimers();
		vi.setSystemTime(FIXED_TIME);
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		try {
			const logger = createSecurityLogger();
			expect(
				log(logger, SECURITY_EVENT_CODES.authorizationDenied, {
					reason: SECURITY_REASON_CODES.missingSession,
					cookie: 'session=secret-cookie'
				})
			).toBe(true);
			expect(warn).toHaveBeenCalledWith(
				'{"timestamp":"2026-08-13T15:30:00.000Z","event":"authorization_denied","reason":"missing_session"}'
			);
		} finally {
			warn.mockRestore();
			vi.useRealTimers();
		}
	});
});
