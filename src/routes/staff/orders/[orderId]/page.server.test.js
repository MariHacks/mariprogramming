// @ts-nocheck
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import {
	StaffOrderConflictError,
	StaffOrderNotFoundError,
	StaffOrderUnavailableError,
	StaffOrderValidationError
} from '$lib/server/orders/staff-repository.js';
import { StripeStaffCancellationError } from '$lib/server/orders/cancellation-provider.js';
import { StaffActionRequestError } from '$lib/server/staff/request.js';
import { _createStaffOrderDetailHandlers } from './+page.server.js';

const ORDER_ID = '10000000-0000-4000-8000-000000000001';
const ATTEMPT_ID = '20000000-0000-4000-8000-000000000001';
const REQUEST_ID = '60000000-0000-4000-8000-000000000001';
const STAFF = Object.freeze({
	userId: 'staff-user',
	sessionId: 'staff-session',
	email: 'team@marihacks.com'
});
const RUNTIME = Object.freeze({
	appOrigin: 'https://club.example.com',
	databaseUrl: 'postgresql://staff:secret@db.example.com/club',
	rateLimitHmacKey: 'long-rate-key-long-rate-key-long-rate-key',
	approvedHostnames: ['shop.example.com']
});
const DETAIL = Object.freeze({
	id: ORDER_ID,
	publicReference: 'MPC-ABCDEFGH2345',
	paymentStatus: 'paid',
	fulfillmentStatus: 'unstarted',
	version: 4,
	nextFulfillmentStatus: 'purchasing',
	canCancel: false
});
const SEED = Object.freeze({
	orderId: ORDER_ID,
	attemptId: ATTEMPT_ID,
	expectedVersion: 4,
	attemptVersion: 1,
	sessionId: 'cs_test_staff_order',
	paymentIntentId: null,
	totalCents: 5404,
	customerEmail: 'student@example.com',
	attemptStatus: 'ready'
});
const EVIDENCE = Object.freeze({
	orderId: ORDER_ID,
	attemptId: ATTEMPT_ID,
	sessionId: 'cs_test_staff_order',
	paymentIntentId: null,
	totalCents: 5404,
	customerEmail: 'student@example.com',
	providerStatus: 'expired'
});

function repository(overrides = {}) {
	return {
		getStaffOrderDetail: vi.fn(async () => DETAIL),
		advanceFulfillment: vi.fn(async () => ({
			id: ORDER_ID,
			paymentStatus: 'paid',
			fulfillmentStatus: 'purchasing',
			version: 5,
			piiPurgeAfter: null
		})),
		loadCancellationSeed: vi.fn(async () => SEED),
		cancelOrder: vi.fn(async () => ({
			id: ORDER_ID,
			paymentStatus: 'cancelled',
			fulfillmentStatus: 'unstarted',
			version: 5,
			piiPurgeAfter: new Date('2026-11-11T16:00:00.000Z')
		})),
		...overrides
	};
}

function setup(overrides = {}) {
	const staffRepository = repository(overrides.repository);
	const authorize = vi.fn(() => STAFF);
	const createRepository = vi.fn(() => staffRepository);
	const guardMutation = vi.fn(async () => ({
		staff: STAFF,
		form: { version: '4' },
		requestId: REQUEST_ID,
		runtime: RUNTIME
	}));
	const readCancellationEnvironment = vi.fn(() => ({
		stripeSecretKey: 'sk_test_configured',
		stripeMode: 'test'
	}));
	const stripe = { checkout: { sessions: {} } };
	const createStripe = vi.fn(() => stripe);
	const expireSession = vi.fn(async () => EVIDENCE);
	const handlers = _createStaffOrderDetailHandlers({
		authorize,
		readEnvironment: vi.fn(() => RUNTIME),
		readCancellationEnvironment,
		createRepository,
		guardMutation,
		createStripe,
		expireSession,
		...overrides
	});
	return {
		handlers,
		staffRepository,
		authorize,
		createRepository,
		guardMutation,
		readCancellationEnvironment,
		createStripe,
		expireSession,
		stripe
	};
}

function event(orderId = ORDER_ID) {
	const url = `https://club.example.com/staff/orders/${orderId}`;
	return {
		locals: { staff: STAFF },
		params: { orderId },
		url: new URL(url),
		request: new Request(url, { method: 'POST' }),
		setHeaders: vi.fn()
	};
}

describe('staff order detail load', () => {
	it('reauthorizes and loads the protected order projection', async () => {
		const harness = setup();
		const current = event();
		await expect(harness.handlers.load(current)).resolves.toEqual({
			order: DETAIL,
			unavailable: false
		});
		expect(harness.authorize).toHaveBeenCalledWith(current.locals);
		expect(harness.staffRepository.getStaffOrderDetail).toHaveBeenCalledWith(ORDER_ID);
	});

	it('authorizes before configuration or identifier handling', async () => {
		const denied = new Error('redirect');
		const readEnvironment = vi.fn();
		const harness = setup({
			authorize: vi.fn(() => {
				throw denied;
			}),
			readEnvironment
		});
		await expect(harness.handlers.load(event('not-an-id'))).rejects.toBe(denied);
		expect(readEnvironment).not.toHaveBeenCalled();
	});

	it.each([
		[new StaffOrderNotFoundError(), 404],
		[new StaffOrderValidationError(), 404]
	])(
		'returns a bounded not found response for an absent or invalid order',
		async (failure, status) => {
			const harness = setup({
				repository: {
					getStaffOrderDetail: vi.fn(async () => {
						throw failure;
					})
				}
			});
			await expect(harness.handlers.load(event())).rejects.toMatchObject({ status });
		}
	);

	it.each(['configuration', 'repository'])(
		'returns a bounded %s unavailable state',
		async (kind) => {
			const harness = setup(
				kind === 'configuration'
					? {
							readEnvironment: vi.fn(() => {
								throw new Error('secret');
							})
						}
					: {
							repository: {
								getStaffOrderDetail: vi.fn(async () => {
									throw new StaffOrderUnavailableError();
								})
							}
						}
			);
			await expect(harness.handlers.load(event())).resolves.toEqual({
				order: null,
				unavailable: true
			});
		}
	);

	it('does not hide an unexpected load defect', async () => {
		const defect = new TypeError('load programming defect');
		const harness = setup({
			repository: {
				getStaffOrderDetail: vi.fn(async () => {
					throw defect;
				})
			}
		});
		await expect(harness.handlers.load(event())).rejects.toBe(defect);
	});
});

describe('staff order detail actions', () => {
	it('exports only advance and cancel POST actions, with no refund path', () => {
		const { handlers } = setup();
		expect(Object.keys(handlers.actions)).toEqual(['advance', 'cancel']);
		expect(handlers.actions).not.toHaveProperty('refund');
		expect(handlers.actions).not.toHaveProperty('default');
	});

	it('advances only through the guarded server-derived fulfillment action', async () => {
		const harness = setup();
		const current = event();
		await expect(harness.handlers.actions.advance(current)).resolves.toEqual({
			success: true,
			message: 'Order moved to purchasing.',
			order: expect.objectContaining({ fulfillmentStatus: 'purchasing', version: 5 })
		});
		expect(harness.guardMutation).toHaveBeenCalledWith(current, {
			action: 'orders_advance_fulfillment',
			fields: ['version'],
			route: '/staff/orders/[orderId]'
		});
		expect(harness.staffRepository.advanceFulfillment).toHaveBeenCalledWith({
			orderId: ORDER_ID,
			expectedVersion: 4,
			actor: { userId: STAFF.userId, email: STAFF.email, requestId: REQUEST_ID }
		});
	});

	it('rejects a malformed version before opening the repository', async () => {
		const harness = setup({
			guardMutation: vi.fn(async () => ({
				staff: STAFF,
				form: { version: '1.5' },
				requestId: REQUEST_ID,
				runtime: RUNTIME
			}))
		});
		const response = await harness.handlers.actions.advance(event());
		expect(response.status).toBe(400);
		expect(harness.createRepository).not.toHaveBeenCalled();
	});

	it.each([
		[new StaffActionRequestError(400), 400, 'Reload this order and try again.'],
		[
			new StaffActionRequestError(403),
			403,
			'This request could not be verified. Reload and try again.'
		],
		[new StaffActionRequestError(429, 10), 429, 'Too many changes. Wait a moment and try again.'],
		[new StaffActionRequestError(503), 503, 'Order changes are unavailable. Try again.'],
		[new StaffOrderConflictError(), 409, 'This order changed. Reload it before trying again.'],
		[new StaffOrderNotFoundError(), 404, 'This order is no longer available.'],
		[new StaffOrderValidationError(), 400, 'Reload this order and try again.'],
		[new StaffOrderUnavailableError(), 503, 'Order changes are unavailable. Try again.']
	])('maps an advance failure to %i', async (failure, status, message) => {
		const harness =
			failure instanceof StaffActionRequestError
				? setup({
						guardMutation: vi.fn(async () => {
							throw failure;
						})
					})
				: setup({
						repository: {
							advanceFulfillment: vi.fn(async () => {
								throw failure;
							})
						}
					});
		const response = await harness.handlers.actions.advance(event());
		expect(response.status).toBe(status);
		expect(response.data).toEqual({ errorSummary: message });
	});

	it('does not hide unexpected guard or order-operation defects', async () => {
		const guardDefect = new TypeError('guard programming defect');
		const guarded = setup({
			guardMutation: vi.fn(async () => {
				throw guardDefect;
			})
		});
		await expect(guarded.handlers.actions.advance(event())).rejects.toBe(guardDefect);

		const repositoryDefect = new TypeError('repository programming defect');
		const repositoryHarness = setup({
			repository: {
				advanceFulfillment: vi.fn(async () => {
					throw repositoryDefect;
				})
			}
		});
		await expect(repositoryHarness.handlers.actions.advance(event())).rejects.toBe(
			repositoryDefect
		);
	});

	it('expires Stripe outside both short database transactions, then cancels by compare-and-set', async () => {
		const sequence = [];
		const staffRepository = repository({
			loadCancellationSeed: vi.fn(async () => {
				sequence.push('seed-commit');
				return SEED;
			}),
			cancelOrder: vi.fn(async () => {
				sequence.push('cancel-commit');
				return {
					id: ORDER_ID,
					paymentStatus: 'cancelled',
					fulfillmentStatus: 'unstarted',
					version: 5
				};
			})
		});
		const expireSession = vi.fn(async () => {
			sequence.push('provider-expire');
			return EVIDENCE;
		});
		const harness = setup({
			createRepository: vi.fn(() => staffRepository),
			expireSession
		});
		const current = event();
		await expect(harness.handlers.actions.cancel(current)).resolves.toEqual({
			success: true,
			message: 'Unpaid order cancelled.',
			order: expect.objectContaining({ paymentStatus: 'cancelled' })
		});
		expect(sequence).toEqual(['seed-commit', 'provider-expire', 'cancel-commit']);
		expect(harness.guardMutation).toHaveBeenCalledWith(current, {
			action: 'orders_cancel_unpaid',
			fields: ['version'],
			route: '/staff/orders/[orderId]'
		});
		expect(staffRepository.loadCancellationSeed).toHaveBeenCalledWith({
			orderId: ORDER_ID,
			expectedVersion: 4
		});
		expect(harness.createStripe).toHaveBeenCalledWith('sk_test_configured');
		expect(expireSession).toHaveBeenCalledWith(harness.stripe, 'sk_test_configured', SEED);
		expect(staffRepository.cancelOrder).toHaveBeenCalledWith({
			orderId: ORDER_ID,
			expectedVersion: 4,
			evidence: EVIDENCE,
			actor: { userId: STAFF.userId, email: STAFF.email, requestId: REQUEST_ID }
		});
	});

	it('stops before Stripe when the seed shows a paid webhook race', async () => {
		const harness = setup({
			repository: {
				loadCancellationSeed: vi.fn(async () => {
					throw new StaffOrderConflictError();
				})
			}
		});
		const response = await harness.handlers.actions.cancel(event());
		expect(response.status).toBe(409);
		expect(harness.createStripe).not.toHaveBeenCalled();
		expect(harness.expireSession).not.toHaveBeenCalled();
		expect(harness.staffRepository.cancelOrder).not.toHaveBeenCalled();
	});

	it.each([
		[
			'provider mismatch',
			new StripeStaffCancellationError(),
			409,
			'Stripe no longer shows an unpaid checkout. Reload this order before trying again.'
		],
		[
			'provider outage',
			new Error('provider secret'),
			503,
			'Stripe could not confirm the cancellation. The order was not changed. Try again.'
		],
		[
			'missing provider configuration',
			new Error('configuration secret'),
			503,
			'Stripe could not confirm the cancellation. The order was not changed. Try again.'
		]
	])('does not mutate the database after %s', async (kind, failure, status, message) => {
		const harness = setup(
			kind === 'missing provider configuration'
				? {
						readCancellationEnvironment: vi.fn(() => {
							throw failure;
						})
					}
				: {
						expireSession: vi.fn(async () => {
							throw failure;
						})
					}
		);
		const response = await harness.handlers.actions.cancel(event());
		expect(response.status).toBe(status);
		expect(response.data).toEqual({ errorSummary: message });
		expect(harness.staffRepository.cancelOrder).not.toHaveBeenCalled();
	});

	it('reports a paid webhook win after provider expiry without overwriting it', async () => {
		const harness = setup({
			repository: {
				cancelOrder: vi.fn(async () => {
					throw new StaffOrderConflictError();
				})
			}
		});
		const response = await harness.handlers.actions.cancel(event());
		expect(response.status).toBe(409);
		expect(response.data).toEqual({
			errorSummary: 'This order changed. Reload it before trying again.'
		});
	});
});
