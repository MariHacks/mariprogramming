// @ts-nocheck
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import {
	StaffActionRequestError,
	_createGuardStaffMutation,
	readBoundedStaffForm
} from './request.js';

const APP_ORIGIN = 'https://club.example.com';
const HMAC_KEY = 'staff-rate-limit-key-that-is-longer-than-thirty-two-characters';
const DATABASE_URL = 'postgresql://staff:secret@db.example.com/club';
const REQUEST_ID = '10000000-0000-4000-8000-000000000001';
const NOW = new Date('2026-08-13T16:00:00.000Z');
const staff = Object.freeze({
	userId: 'staff-user',
	sessionId: 'staff-session',
	email: 'team@marihacks.com'
});

function runtime() {
	return {
		appOrigin: APP_ORIGIN,
		databaseUrl: DATABASE_URL,
		rateLimitHmacKey: HMAC_KEY,
		approvedHostnames: ['shop.example.com']
	};
}

/** @param {URLSearchParams | string} body @param {Record<string, string>} [headers] */
function request(body = new URLSearchParams({ name: 'Ada Lovelace' }), headers = {}) {
	return new Request(`${APP_ORIGIN}/staff/catalogue/teachers?/create`, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
			origin: APP_ORIGIN,
			...headers
		},
		body
	});
}

function setup(overrides = {}) {
	/** @type {string[]} */
	const sequence = [];
	const requireStaff = vi.fn(() => {
		sequence.push('authorize');
		return staff;
	});
	const consumeRateLimit = vi.fn(async (_transaction, options) => {
		sequence.push(options.scope);
		return { allowed: true, retryAfterSeconds: 0 };
	});
	const runTransaction = vi.fn(async (operation) => {
		sequence.push('rate-start');
		const result = await operation({ rate: true });
		sequence.push('rate-commit');
		return result;
	});
	const logger = { log: vi.fn() };
	const guard = _createGuardStaffMutation({
		requireStaff,
		readEnvironment: vi.fn(runtime),
		consumeRateLimit,
		runTransaction,
		createSessionBucketKey: vi.fn(() => 'session-bucket'),
		createActionBucketKey: vi.fn(() => 'action-bucket'),
		createLogger: vi.fn(() => logger),
		getNow: vi.fn(() => NOW),
		createRequestId: vi.fn(() => REQUEST_ID),
		...overrides
	});
	return { guard, requireStaff, consumeRateLimit, runTransaction, logger, sequence };
}

function event(body = request()) {
	return {
		request: body,
		locals: { staff },
		setHeaders: vi.fn()
	};
}

describe('bounded staff form reader', () => {
	it('accepts one exact UTF-8 urlencoded value for every expected field', async () => {
		await expect(readBoundedStaffForm(request(), ['name'])).resolves.toEqual({
			name: 'Ada Lovelace'
		});
	});

	it.each([
		['wrong media type', request('{"name":"Ada"}', { 'content-type': 'application/json' }), 415],
		[
			'malformed content length',
			request(new URLSearchParams({ name: 'Ada' }), { 'content-length': '-1' }),
			400
		],
		[
			'oversized declared content length',
			request(new URLSearchParams({ name: 'Ada' }), { 'content-length': '16385' }),
			413
		],
		[
			'repeated field',
			request(
				new URLSearchParams([
					['name', 'Ada'],
					['name', 'Grace']
				])
			),
			400
		],
		['unknown field', request(new URLSearchParams({ name: 'Ada', role: 'admin' })), 400],
		['missing field', request(new URLSearchParams({ slug: 'ada' })), 400],
		['malformed percent encoding', request('name=%ZZ'), 400],
		['malformed percent-encoded UTF-8', request('name=%C3%28'), 400],
		['multipart file body', request('file=data', { 'content-type': 'multipart/form-data' }), 415]
	])('rejects %s', async (_label, unsafeRequest, status) => {
		const failure = await readBoundedStaffForm(unsafeRequest, ['name']).catch((error) => error);
		expect(failure).toBeInstanceOf(StaffActionRequestError);
		expect(failure.status).toBe(status);
		expect(failure.message).toBe('Staff request is invalid');
	});

	it.each([
		['non-array fields', null],
		['empty fields', []],
		['too many fields', Array.from({ length: 17 }, (_, index) => `field${index}`)],
		['duplicate fields', ['name', 'name']],
		['non-string field', ['name', 42]],
		['unsafe field name', ['Admin-role']]
	])('rejects %s before reading the form', async (_label, fields) => {
		const failure = await readBoundedStaffForm(request(), fields).catch((error) => error);
		expect(failure).toMatchObject({ status: 503, message: 'Staff request is invalid' });
	});

	it('stops and cancels an oversized stream before reading a later chunk', async () => {
		const encoder = new TextEncoder();
		let sentinelRead = false;
		let cancelled = false;
		let chunk = 0;
		const body = new ReadableStream(
			{
				pull(controller) {
					if (chunk++ === 0) {
						controller.enqueue(encoder.encode(`name=${'a'.repeat(16384)}`));
						return;
					}
					sentinelRead = true;
					controller.enqueue(encoder.encode('sentinel'));
					controller.close();
				},
				cancel() {
					cancelled = true;
				}
			},
			{ highWaterMark: 0 }
		);
		const streamed = new Request(`${APP_ORIGIN}/staff/catalogue/teachers?/create`, {
			method: 'POST',
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				origin: APP_ORIGIN
			},
			body,
			duplex: 'half'
		});

		const failure = await readBoundedStaffForm(streamed, ['name']).catch((error) => error);
		expect(failure).toMatchObject({ status: 413 });
		expect(sentinelRead).toBe(false);
		expect(cancelled).toBe(true);
	});

	it('fails closed for an empty, missing, invalid UTF-8, or failed body stream', async () => {
		const base = { getReader: () => ({ releaseLock: vi.fn() }) };
		const requests = [
			{ headers: request().headers, body: null },
			{
				headers: request().headers,
				body: {
					...base,
					getReader: () => ({ read: async () => ({ done: true }), releaseLock: vi.fn() })
				}
			},
			new Request(`${APP_ORIGIN}/staff/catalogue/teachers?/create`, {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded', origin: APP_ORIGIN },
				body: new Uint8Array([0xc3, 0x28])
			}),
			{
				headers: request().headers,
				body: {
					getReader: () => ({
						read: vi.fn().mockRejectedValue(new Error('stream secret')),
						releaseLock: vi.fn()
					})
				}
			}
		];

		for (const unsafeRequest of requests) {
			const failure = await readBoundedStaffForm(/** @type {any} */ (unsafeRequest), [
				'name'
			]).catch((error) => error);
			expect(failure).toMatchObject({ status: 400, message: 'Staff request is invalid' });
		}
	});

	it('fails closed for non-byte chunks and tolerates reader cleanup failures', async () => {
		const headers = request().headers;
		const nonByte = {
			headers,
			body: {
				getReader: () => ({
					read: vi.fn().mockResolvedValue({ done: false, value: 'not bytes' }),
					releaseLock: vi.fn()
				})
			}
		};
		await expect(readBoundedStaffForm(nonByte, ['name'])).rejects.toMatchObject({ status: 400 });

		const oversized = {
			headers,
			body: {
				getReader: () => ({
					read: vi.fn().mockResolvedValue({ done: false, value: new Uint8Array(16385) }),
					cancel: vi.fn().mockRejectedValue(new Error('cleanup failed')),
					releaseLock: vi.fn()
				})
			}
		};
		await expect(readBoundedStaffForm(oversized, ['name'])).rejects.toMatchObject({ status: 413 });

		const encoder = new TextEncoder();
		const read = vi
			.fn()
			.mockResolvedValueOnce({ done: false, value: encoder.encode('name=Ada') })
			.mockResolvedValueOnce({ done: true });
		const releaseFailure = {
			headers,
			body: {
				getReader: () => ({
					read,
					releaseLock: vi.fn(() => {
						throw new Error('cleanup failed');
					})
				})
			}
		};
		await expect(readBoundedStaffForm(releaseFailure, ['name'])).resolves.toEqual({ name: 'Ada' });
	});
});

describe('staff mutation guard', () => {
	it('authorizes first, validates input and origin, then commits both limits', async () => {
		const harness = setup();
		const current = event();

		await expect(
			harness.guard(current, { action: 'catalogue_create_teacher', fields: ['name'] })
		).resolves.toEqual({
			staff,
			form: { name: 'Ada Lovelace' },
			requestId: REQUEST_ID,
			runtime: runtime()
		});
		expect(harness.sequence).toEqual([
			'authorize',
			'rate-start',
			'staff_session',
			'staff_action',
			'rate-commit'
		]);
		expect(harness.runTransaction).toHaveBeenCalledOnce();
	});

	it('uses an allowlisted order route in rate-limit security records', async () => {
		const consumeRateLimit = vi
			.fn()
			.mockResolvedValueOnce({ allowed: true, retryAfterSeconds: 0 })
			.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 18 });
		const harness = setup({ consumeRateLimit });

		await expect(
			harness.guard(event(), {
				action: 'orders_export',
				fields: ['name'],
				route: '/staff/orders/export'
			})
		).rejects.toMatchObject({ status: 429 });
		expect(harness.logger.log).toHaveBeenCalledWith(
			'rate_limit_denied',
			expect.objectContaining({ route: '/staff/orders/export' })
		);
	});

	it('rejects an unapproved log route before rate storage', async () => {
		const harness = setup();
		await expect(
			harness.guard(event(), {
				action: 'orders_export',
				fields: ['name'],
				route: '/staff/orders/private'
			})
		).rejects.toMatchObject({ status: 503 });
		expect(harness.runTransaction).not.toHaveBeenCalled();
	});

	it('uses a fresh server clock when no clock is injected', async () => {
		const harness = setup({ getNow: undefined });
		await expect(
			harness.guard(event(), { action: 'catalogue_create_teacher', fields: ['name'] })
		).resolves.toMatchObject({ requestId: REQUEST_ID });
		expect(harness.consumeRateLimit).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ now: expect.any(Date) })
		);
	});

	it('stops before reading configuration, body, or rate storage when authorization fails', async () => {
		const denied = new Error('redirect');
		const readEnvironment = vi.fn();
		const harness = setup({
			requireStaff: vi.fn(() => {
				throw denied;
			}),
			readEnvironment
		});

		await expect(
			harness.guard(event(), { action: 'catalogue_create_teacher', fields: ['name'] })
		).rejects.toBe(denied);
		expect(readEnvironment).not.toHaveBeenCalled();
		expect(harness.runTransaction).not.toHaveBeenCalled();
	});

	it.each([null, 'https://evil.example.com', `${APP_ORIGIN}/`])(
		'rejects noncanonical origin %# before rate storage',
		async (origin) => {
			const harness = setup();
			const unsafe = request();
			if (origin === null) unsafe.headers.delete('origin');
			else unsafe.headers.set('origin', origin);

			const failure = await harness
				.guard(event(unsafe), { action: 'catalogue_create_teacher', fields: ['name'] })
				.catch((error) => error);
			expect(failure).toMatchObject({ status: 403 });
			expect(harness.runTransaction).not.toHaveBeenCalled();
		}
	);

	it('commits both denied counters and returns the longer Retry-After', async () => {
		const consumeRateLimit = vi
			.fn()
			.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 12 })
			.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 42 });
		const harness = setup({ consumeRateLimit });
		const current = event();

		const failure = await harness
			.guard(current, { action: 'catalogue_update_teacher', fields: ['name'] })
			.catch((error) => error);
		expect(failure).toMatchObject({ status: 429, retryAfterSeconds: 42 });
		expect(current.setHeaders).toHaveBeenCalledWith({ 'retry-after': '42' });
		expect(harness.sequence.at(-1)).toBe('rate-commit');
		expect(harness.logger.log).toHaveBeenCalledWith('rate_limit_denied', {
			route: '/staff/catalogue',
			reason: 'limit_exceeded',
			scope: 'staff_action',
			status: 429,
			retryAfterSeconds: 42
		});
	});

	it.each([
		[
			'rate limit denial',
			{
				consumeRateLimit: vi
					.fn()
					.mockResolvedValueOnce({ allowed: true, retryAfterSeconds: 0 })
					.mockResolvedValueOnce({ allowed: false, retryAfterSeconds: 30 })
			},
			429
		],
		[
			'rate storage failure',
			{
				runTransaction: vi.fn(() => {
					throw new Error('database unavailable');
				})
			},
			503
		],
		[
			'configuration failure',
			{
				readEnvironment: vi.fn(() => {
					throw new Error('configuration unavailable');
				})
			},
			503
		]
	])('keeps only a validated record id through %s', async (_label, overrides, status) => {
		const recordId = '20000000-0000-4000-8000-000000000001';
		const harness = setup(overrides);
		const current = event(request(new URLSearchParams({ id: recordId, version: '7' })));

		const failure = await harness
			.guard(current, {
				action: 'catalogue_deactivate_teacher',
				fields: ['id', 'version'],
				contextField: 'id'
			})
			.catch((error) => error);

		expect(failure).toMatchObject({ status, context: { recordId } });
		expect(JSON.stringify(failure)).not.toMatch(
			/version|database unavailable|configuration unavailable/i
		);
	});

	it('does not preserve malformed or unapproved form context', async () => {
		const consumeRateLimit = vi.fn(async () => ({ allowed: false, retryAfterSeconds: 30 }));
		const malformed = setup({ consumeRateLimit });
		const malformedFailure = await malformed
			.guard(event(request(new URLSearchParams({ id: 'not-a-uuid', version: '7' }))), {
				action: 'catalogue_deactivate_teacher',
				fields: ['id', 'version'],
				contextField: 'id'
			})
			.catch((error) => error);
		expect(malformedFailure).toMatchObject({ status: 429 });
		expect(malformedFailure.context).toBeNull();

		const unapproved = setup();
		await expect(
			unapproved.guard(event(), {
				action: 'catalogue_create_teacher',
				fields: ['name'],
				contextField: 'name'
			})
		).rejects.toMatchObject({ status: 503, context: null });
		expect(unapproved.runTransaction).not.toHaveBeenCalled();
	});

	it.each([
		[
			'configuration',
			{
				readEnvironment: vi.fn(() => {
					throw new Error('secret');
				})
			}
		],
		[
			'rate persistence',
			{
				runTransaction: vi.fn(() => {
					throw new Error('database secret');
				})
			}
		],
		['malformed rate result', { consumeRateLimit: vi.fn(async () => ({ allowed: 'yes' })) }],
		['invalid clock', { getNow: vi.fn(() => new Date('invalid')) }],
		['invalid request UUID', { createRequestId: vi.fn(() => 'not-a-uuid') }]
	])('fails closed when %s is unavailable', async (_label, overrides) => {
		const harness = setup(overrides);
		const failure = await harness
			.guard(event(), { action: 'catalogue_create_teacher', fields: ['name'] })
			.catch((error) => error);
		expect(failure).toMatchObject({ status: 503, message: 'Staff request is invalid' });
		expect(JSON.stringify(failure)).not.toContain('secret');
	});
});
