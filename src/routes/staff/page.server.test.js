// @ts-nocheck
// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import {
	StaffOrderUnavailableError,
	StaffOrderValidationError
} from '$lib/server/orders/staff-repository.js';
import { StaffActionRequestError } from '$lib/server/staff/request.js';
import { _createStaffOrderLedgerHandlers } from './+page.server.js';

const STAFF = Object.freeze({
	userId: 'staff-user',
	sessionId: 'staff-session',
	email: 'team@marihacks.com'
});
const REQUEST_ID = '60000000-0000-4000-8000-000000000001';
const RUNTIME = Object.freeze({
	appOrigin: 'https://club.example.com',
	databaseUrl: 'postgresql://staff:secret@db.example.com/club',
	rateLimitHmacKey: 'long-rate-key-long-rate-key-long-rate-key',
	approvedHostnames: ['shop.example.com']
});
const EMPTY_LIST = Object.freeze({
	orders: [],
	totalCount: 0,
	page: 1,
	pageSize: 25,
	hasPrevious: false,
	hasNext: false,
	filters: { payment: 'actionable', fulfillment: 'all' }
});

function repository(overrides = {}) {
	return {
		listStaffOrders: vi.fn(async () => EMPTY_LIST),
		searchStaffOrders: vi.fn(async () => ({
			...EMPTY_LIST,
			filters: { payment: 'all', fulfillment: 'all' },
			query: 'student@example.com',
			queryKind: 'email'
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
		form: { query: 'student@example.com', page: '1' },
		requestId: REQUEST_ID,
		runtime: RUNTIME
	}));
	const handlers = _createStaffOrderLedgerHandlers({
		authorize,
		readEnvironment: vi.fn(() => RUNTIME),
		createRepository,
		guardMutation,
		...overrides
	});
	return { handlers, staffRepository, authorize, createRepository, guardMutation };
}

function event(url = 'https://club.example.com/staff') {
	return {
		locals: { staff: STAFF },
		url: new URL(url),
		request: new Request(url, { method: 'POST' }),
		setHeaders: vi.fn()
	};
}

describe('staff order ledger load', () => {
	it('reauthorizes and loads a bounded newest-first ledger through exact filters', async () => {
		const current = event(
			'https://club.example.com/staff?payment=paid&fulfillment=received&page=2'
		);
		const harness = setup();
		await expect(harness.handlers.load(current)).resolves.toEqual({
			listing: EMPTY_LIST,
			unavailable: false
		});
		expect(harness.authorize).toHaveBeenCalledWith(current.locals);
		expect(harness.staffRepository.listStaffOrders).toHaveBeenCalledWith({
			payment: 'paid',
			fulfillment: 'received',
			page: '2'
		});
		expect(harness.createRepository).toHaveBeenCalledWith({
			databaseUrl: RUNTIME.databaseUrl,
			approvedHostnames: RUNTIME.approvedHostnames
		});
	});

	it('authorizes before reading configuration', async () => {
		const denied = new Error('redirect');
		const readEnvironment = vi.fn();
		const harness = setup({
			authorize: vi.fn(() => {
				throw denied;
			}),
			readEnvironment
		});
		await expect(harness.handlers.load(event())).rejects.toBe(denied);
		expect(readEnvironment).not.toHaveBeenCalled();
	});

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
								listStaffOrders: vi.fn(async () => {
									throw new StaffOrderUnavailableError();
								})
							}
						}
			);
			await expect(harness.handlers.load(event())).resolves.toEqual({
				listing: EMPTY_LIST,
				unavailable: true
			});
		}
	);

	it('maps an invalid filter to a generic client error', async () => {
		const harness = setup({
			repository: {
				listStaffOrders: vi.fn(async () => {
					throw new StaffOrderValidationError();
				})
			}
		});
		await expect(
			harness.handlers.load(event('https://club.example.com/staff?payment=forged'))
		).rejects.toMatchObject({ status: 400 });
	});

	it('does not hide an unexpected load defect', async () => {
		const defect = new TypeError('programming defect');
		const harness = setup({
			repository: {
				listStaffOrders: vi.fn(async () => {
					throw defect;
				})
			}
		});
		await expect(harness.handlers.load(event())).rejects.toBe(defect);
	});
});

describe('staff order exact search action', () => {
	it('exports only one POST search action', () => {
		const { handlers } = setup();
		expect(Object.keys(handlers.actions)).toEqual(['search']);
		expect(handlers.actions).not.toHaveProperty('default');
	});

	it('guards the POST and returns exact protected search results without a URL query', async () => {
		const harness = setup();
		const current = event('https://club.example.com/staff?/search');
		await expect(harness.handlers.actions.search(current)).resolves.toEqual({
			success: true,
			search: expect.objectContaining({
				query: 'student@example.com',
				queryKind: 'email'
			})
		});
		expect(harness.guardMutation).toHaveBeenCalledWith(current, {
			action: 'orders_search',
			fields: ['query', 'page'],
			route: '/staff'
		});
		expect(harness.staffRepository.searchStaffOrders).toHaveBeenCalledWith(
			'student@example.com',
			'1'
		);
		expect(current.url.searchParams.has('query')).toBe(false);
	});

	it.each([
		[new StaffActionRequestError(400), 400, 'Check the search and try again.'],
		[
			new StaffActionRequestError(403),
			403,
			'This request could not be verified. Reload and try again.'
		],
		[new StaffActionRequestError(413), 413, 'This search is too large. Shorten it and try again.'],
		[new StaffActionRequestError(415), 415, 'This form could not be read. Reload and try again.'],
		[new StaffActionRequestError(429, 20), 429, 'Too many searches. Wait a moment and try again.'],
		[new StaffActionRequestError(503), 503, 'Order search is unavailable. Try again.']
	])(
		'maps a guarded failure to %i without retaining submitted PII',
		async (failure, status, message) => {
			const harness = setup({
				guardMutation: vi.fn(async () => {
					throw failure;
				})
			});
			const response = await harness.handlers.actions.search(event());
			expect(response.status).toBe(status);
			expect(response.data).toEqual({ errorSummary: message });
			expect(JSON.stringify(response.data)).not.toContain('student@example.com');
		}
	);

	it.each([
		[new StaffOrderValidationError(), 400, 'Enter a complete order reference or email address.'],
		[new StaffOrderUnavailableError(), 503, 'Order search is unavailable. Try again.']
	])('maps a repository failure to %i', async (failure, status, message) => {
		const harness = setup({
			repository: {
				searchStaffOrders: vi.fn(async () => {
					throw failure;
				})
			}
		});
		const response = await harness.handlers.actions.search(event());
		expect(response.status).toBe(status);
		expect(response.data).toEqual({ errorSummary: message });
	});

	it('does not hide an unexpected search defect', async () => {
		const defect = new TypeError('programming defect');
		const harness = setup({
			repository: {
				searchStaffOrders: vi.fn(async () => {
					throw defect;
				})
			}
		});
		await expect(harness.handlers.actions.search(event())).rejects.toBe(defect);
	});

	it('does not hide an unexpected guard defect', async () => {
		const defect = new TypeError('guard programming defect');
		const harness = setup({
			guardMutation: vi.fn(async () => {
				throw defect;
			})
		});
		await expect(harness.handlers.actions.search(event())).rejects.toBe(defect);
	});
});
