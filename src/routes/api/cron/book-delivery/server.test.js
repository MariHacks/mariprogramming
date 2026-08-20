// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/books/stripe.js', () => ({
	createStripeClient: vi.fn()
}));
vi.mock('$lib/server/config/environment.js', () => ({
	readBookDeliveryJobEnvironment: vi.fn()
}));
vi.mock('$lib/server/jobs/book-delivery.js', () => ({
	runBookDeliveryJob: vi.fn()
}));

import { createStripeClient } from '$lib/server/books/stripe.js';
import { readBookDeliveryJobEnvironment } from '$lib/server/config/environment.js';
import { runBookDeliveryJob } from '$lib/server/jobs/book-delivery.js';
import * as cronRoute from './+server.js';

const { _createBookDeliveryCronEndpoint } = cronRoute;

const RUNTIME = Object.freeze({
	databaseUrl: 'postgresql://runtime:password@db.example.com/books',
	stripeSecretKey: 'sk_test_cron',
	stripeMode: 'test',
	cronSecret: 'cron-secret-with-at-least-32-characters'
});

/** @param {string | undefined} authorization @param {string} [method] */
function request(authorization, method = 'GET') {
	return new Request('https://club.example.com/api/cron/book-delivery?secret=must-not-work', {
		method,
		headers: authorization === undefined ? {} : { authorization }
	});
}

function endpoint(overrides = {}) {
	return _createBookDeliveryCronEndpoint({
		readEnvironment: vi.fn(() => RUNTIME),
		createStripeClient: vi.fn(() => ({ provider: true })),
		runJob: vi.fn(async () => ({
			candidates: 2,
			reconciled: 1,
			pending: 1,
			providerFailures: 0,
			purged: 3,
			bucketsDeleted: 4,
			retryRequired: false
		})),
		getNow: vi.fn(() => new Date('2026-08-13T18:00:00.000Z')),
		...overrides
	});
}

describe('scheduled Book Delivery route', () => {
	it.each([
		['unauthenticated', undefined],
		['authenticated', `Bearer ${RUNTIME.cronSecret}`]
	])(
		'returns the same private 405 for an %s HEAD without side effects',
		async (_label, authorization) => {
			vi.clearAllMocks();
			expect(cronRoute.HEAD).toEqual(expect.any(Function));
			const response = await cronRoute.HEAD({ request: request(authorization, 'HEAD') });

			expect(response.status).toBe(405);
			expect(response.headers.get('allow')).toBe('GET');
			expect(response.headers.get('cache-control')).toBe('no-store');
			expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
			expect(response.headers.get('referrer-policy')).toBe('no-referrer');
			expect(response.headers.get('www-authenticate')).toBeNull();
			expect(await response.text()).toBe('');
			expect(readBookDeliveryJobEnvironment).not.toHaveBeenCalled();
			expect(createStripeClient).not.toHaveBeenCalled();
			expect(runBookDeliveryJob).not.toHaveBeenCalled();
		}
	);

	it('runs one bounded job for an exact Bearer secret and never echoes credentials', async () => {
		const runJob = vi.fn(async () => ({
			candidates: 2,
			reconciled: 1,
			pending: 1,
			providerFailures: 0,
			purged: 3,
			bucketsDeleted: 4,
			retryRequired: false
		}));
		const response = await endpoint({ runJob })({
			request: request(`Bearer ${RUNTIME.cronSecret}`)
		});
		expect(response.status).toBe(200);
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
		const body = await response.text();
		expect(JSON.parse(body)).toEqual({
			ok: true,
			candidates: 2,
			reconciled: 1,
			pending: 1,
			purged: 3,
			bucketsDeleted: 4
		});
		expect(runJob).toHaveBeenCalledWith(
			expect.objectContaining({
				databaseUrl: RUNTIME.databaseUrl,
				stripeMode: 'test',
				now: new Date('2026-08-13T18:00:00.000Z')
			})
		);
		expect(body).not.toContain(RUNTIME.cronSecret);
	});

	it.each([
		['missing', undefined],
		['empty', ''],
		['wrong scheme', RUNTIME.cronSecret],
		['wrong value', `Bearer ${RUNTIME.cronSecret}x`],
		['lowercase scheme', `bearer ${RUNTIME.cronSecret}`],
		['extra whitespace', `Bearer  ${RUNTIME.cronSecret}`]
	])('rejects %s authorization before provider or database work', async (_label, authorization) => {
		const createStripeClient = vi.fn();
		const runJob = vi.fn();
		const response = await endpoint({ createStripeClient, runJob })({
			request: request(authorization)
		});
		expect(response.status).toBe(401);
		expect(response.headers.get('www-authenticate')).toBe('Bearer');
		expect(await response.json()).toEqual({ error: 'Unauthorized' });
		expect(createStripeClient).not.toHaveBeenCalled();
		expect(runJob).not.toHaveBeenCalled();
	});

	it('returns retryable 503 when configuration or scheduled work is unavailable', async () => {
		for (const handler of [
			endpoint({
				readEnvironment: vi.fn(() => {
					throw new Error('config');
				})
			}),
			endpoint({
				runJob: vi.fn(async () => {
					throw new Error('internal');
				})
			}),
			endpoint({ runJob: vi.fn(async () => ({ retryRequired: true })) })
		]) {
			const response = await handler({ request: request(`Bearer ${RUNTIME.cronSecret}`) });
			expect(response.status).toBe(503);
			expect(await response.json()).toEqual({ error: 'Scheduled work is unavailable' });
		}
	});

	it('returns retryable 503 for a valid report that requests another run', async () => {
		const response = await endpoint({
			runJob: vi.fn(async () => ({
				candidates: 1,
				reconciled: 0,
				pending: 0,
				providerFailures: 1,
				purged: 0,
				bucketsDeleted: 0,
				retryRequired: true
			}))
		})({ request: request(`Bearer ${RUNTIME.cronSecret}`) });
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ error: 'Scheduled work is unavailable' });
	});

	it('rejects malformed clocks and result shapes', async () => {
		for (const handler of [
			endpoint({ getNow: vi.fn(() => new Date('invalid')) }),
			endpoint({ runJob: vi.fn(async () => null) }),
			endpoint({ runJob: vi.fn(async () => ({ candidates: -1 })) }),
			endpoint({
				runJob: vi.fn(async () => ({
					candidates: 0,
					reconciled: 0,
					pending: 0,
					providerFailures: 0,
					purged: 0,
					bucketsDeleted: 0,
					retryRequired: 'no'
				}))
			})
		]) {
			const response = await handler({ request: request(`Bearer ${RUNTIME.cronSecret}`) });
			expect(response.status).toBe(503);
		}
	});

	it.each([null, [], { ...RUNTIME, stripeMode: 'preview' }, { ...RUNTIME, cronSecret: 4 }])(
		'rejects malformed narrow runtime %j',
		async (runtime) => {
			const response = await endpoint({ readEnvironment: vi.fn(() => runtime) })({
				request: request(`Bearer ${RUNTIME.cronSecret}`)
			});
			expect(response.status).toBe(503);
		}
	);

	it('exercises the production default readers without provider work', async () => {
		const unavailable = _createBookDeliveryCronEndpoint({});
		const response = await unavailable({ request: request(undefined) });
		expect(response.status).toBe(503);

		const runJob = vi.fn(async () => ({
			candidates: 0,
			reconciled: 0,
			pending: 0,
			providerFailures: 0,
			purged: 0,
			bucketsDeleted: 0,
			retryRequired: false
		}));
		const withDefaultClock = _createBookDeliveryCronEndpoint({
			readEnvironment: vi.fn(() => RUNTIME),
			createStripeClient: vi.fn(() => ({})),
			runJob
		});
		await withDefaultClock({ request: request(`Bearer ${RUNTIME.cronSecret}`) });
		expect(runJob).toHaveBeenCalledWith(expect.objectContaining({ now: expect.any(Date) }));
	});
});
