// @ts-nocheck
// @vitest-environment node

import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import {
	StaffOrderConflictError,
	StaffOrderNotFoundError,
	StaffOrderUnavailableError,
	StaffOrderValidationError,
	advanceFulfillmentInTransaction,
	cancelStaffOrderInTransaction,
	createStaffOrderRepository,
	listBookstorePurchaseRowsInTransaction,
	loadCancellationSeedInTransaction,
	maskStaffOrderEmail,
	nextFulfillmentStatus,
	normalizeStaffOrderId,
	normalizeStaffOrderListQuery,
	normalizeStaffOrderSearch
} from './staff-repository.js';

const ORDER_ID = '10000000-0000-4000-8000-000000000001';
const ATTEMPT_ID = '20000000-0000-4000-8000-000000000001';
const REQUEST_ID = '30000000-0000-4000-8000-000000000001';
const STAFF = Object.freeze({
	userId: 'staff-user',
	email: 'team@marihacks.com',
	requestId: REQUEST_ID
});
const NOW = new Date('2026-08-13T16:00:00.000Z');

function compile(query) {
	return new PgDialect().sqlToQuery(query);
}

function result(rows) {
	return { rows };
}

function transactionWith(...responses) {
	return {
		execute: vi.fn(async () => result(responses.shift() ?? []))
	};
}

function orderRow(overrides = {}) {
	return {
		order_id: ORDER_ID,
		customer_name: 'Student Name',
		customer_email: 'student@example.com',
		public_reference: 'MPC-ABCDEFGH2345',
		currency: 'cad',
		payment_status: 'paid',
		fulfillment_status: 'unstarted',
		version: 4,
		subtotal_cents: 4200,
		service_fee_cents: 500,
		tax_cents: 704,
		total_cents: 5404,
		refunded_amount_cents: 0,
		created_at: new Date('2026-08-13T14:00:00.000Z'),
		updated_at: new Date('2026-08-13T15:00:00.000Z'),
		pii_purge_after: null,
		attempt_id: ATTEMPT_ID,
		attempt_status: 'completed',
		attempt_version: 2,
		stripe_session_id: 'cs_test_staff_order',
		payment_intent_id: 'pi_staff_order',
		stripe_charge_id: 'ch_staff_order',
		stripe_expires_at: new Date('2026-08-14T14:00:00.000Z'),
		checkout_ready_at: new Date('2026-08-13T14:05:00.000Z'),
		terminal_at: new Date('2026-08-13T14:10:00.000Z'),
		...overrides
	};
}

function lineRow(overrides = {}) {
	return {
		line_id: '40000000-0000-4000-8000-000000000001',
		kind: 'book',
		label: 'The C Programming Language',
		isbn: '9780131103627',
		bookstore_id: '50000000-0000-4000-8000-000000000001',
		bookstore_name: 'Campus Books',
		book_id: '60000000-0000-4000-8000-000000000001',
		teacher_name: 'Ada Lovelace',
		course_code: 'CSC 205',
		course_title: 'Data Structures',
		quantity: 1,
		unit_amount_cents: 4200,
		line_amount_cents: 4200,
		current_retailer_url: 'https://shop.example.com/books/c-programming',
		...overrides
	};
}

function serviceFeeRow(overrides = {}) {
	return lineRow({
		line_id: '40000000-0000-4000-8000-000000000002',
		kind: 'service_fee',
		label: 'Campus Books pickup service',
		isbn: null,
		book_id: null,
		teacher_name: null,
		course_code: null,
		course_title: null,
		quantity: 1,
		unit_amount_cents: 500,
		line_amount_cents: 500,
		current_retailer_url: null,
		...overrides
	});
}

describe('staff order request normalization', () => {
	it('defaults the ledger to the first bounded actionable page', () => {
		expect(normalizeStaffOrderListQuery({ payment: '', fulfillment: '', page: '' })).toEqual({
			payment: 'actionable',
			fulfillment: 'all',
			page: 1,
			pageSize: 25
		});
	});

	it.each([
		['all', 'all'],
		['pending', 'unstarted'],
		['paid', 'purchasing'],
		['partially_refunded', 'received'],
		['refunded', 'ready_for_pickup'],
		['expired', 'picked_up'],
		['failed', 'all'],
		['cancelled', 'all']
	])('accepts payment %s and fulfillment %s', (payment, fulfillment) => {
		expect(normalizeStaffOrderListQuery({ payment, fulfillment, page: '42' })).toEqual({
			payment,
			fulfillment,
			page: 42,
			pageSize: 25
		});
	});

	it.each([
		[null, 'null query'],
		[[], 'array query'],
		[{ payment: 'forged', fulfillment: 'all', page: '1' }, 'unknown payment'],
		[{ payment: 'paid', fulfillment: 'shipped', page: '1' }, 'unknown fulfillment'],
		[{ payment: 'paid', fulfillment: 'all', page: '0' }, 'zero page'],
		[{ payment: 'paid', fulfillment: 'all', page: '-1' }, 'negative page'],
		[{ payment: 'paid', fulfillment: 'all', page: '1.5' }, 'fractional page'],
		[{ payment: 'paid', fulfillment: 'all', page: '10001' }, 'unbounded page'],
		[{ payment: null, fulfillment: 'all', page: '1' }, 'non-string payment']
	])('rejects %s', (input) => {
		expect(() => normalizeStaffOrderListQuery(input)).toThrow(StaffOrderValidationError);
	});

	it('accepts the last bounded page without risking an unsafe offset', () => {
		expect(
			normalizeStaffOrderListQuery({ payment: 'all', fulfillment: 'all', page: '10000' })
		).toMatchObject({ page: 10000, pageSize: 25 });
	});

	it.each([
		[' MPC-ABCDEFGH2345 ', { kind: 'reference', value: 'MPC-ABCDEFGH2345' }],
		['Student.Name+books@Example.COM', { kind: 'email', value: 'student.name+books@example.com' }]
	])('normalizes exact POST search %s', (input, expected) => {
		expect(normalizeStaffOrderSearch(input)).toEqual(expected);
	});

	it.each([
		'',
		'MPC-AAAAAAAAAAAA?payment=paid',
		'partial@example',
		'@example.com',
		'student@example.com\nsecond@example.com',
		'a'.repeat(255)
	])('rejects unsafe or partial search %s', (input) => {
		expect(() => normalizeStaffOrderSearch(input)).toThrow(StaffOrderValidationError);
	});

	it('accepts only a stored UUID-shaped order identifier', () => {
		expect(normalizeStaffOrderId(ORDER_ID)).toBe(ORDER_ID);
		expect(() => normalizeStaffOrderId('1')).toThrow(StaffOrderValidationError);
		expect(() => normalizeStaffOrderId(`${ORDER_ID}?email=student@example.com`)).toThrow(
			StaffOrderValidationError
		);
	});
});

describe('staff order disclosure helpers', () => {
	it.each([
		['student@example.com', 's*****t@example.com'],
		['ab@example.com', 'a*@example.com'],
		['a@example.com', '*@example.com'],
		['first.last+books@school.example', 'f**************s@school.example']
	])('masks %s for the ledger', (email, masked) => {
		expect(maskStaffOrderEmail(email)).toBe(masked);
	});

	it.each(['', 'invalid', '@example.com', 'a@', 'a\nb@example.com'])(
		'rejects a malformed stored email %s',
		(email) => {
			expect(() => maskStaffOrderEmail(email)).toThrow();
		}
	);
});

describe('server-owned fulfillment sequence', () => {
	it.each([
		['unstarted', 'purchasing'],
		['purchasing', 'received'],
		['received', 'ready_for_pickup']
	])('derives %s to %s for a paid order', (current, expected) => {
		expect(nextFulfillmentStatus('paid', current)).toBe(expected);
	});

	it.each(['ready_for_pickup', 'picked_up'])('has no next action from %s', (status) => {
		expect(nextFulfillmentStatus('paid', status)).toBeNull();
	});

	it.each(['pending', 'partially_refunded', 'refunded', 'expired', 'failed', 'cancelled'])(
		'halts new fulfillment when payment is %s',
		(payment) => {
			expect(() => nextFulfillmentStatus(payment, 'received')).toThrow(StaffOrderConflictError);
		}
	);

	it.each(['new', '', null])('rejects unknown fulfillment state %s', (fulfillment) => {
		expect(() => nextFulfillmentStatus('paid', fulfillment)).toThrow(StaffOrderValidationError);
	});

	it('rejects an unknown payment state before deriving fulfillment', () => {
		expect(() => nextFulfillmentStatus('unknown', 'received')).toThrow(StaffOrderValidationError);
	});
});

describe('staff order ledger repository', () => {
	function repositoryWith(responses) {
		const transaction = transactionWith(...responses);
		const runTransaction = vi.fn(async (operation) => operation(transaction));
		return {
			repository: createStaffOrderRepository({
				databaseUrl: 'postgresql://staff:secret@db.example.com/club',
				approvedHostnames: ['shop.example.com'],
				runTransaction,
				getNow: () => NOW
			}),
			transaction,
			runTransaction
		};
	}

	it('lists the actionable queue newest first in bounded pages with masked email', async () => {
		const row = orderRow();
		const harness = repositoryWith([[{ total_count: '1' }], [row]]);
		await expect(
			harness.repository.listStaffOrders({ payment: '', fulfillment: '', page: '' })
		).resolves.toEqual({
			orders: [
				{
					id: ORDER_ID,
					publicReference: 'MPC-ABCDEFGH2345',
					maskedEmail: 's*****t@example.com',
					paymentStatus: 'paid',
					fulfillmentStatus: 'unstarted',
					totalCents: 5404,
					version: 4,
					createdAt: '2026-08-13T14:00:00.000Z',
					ageSeconds: 7200
				}
			],
			totalCount: 1,
			page: 1,
			pageSize: 25,
			hasPrevious: false,
			hasNext: false,
			filters: { payment: 'actionable', fulfillment: 'all' }
		});
		const [countQuery, rowsQuery] = harness.transaction.execute.mock.calls.map(([query]) =>
			compile(query)
		);
		expect(countQuery.sql).toContain("payment_status = 'paid'");
		expect(countQuery.sql).toContain("fulfillment_status <> 'picked_up'");
		expect(rowsQuery.sql).toContain('ORDER BY created_at DESC, id DESC');
		expect(rowsQuery.sql).toContain('LIMIT');
		expect(rowsQuery.params).toEqual(expect.arrayContaining([25, 0]));
		expect(rowsQuery.sql).not.toContain('customer_name');
	});

	it('applies explicit non-PII filters and calculates page bounds', async () => {
		const harness = repositoryWith([[{ total_count: 26 }], [orderRow()]]);
		await expect(
			harness.repository.listStaffOrders({
				payment: 'partially_refunded',
				fulfillment: 'received',
				page: '2'
			})
		).resolves.toMatchObject({
			totalCount: 26,
			page: 2,
			hasPrevious: true,
			hasNext: false,
			filters: { payment: 'partially_refunded', fulfillment: 'received' }
		});
		const queries = harness.transaction.execute.mock.calls.map(([query]) => compile(query));
		expect(queries[0].params).toEqual(expect.arrayContaining(['partially_refunded', 'received']));
		expect(queries[1].params).toEqual(expect.arrayContaining([25, 25]));
	});

	it('returns a stable empty page without inventing data', async () => {
		const harness = repositoryWith([[{ total_count: '0' }], []]);
		await expect(
			harness.repository.listStaffOrders({ payment: 'all', fulfillment: 'all', page: '1' })
		).resolves.toMatchObject({ orders: [], totalCount: 0, hasPrevious: false, hasNext: false });
	});

	it('accepts the bounded PostgreSQL timestamptz representation returned by raw queries', async () => {
		const harness = repositoryWith([
			[{ total_count: '1' }],
			[orderRow({ created_at: '2026-08-13 10:00:00-04' })]
		]);
		await expect(
			harness.repository.listStaffOrders({ payment: 'all', fulfillment: 'all', page: '1' })
		).resolves.toMatchObject({
			orders: [{ createdAt: '2026-08-13T14:00:00.000Z', ageSeconds: 7200 }]
		});
	});

	it('searches by one exact full email without substring matching', async () => {
		const harness = repositoryWith([[{ total_count: '1' }], [orderRow()]]);
		await expect(
			harness.repository.searchStaffOrders(' Student@Example.com ', '1')
		).resolves.toMatchObject({
			query: 'student@example.com',
			queryKind: 'email',
			orders: [{ maskedEmail: 's*****t@example.com' }]
		});
		for (const [query] of harness.transaction.execute.mock.calls) {
			const compiled = compile(query);
			expect(compiled.sql).toContain('lower(customer_email) =');
			expect(compiled.sql).not.toMatch(/LIKE|ILIKE/u);
			expect(compiled.params).toContain('student@example.com');
		}
	});

	it('searches a public reference exactly and keeps the query out of the result URL contract', async () => {
		const harness = repositoryWith([[{ total_count: 1 }], [orderRow()]]);
		await expect(
			harness.repository.searchStaffOrders('MPC-ABCDEFGH2345', 1)
		).resolves.toMatchObject({
			query: 'MPC-ABCDEFGH2345',
			queryKind: 'reference'
		});
		const compiled = compile(harness.transaction.execute.mock.calls[0][0]);
		expect(compiled.sql).toContain('public_reference =');
		expect(compiled.params).toContain('MPC-ABCDEFGH2345');
	});

	it.each([
		['missing count', [[], []]],
		['duplicate count', [[{ total_count: 1 }, { total_count: 1 }], []]],
		['negative count', [[{ total_count: '-1' }], []]],
		['too many rows', [[{ total_count: 26 }], Array.from({ length: 26 }, orderRow)]],
		['malformed row', [[{ total_count: 1 }], [orderRow({ total_cents: -1 })]]],
		[
			'malformed stored email',
			[[{ total_count: 1 }], [orderRow({ customer_email: 'not-an-email' })]]
		],
		['malformed ledger state', [[{ total_count: 1 }], [orderRow({ payment_status: 'unknown' })]]],
		[
			'malformed stored timestamp',
			[[{ total_count: 1 }], [orderRow({ created_at: 'not-a-date' })]]
		],
		[
			'impossible matching timestamp',
			[[{ total_count: 1 }], [orderRow({ created_at: '9999-99-99 99:99:99+00' })]]
		],
		[
			'future order age',
			[[{ total_count: 1 }], [orderRow({ created_at: new Date('2026-08-13T17:00:00.000Z') })]]
		],
		['database failure', null]
	])('fails closed for %s', async (_label, responses) => {
		if (responses === null) {
			const repository = createStaffOrderRepository({
				databaseUrl: 'postgresql://staff:secret@db.example.com/club',
				approvedHostnames: ['shop.example.com'],
				runTransaction: vi.fn(async () => {
					throw new Error('database secret');
				})
			});
			await expect(
				repository.listStaffOrders({ payment: '', fulfillment: '', page: '' })
			).rejects.toBeInstanceOf(StaffOrderUnavailableError);
			return;
		}
		const harness = repositoryWith(responses);
		await expect(
			harness.repository.listStaffOrders({ payment: '', fulfillment: '', page: '' })
		).rejects.toBeInstanceOf(StaffOrderUnavailableError);
	});
});

describe('protected order detail projection', () => {
	it('returns full protected customer data, grouped immutable receipt, current links, and allowlisted history', async () => {
		const serviceFee = serviceFeeRow();
		const transaction = transactionWith(
			[orderRow()],
			[lineRow(), serviceFee],
			[
				{
					audit_id: '70000000-0000-4000-8000-000000000001',
					actor_kind: 'stripe',
					action: 'stripe_completed_applied',
					previous_state: { paymentStatus: 'pending', fulfillmentStatus: 'unstarted' },
					next_state: { paymentStatus: 'paid', fulfillmentStatus: 'unstarted' },
					created_at: new Date('2026-08-13T14:10:00.000Z')
				},
				{
					audit_id: '70000000-0000-4000-8000-000000000002',
					actor_kind: 'system',
					action: 'unapproved_internal_action',
					previous_state: { raw: 'do not expose' },
					next_state: { secret: 'do not expose' },
					created_at: new Date('2026-08-13T14:11:00.000Z')
				}
			]
		);
		const repository = createStaffOrderRepository({
			databaseUrl: 'postgresql://staff:secret@db.example.com/club',
			approvedHostnames: ['shop.example.com'],
			runTransaction: vi.fn(async (operation) => operation(transaction)),
			getNow: () => NOW
		});

		await expect(repository.getStaffOrderDetail(ORDER_ID)).resolves.toEqual({
			id: ORDER_ID,
			publicReference: 'MPC-ABCDEFGH2345',
			customer: { name: 'Student Name', email: 'student@example.com' },
			currency: 'cad',
			paymentStatus: 'paid',
			fulfillmentStatus: 'unstarted',
			version: 4,
			subtotalCents: 4200,
			serviceFeeCents: 500,
			taxCents: 704,
			totalCents: 5404,
			refundedAmountCents: 0,
			createdAt: '2026-08-13T14:00:00.000Z',
			updatedAt: '2026-08-13T15:00:00.000Z',
			ageSeconds: 7200,
			provider: {
				checkoutSessionId: 'cs_test_staff_order',
				paymentIntentId: 'pi_staff_order',
				chargeId: 'ch_staff_order'
			},
			bookstores: [
				{
					id: '50000000-0000-4000-8000-000000000001',
					name: 'Campus Books',
					lines: [
						{
							id: '40000000-0000-4000-8000-000000000001',
							kind: 'book',
							label: 'The C Programming Language',
							isbn: '9780131103627',
							teacherName: 'Ada Lovelace',
							courseCode: 'CSC 205',
							courseTitle: 'Data Structures',
							quantity: 1,
							unitAmountCents: 4200,
							lineAmountCents: 4200,
							currentRetailerUrl: 'https://shop.example.com/books/c-programming'
						},
						{
							id: '40000000-0000-4000-8000-000000000002',
							kind: 'service_fee',
							label: 'Campus Books pickup service',
							isbn: null,
							teacherName: null,
							courseCode: null,
							courseTitle: null,
							quantity: 1,
							unitAmountCents: 500,
							lineAmountCents: 500,
							currentRetailerUrl: null
						}
					]
				}
			],
			history: [
				{
					id: '70000000-0000-4000-8000-000000000001',
					actorKind: 'stripe',
					action: 'stripe_completed_applied',
					previousPaymentStatus: 'pending',
					nextPaymentStatus: 'paid',
					previousFulfillmentStatus: 'unstarted',
					nextFulfillmentStatus: 'unstarted',
					createdAt: '2026-08-13T14:10:00.000Z'
				}
			],
			nextFulfillmentStatus: 'purchasing',
			canCancel: false
		});
		const detailQueries = transaction.execute.mock.calls.map(([query]) => compile(query));
		expect(detailQueries[0].sql).not.toContain('confirmation_token_hash');
		expect(detailQueries[0].sql).not.toContain('client_request_id');
		expect(detailQueries[0].sql).not.toContain('stripe_idempotency_key');
		expect(detailQueries[1].sql).toContain('retailer_url');
		expect(detailQueries[2].sql).toContain('LIMIT');
	});

	it.each([
		[
			'ready unpaid checkout',
			{
				payment_status: 'pending',
				attempt_status: 'ready',
				payment_intent_id: null,
				stripe_charge_id: null,
				terminal_at: null
			},
			true
		],
		[
			'advanced fulfillment',
			{
				payment_status: 'pending',
				fulfillment_status: 'purchasing',
				attempt_status: 'ready',
				terminal_at: null
			},
			false
		],
		[
			'checkout not ready',
			{
				payment_status: 'pending',
				attempt_status: 'created',
				stripe_session_id: null,
				payment_intent_id: null,
				stripe_charge_id: null,
				stripe_expires_at: null,
				checkout_ready_at: null,
				terminal_at: null
			},
			false
		],
		[
			'ready checkout without a Session',
			{
				payment_status: 'pending',
				attempt_status: 'ready',
				stripe_session_id: null,
				terminal_at: null
			},
			false
		]
	])('derives cancellation availability for %s', async (_label, overrides, canCancel) => {
		const transaction = transactionWith([orderRow(overrides)], [lineRow(), serviceFeeRow()], []);
		const repository = createStaffOrderRepository({
			databaseUrl: 'postgresql://staff:secret@db.example.com/club',
			approvedHostnames: ['shop.example.com'],
			runTransaction: vi.fn(async (operation) => operation(transaction)),
			getNow: () => NOW
		});
		await expect(repository.getStaffOrderDetail(ORDER_ID)).resolves.toMatchObject({
			canCancel,
			nextFulfillmentStatus: null
		});
	});

	it('reduces allowlisted history to known state fields only', async () => {
		const transaction = transactionWith(
			[orderRow()],
			[lineRow(), serviceFeeRow()],
			[
				{
					audit_id: '70000000-0000-4000-8000-000000000001',
					actor_kind: 'system',
					action: 'order_created',
					previous_state: null,
					next_state: { paymentStatus: 'unknown', fulfillmentStatus: 'unknown' },
					created_at: NOW
				}
			]
		);
		const repository = createStaffOrderRepository({
			databaseUrl: 'postgresql://staff:secret@db.example.com/club',
			approvedHostnames: ['shop.example.com'],
			runTransaction: vi.fn(async (operation) => operation(transaction)),
			getNow: () => NOW
		});
		await expect(repository.getStaffOrderDetail(ORDER_ID)).resolves.toMatchObject({
			history: [
				{
					previousPaymentStatus: null,
					nextPaymentStatus: null,
					previousFulfillmentStatus: null,
					nextFulfillmentStatus: null
				}
			]
		});
	});

	it('returns not found without running line or history queries', async () => {
		const transaction = transactionWith([]);
		const repository = createStaffOrderRepository({
			databaseUrl: 'postgresql://staff:secret@db.example.com/club',
			approvedHostnames: ['shop.example.com'],
			runTransaction: vi.fn(async (operation) => operation(transaction))
		});
		await expect(repository.getStaffOrderDetail(ORDER_ID)).rejects.toBeInstanceOf(
			StaffOrderNotFoundError
		);
		expect(transaction.execute).toHaveBeenCalledOnce();
	});

	it.each([
		['duplicate order', [[orderRow(), orderRow()], [], []]],
		['malformed order state', [[orderRow({ currency: 'usd' })], [], []]],
		['inconsistent order total', [[orderRow({ total_cents: 5405 })], [], []]],
		[
			'order update before creation',
			[[orderRow({ updated_at: new Date('2026-08-13T13:00:00.000Z') })], [], []]
		],
		['malformed checkout attempt', [[orderRow({ attempt_version: 0 })], [], []]],
		['no receipt lines', [[orderRow()], [], []]],
		['malformed receipt line', [[orderRow()], [lineRow({ quantity: 0 })], []]],
		['book metadata mismatch', [[orderRow()], [lineRow({ book_id: null })], []]],
		[
			'receipt aggregate mismatch',
			[
				[orderRow()],
				[lineRow({ unit_amount_cents: 4100, line_amount_cents: 4100 }), serviceFeeRow()],
				[]
			]
		],
		[
			'same bookstore identifier with two names',
			[[orderRow()], [lineRow(), serviceFeeRow({ bookstore_name: 'Different Books' })], []]
		],
		[
			'malformed audit state',
			[
				[orderRow()],
				[lineRow(), serviceFeeRow()],
				[
					{
						audit_id: '70000000-0000-4000-8000-000000000001',
						actor_kind: 'system',
						action: 'order_created',
						previous_state: [],
						next_state: null,
						created_at: NOW
					}
				]
			]
		],
		['line totals mismatch', [[orderRow()], [lineRow({ line_amount_cents: 4199 })], []]],
		[
			'unapproved retailer',
			[[orderRow()], [lineRow({ current_retailer_url: 'https://evil.example.net/book' })], []]
		],
		[
			'more than 100 history rows',
			[
				[orderRow()],
				[
					lineRow(),
					lineRow({
						kind: 'service_fee',
						label: 'fee',
						book_id: null,
						teacher_name: null,
						course_code: null,
						course_title: null,
						isbn: null,
						current_retailer_url: null,
						unit_amount_cents: 500,
						line_amount_cents: 500
					})
				],
				Array.from({ length: 101 }, (_, index) => ({
					audit_id: `70000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
					actor_kind: 'system',
					action: 'order_created',
					previous_state: null,
					next_state: null,
					created_at: NOW
				}))
			]
		]
	])('fails closed for %s', async (_label, responses) => {
		const transaction = transactionWith(...responses);
		const repository = createStaffOrderRepository({
			databaseUrl: 'postgresql://staff:secret@db.example.com/club',
			approvedHostnames: ['shop.example.com'],
			runTransaction: vi.fn(async (operation) => operation(transaction)),
			getNow: () => NOW
		});
		await expect(repository.getStaffOrderDetail(ORDER_ID)).rejects.toBeInstanceOf(
			StaffOrderUnavailableError
		);
	});
});

describe('atomic fulfillment advancement', () => {
	it.each([
		['unstarted', 'purchasing', false],
		['purchasing', 'received', false],
		['received', 'ready_for_pickup', false]
	])('moves %s to %s and audits it', async (current, next, schedulesPurge) => {
		const transaction = transactionWith(
			[orderRow({ fulfillment_status: current })],
			[{ order_id: ORDER_ID }],
			[{ audit_id: '70000000-0000-4000-8000-000000000001' }]
		);
		await expect(
			advanceFulfillmentInTransaction(transaction, {
				orderId: ORDER_ID,
				expectedVersion: 4,
				actor: STAFF,
				now: NOW
			})
		).resolves.toEqual({
			id: ORDER_ID,
			paymentStatus: 'paid',
			fulfillmentStatus: next,
			version: 5,
			piiPurgeAfter: schedulesPurge ? new Date('2026-11-11T16:00:00.000Z') : null
		});
		const queries = transaction.execute.mock.calls.map(([query]) => compile(query));
		expect(queries[0].sql).toContain('FOR UPDATE');
		expect(queries[1].sql).toContain("payment_status = 'paid'");
		expect(queries[1].params).toEqual(expect.arrayContaining([current, next, 4]));
		expect(queries[1].sql.includes('pii_purge_after')).toBe(schedulesPurge);
		expect(queries[2].sql).toContain('INSERT INTO audit_log');
		expect(queries[2].params).toContain(`staff_fulfillment_${next}`);
		expect(queries[2].sql).not.toContain('customer_email');
	});

	it.each([
		['stale version', orderRow({ version: 5 })],
		[
			'partial refund',
			orderRow({ payment_status: 'partially_refunded', refunded_amount_cents: 500 })
		],
		['already picked up', orderRow({ fulfillment_status: 'picked_up' })]
	])('rejects %s before mutation', async (_label, row) => {
		const transaction = transactionWith([row]);
		await expect(
			advanceFulfillmentInTransaction(transaction, {
				orderId: ORDER_ID,
				expectedVersion: 4,
				actor: STAFF,
				now: NOW
			})
		).rejects.toBeInstanceOf(StaffOrderConflictError);
		expect(transaction.execute).toHaveBeenCalledOnce();
	});

	it.each([
		[
			'missing transaction',
			null,
			{ orderId: ORDER_ID, expectedVersion: 4, actor: STAFF, now: NOW }
		],
		['invalid input', transactionWith(), null],
		[
			'invalid version',
			transactionWith(),
			{ orderId: ORDER_ID, expectedVersion: 0, actor: STAFF, now: NOW }
		],
		[
			'invalid staff actor',
			transactionWith(),
			{
				orderId: ORDER_ID,
				expectedVersion: 4,
				actor: { ...STAFF, email: 'other@example.com' },
				now: NOW
			}
		]
	])('rejects %s before database mutation', async (_label, transaction, input) => {
		await expect(advanceFulfillmentInTransaction(transaction, input)).rejects.toBeInstanceOf(
			_label === 'missing transaction' ? StaffOrderUnavailableError : StaffOrderValidationError
		);
	});

	it.each([
		['missing locked row', []],
		['duplicate locked row', [orderRow(), orderRow()]],
		['malformed locked row', [orderRow({ currency: 'usd' })]],
		['inconsistent locked totals', [orderRow({ total_cents: 5405 })]],
		['backwards locked timestamp', [orderRow({ updated_at: new Date('2026-08-13T13:00:00.000Z') })]]
	])('fails closed for %s', async (_label, lockedRows) => {
		await expect(
			advanceFulfillmentInTransaction(transactionWith(lockedRows), {
				orderId: ORDER_ID,
				expectedVersion: 4,
				actor: STAFF,
				now: NOW
			})
		).rejects.toBeInstanceOf(
			_label === 'missing locked row' ? StaffOrderNotFoundError : StaffOrderUnavailableError
		);
	});

	it('uses the server clock by default and preserves an existing purge date before pickup', async () => {
		const existingPurge = new Date('2026-12-01T16:00:00.000Z');
		const transaction = transactionWith(
			[orderRow({ pii_purge_after: existingPurge })],
			[{ order_id: ORDER_ID }],
			[{ audit_id: '70000000-0000-4000-8000-000000000001' }]
		);
		await expect(
			advanceFulfillmentInTransaction(transaction, {
				orderId: ORDER_ID,
				expectedVersion: 4,
				actor: STAFF
			})
		).resolves.toMatchObject({ piiPurgeAfter: existingPurge });
	});

	it('fails closed when compare-and-set or audit persistence is unavailable', async () => {
		const cas = transactionWith([orderRow()], []);
		await expect(
			advanceFulfillmentInTransaction(cas, {
				orderId: ORDER_ID,
				expectedVersion: 4,
				actor: STAFF,
				now: NOW
			})
		).rejects.toBeInstanceOf(StaffOrderUnavailableError);

		const wrongCas = transactionWith([orderRow()], [{ order_id: ATTEMPT_ID }]);
		await expect(
			advanceFulfillmentInTransaction(wrongCas, {
				orderId: ORDER_ID,
				expectedVersion: 4,
				actor: STAFF,
				now: NOW
			})
		).rejects.toBeInstanceOf(StaffOrderUnavailableError);

		const audit = transactionWith([orderRow()], [{ order_id: ORDER_ID }], []);
		await expect(
			advanceFulfillmentInTransaction(audit, {
				orderId: ORDER_ID,
				expectedVersion: 4,
				actor: STAFF,
				now: NOW
			})
		).rejects.toBeInstanceOf(StaffOrderUnavailableError);

		const malformedAudit = transactionWith(
			[orderRow()],
			[{ order_id: ORDER_ID }],
			[{ audit_id: 'not-an-audit-id' }]
		);
		await expect(
			advanceFulfillmentInTransaction(malformedAudit, {
				orderId: ORDER_ID,
				expectedVersion: 4,
				actor: STAFF,
				now: NOW
			})
		).rejects.toBeInstanceOf(StaffOrderUnavailableError);
	});
});

describe('cancellation persistence boundary', () => {
	function readyRow(overrides = {}) {
		return orderRow({
			payment_status: 'pending',
			fulfillment_status: 'unstarted',
			attempt_status: 'ready',
			attempt_version: 1,
			payment_intent_id: null,
			stripe_charge_id: null,
			terminal_at: null,
			...overrides
		});
	}

	it.each(['ready', 'expired'])('loads a minimal %s cancellation seed', async (attemptStatus) => {
		const row = readyRow({
			attempt_status: attemptStatus,
			terminal_at: attemptStatus === 'expired' ? NOW : null
		});
		const transaction = transactionWith([row]);
		await expect(
			loadCancellationSeedInTransaction(transaction, {
				orderId: ORDER_ID,
				expectedVersion: 4
			})
		).resolves.toEqual({
			orderId: ORDER_ID,
			attemptId: ATTEMPT_ID,
			expectedVersion: 4,
			attemptVersion: 1,
			sessionId: 'cs_test_staff_order',
			paymentIntentId: null,
			totalCents: 5404,
			customerEmail: 'student@example.com',
			attemptStatus
		});
		const compiled = compile(transaction.execute.mock.calls[0][0]);
		expect(compiled.sql).not.toContain('FOR UPDATE');
		expect(compiled.sql).not.toContain('customer_name');
		expect(compiled.sql).not.toContain('confirmation_token_hash');
	});

	it.each([
		['invalid input', transactionWith(), null, StaffOrderValidationError],
		[
			'invalid version',
			transactionWith(),
			{ orderId: ORDER_ID, expectedVersion: 0 },
			StaffOrderValidationError
		],
		[
			'missing order',
			transactionWith([]),
			{ orderId: ORDER_ID, expectedVersion: 4 },
			StaffOrderNotFoundError
		],
		[
			'duplicate order',
			transactionWith([readyRow(), readyRow()]),
			{ orderId: ORDER_ID, expectedVersion: 4 },
			StaffOrderUnavailableError
		],
		[
			'malformed order',
			transactionWith([readyRow({ order_id: 'bad' })]),
			{ orderId: ORDER_ID, expectedVersion: 4 },
			StaffOrderUnavailableError
		],
		[
			'malformed attempt',
			transactionWith([readyRow({ attempt_version: 0 })]),
			{ orderId: ORDER_ID, expectedVersion: 4 },
			StaffOrderUnavailableError
		]
	])(
		'fails closed while loading a cancellation seed for %s',
		async (_label, tx, input, ErrorType) => {
			await expect(loadCancellationSeedInTransaction(tx, input)).rejects.toBeInstanceOf(ErrorType);
		}
	);

	it.each([
		['paid race', readyRow({ payment_status: 'paid' })],
		['advanced fulfillment', readyRow({ fulfillment_status: 'purchasing' })],
		[
			'created attempt',
			readyRow({
				attempt_status: 'created',
				stripe_session_id: null,
				stripe_expires_at: null,
				checkout_ready_at: null
			})
		],
		['stale version', readyRow({ version: 5 })]
	])('rejects %s before provider work', async (_label, row) => {
		await expect(
			loadCancellationSeedInTransaction(transactionWith([row]), {
				orderId: ORDER_ID,
				expectedVersion: 4
			})
		).rejects.toBeInstanceOf(StaffOrderConflictError);
	});

	it.each(['ready', 'expired'])(
		'cancels provider-expired evidence from %s atomically',
		async (attemptStatus) => {
			const transaction = transactionWith(
				[
					readyRow({
						attempt_status: attemptStatus,
						terminal_at: attemptStatus === 'expired' ? NOW : null
					})
				],
				...(attemptStatus === 'ready' ? [[{ attempt_id: ATTEMPT_ID }]] : []),
				[{ order_id: ORDER_ID }],
				[{ audit_id: '70000000-0000-4000-8000-000000000001' }]
			);
			const evidence = {
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				sessionId: 'cs_test_staff_order',
				paymentIntentId: null,
				totalCents: 5404,
				customerEmail: 'student@example.com',
				providerStatus: 'expired'
			};
			await expect(
				cancelStaffOrderInTransaction(transaction, {
					orderId: ORDER_ID,
					expectedVersion: 4,
					evidence,
					actor: STAFF,
					now: NOW
				})
			).resolves.toEqual({
				id: ORDER_ID,
				paymentStatus: 'cancelled',
				fulfillmentStatus: 'unstarted',
				version: 5,
				piiPurgeAfter: new Date('2026-11-11T16:00:00.000Z')
			});
			const queries = transaction.execute.mock.calls.map(([query]) => compile(query));
			expect(queries[0].sql).toContain('FOR UPDATE');
			if (attemptStatus === 'ready') expect(queries[1].sql).toContain("status = 'expired'");
			const orderUpdate = queries.find(({ sql }) => sql.startsWith('UPDATE orders'));
			expect(orderUpdate.sql).toContain("payment_status = 'cancelled'");
			expect(orderUpdate.sql).toContain("payment_status = 'pending'");
			const audit = queries.at(-1);
			expect(audit.params).toContain('staff_order_cancelled');
		}
	);

	it('accepts an exact incomplete PaymentIntent and uses the server clock by default', async () => {
		const intentId = 'pi_staff_unpaid';
		const transaction = transactionWith(
			[
				readyRow({
					attempt_status: 'expired',
					payment_intent_id: intentId,
					terminal_at: NOW
				})
			],
			[{ order_id: ORDER_ID }],
			[{ audit_id: '70000000-0000-4000-8000-000000000001' }]
		);
		await expect(
			cancelStaffOrderInTransaction(transaction, {
				orderId: ORDER_ID,
				expectedVersion: 4,
				evidence: {
					orderId: ORDER_ID,
					attemptId: ATTEMPT_ID,
					sessionId: 'cs_test_staff_order',
					paymentIntentId: intentId,
					totalCents: 5404,
					customerEmail: 'student@example.com',
					providerStatus: 'expired'
				},
				actor: STAFF
			})
		).resolves.toMatchObject({
			paymentStatus: 'cancelled',
			piiPurgeAfter: expect.any(Date)
		});
	});

	it.each([
		['invalid input', transactionWith(), null, StaffOrderValidationError],
		[
			'invalid evidence',
			transactionWith(),
			{
				orderId: ORDER_ID,
				expectedVersion: 4,
				evidence: {
					orderId: ORDER_ID,
					attemptId: ATTEMPT_ID,
					sessionId: 'cs_test_staff_order',
					paymentIntentId: 42,
					totalCents: 5404,
					customerEmail: 'student@example.com',
					providerStatus: 'expired'
				},
				actor: STAFF,
				now: NOW
			},
			StaffOrderValidationError
		],
		[
			'missing locked order',
			transactionWith([]),
			{
				orderId: ORDER_ID,
				expectedVersion: 4,
				evidence: {
					orderId: ORDER_ID,
					attemptId: ATTEMPT_ID,
					sessionId: 'cs_test_staff_order',
					paymentIntentId: null,
					totalCents: 5404,
					customerEmail: 'student@example.com',
					providerStatus: 'expired'
				},
				actor: STAFF,
				now: NOW
			},
			StaffOrderNotFoundError
		]
	])('rejects %s without an order mutation', async (_label, tx, input, ErrorType) => {
		await expect(cancelStaffOrderInTransaction(tx, input)).rejects.toBeInstanceOf(ErrorType);
	});

	it.each([
		['duplicate locked order', [readyRow(), readyRow()], StaffOrderUnavailableError],
		[
			'non-cancellable attempt',
			[
				readyRow({
					attempt_status: 'created',
					stripe_session_id: null,
					stripe_expires_at: null,
					checkout_ready_at: null
				})
			],
			StaffOrderConflictError
		],
		['malformed locked attempt', [readyRow({ attempt_version: 0 })], StaffOrderUnavailableError]
	])('fails closed for %s after locking', async (_label, lockedRows, ErrorType) => {
		await expect(
			cancelStaffOrderInTransaction(transactionWith(lockedRows), {
				orderId: ORDER_ID,
				expectedVersion: 4,
				evidence: {
					orderId: ORDER_ID,
					attemptId: ATTEMPT_ID,
					sessionId: 'cs_test_staff_order',
					paymentIntentId: null,
					totalCents: 5404,
					customerEmail: 'student@example.com',
					providerStatus: 'expired'
				},
				actor: STAFF,
				now: NOW
			})
		).rejects.toBeInstanceOf(ErrorType);
	});

	it('lets a concurrent paid webhook win without any cancellation update', async () => {
		const transaction = transactionWith([readyRow({ payment_status: 'paid', version: 5 })]);
		await expect(
			cancelStaffOrderInTransaction(transaction, {
				orderId: ORDER_ID,
				expectedVersion: 4,
				evidence: {
					orderId: ORDER_ID,
					attemptId: ATTEMPT_ID,
					sessionId: 'cs_test_staff_order',
					paymentIntentId: null,
					totalCents: 5404,
					customerEmail: 'student@example.com',
					providerStatus: 'expired'
				},
				actor: STAFF,
				now: NOW
			})
		).rejects.toBeInstanceOf(StaffOrderConflictError);
		expect(transaction.execute).toHaveBeenCalledOnce();
	});

	it('rejects mismatched provider evidence without mutation', async () => {
		const transaction = transactionWith([readyRow()]);
		await expect(
			cancelStaffOrderInTransaction(transaction, {
				orderId: ORDER_ID,
				expectedVersion: 4,
				evidence: {
					orderId: ORDER_ID,
					attemptId: ATTEMPT_ID,
					sessionId: 'cs_test_other',
					paymentIntentId: null,
					totalCents: 5404,
					customerEmail: 'student@example.com',
					providerStatus: 'expired'
				},
				actor: STAFF,
				now: NOW
			})
		).rejects.toBeInstanceOf(StaffOrderConflictError);
		expect(transaction.execute).toHaveBeenCalledOnce();
	});

	it.each([
		[
			'attempt compare-and-set',
			transactionWith([readyRow()], [{ attempt_id: ORDER_ID }]),
			StaffOrderUnavailableError
		],
		[
			'order compare-and-set',
			transactionWith([readyRow({ attempt_status: 'expired', terminal_at: NOW })], []),
			StaffOrderUnavailableError
		],
		[
			'audit write',
			transactionWith(
				[readyRow({ attempt_status: 'expired', terminal_at: NOW })],
				[{ order_id: ORDER_ID }],
				[{ audit_id: 'bad' }]
			),
			StaffOrderUnavailableError
		]
	])('fails closed when the %s does not confirm', async (_label, transaction, ErrorType) => {
		await expect(
			cancelStaffOrderInTransaction(transaction, {
				orderId: ORDER_ID,
				expectedVersion: 4,
				evidence: {
					orderId: ORDER_ID,
					attemptId: ATTEMPT_ID,
					sessionId: 'cs_test_staff_order',
					paymentIntentId: null,
					totalCents: 5404,
					customerEmail: 'student@example.com',
					providerStatus: 'expired'
				},
				actor: STAFF,
				now: NOW
			})
		).rejects.toBeInstanceOf(ErrorType);
	});
});

describe('bookstore purchase aggregation query', () => {
	it('returns only bounded grouped purchase facts', async () => {
		const transaction = transactionWith([
			{
				bookstore_name: 'Campus Books',
				title: '=SUM(1,1)',
				isbn: '9780131103627',
				quantity: '3'
			}
		]);
		await expect(listBookstorePurchaseRowsInTransaction(transaction)).resolves.toEqual([
			{ bookstore: 'Campus Books', title: '=SUM(1,1)', isbn: '9780131103627', quantity: 3 }
		]);
		const compiled = compile(transaction.execute.mock.calls[0][0]);
		expect(compiled.sql).toContain("payment_status = 'paid'");
		expect(compiled.sql).toContain("fulfillment_status = 'unstarted'");
		expect(compiled.sql).toContain("kind = 'book'");
		expect(compiled.sql).toContain('GROUP BY');
		expect(compiled.sql).toContain('LIMIT');
		for (const prohibited of [
			'customer_name',
			'customer_email',
			'public_reference',
			'stripe_session_id',
			'confirmation_token_hash'
		]) {
			expect(compiled.sql).not.toContain(prohibited);
		}
	});

	it.each([
		['missing transaction', null],
		['malformed query result', { execute: vi.fn(async () => null) }],
		[
			'too many rows',
			Array.from({ length: 1001 }, () => ({
				bookstore_name: 'A',
				title: 'B',
				isbn: null,
				quantity: 1
			}))
		],
		['zero quantity', [{ bookstore_name: 'A', title: 'B', isbn: null, quantity: 0 }]],
		['malformed quantity', [{ bookstore_name: 'A', title: 'B', isbn: null, quantity: 'many' }]],
		[
			'oversized aggregate',
			[
				{ bookstore_name: 'A', title: 'B', isbn: null, quantity: 6000 },
				{ bookstore_name: 'A', title: 'C', isbn: null, quantity: 4000 }
			]
		],
		['malformed text', [{ bookstore_name: '', title: 'B', isbn: null, quantity: 1 }]]
	])('fails closed for %s', async (_label, rows) => {
		const transaction = rows?.execute ? rows : rows === null ? null : transactionWith(rows);
		await expect(listBookstorePurchaseRowsInTransaction(transaction)).rejects.toBeInstanceOf(
			StaffOrderUnavailableError
		);
	});
});

describe('staff order repository configuration boundary', () => {
	it.each([
		['missing database URL', { databaseUrl: '', approvedHostnames: ['shop.example.com'] }],
		[
			'whitespace database URL',
			{ databaseUrl: ' postgresql://db.example.com/club', approvedHostnames: ['shop.example.com'] }
		],
		[
			'empty retailer allowlist',
			{ databaseUrl: 'postgresql://db.example.com/club', approvedHostnames: [] }
		],
		[
			'duplicate retailer allowlist',
			{
				databaseUrl: 'postgresql://db.example.com/club',
				approvedHostnames: ['shop.example.com', 'shop.example.com']
			}
		],
		[
			'malformed retailer hostname',
			{ databaseUrl: 'postgresql://db.example.com/club', approvedHostnames: ['bad host'] }
		],
		[
			'invalid transaction runner',
			{
				databaseUrl: 'postgresql://db.example.com/club',
				approvedHostnames: ['shop.example.com'],
				runTransaction: null
			}
		]
	])('fails closed for %s', (_label, configuration) => {
		expect(() => createStaffOrderRepository(configuration)).toThrow(StaffOrderUnavailableError);
	});

	it('sanitizes unexpected failures from every operation wrapper', async () => {
		const defect = new Error('database secret');
		const repository = createStaffOrderRepository({
			databaseUrl: 'postgresql://staff:secret@db.example.com/club',
			approvedHostnames: ['shop.example.com'],
			runTransaction: vi.fn(async () => {
				throw defect;
			}),
			getNow: () => NOW
		});
		await expect(
			repository.advanceFulfillment({
				orderId: ORDER_ID,
				expectedVersion: 4,
				actor: STAFF,
				now: NOW
			})
		).rejects.toBeInstanceOf(StaffOrderUnavailableError);
		await expect(
			repository.loadCancellationSeed({ orderId: ORDER_ID, expectedVersion: 4 })
		).rejects.toBeInstanceOf(StaffOrderUnavailableError);
		await expect(
			repository.cancelOrder({
				orderId: ORDER_ID,
				expectedVersion: 4,
				evidence: {},
				actor: STAFF,
				now: NOW
			})
		).rejects.toBeInstanceOf(StaffOrderUnavailableError);
		await expect(repository.listBookstorePurchaseRows()).rejects.toBeInstanceOf(
			StaffOrderUnavailableError
		);
	});
});
