// @vitest-environment node

import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import {
	OrderConfirmationPersistenceError,
	confirmationCookieName,
	loadOrderConfirmationInTransaction
} from './confirmation.js';
import { hashConfirmationCapability } from './request.js';

const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ATTEMPT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const COURSE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BOOK_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const STORE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const REFERENCE = 'MPC-ABCDEFGHJK23';
const CAPABILITY = Buffer.alloc(32, 7).toString('base64url');
const REQUEST_ID = `ckr1_${Buffer.alloc(32, 1).toString('base64url')}`;
const NOW = new Date('2026-08-13T18:00:00.000Z');

function orderRow(overrides = {}) {
	return {
		order_id: ORDER_ID,
		public_reference: REFERENCE,
		confirmation_token_hash: hashConfirmationCapability(CAPABILITY),
		confirmation_expires_at: new Date('2026-08-14T18:00:00.000Z'),
		customer_email: 'ada.lovelace@example.com',
		currency: 'cad',
		payment_status: 'paid',
		fulfillment_status: 'unstarted',
		subtotal_cents: 4000,
		service_fee_cents: 500,
		tax_cents: 674,
		total_cents: 5174,
		refunded_amount_cents: 0,
		attempt_id: ATTEMPT_ID,
		attempt_order_id: ORDER_ID,
		client_request_id: REQUEST_ID,
		attempt_status: 'completed',
		...overrides
	};
}

const bookLine = Object.freeze({
	kind: 'book',
	label: 'Algorithms',
	isbn: '9780000000000',
	bookstore_id: STORE_ID,
	bookstore_name: 'Campus Books',
	book_id: BOOK_ID,
	course_id: COURSE_ID,
	course_code: 'CSC 205',
	course_title: 'Data Structures',
	quantity: 2,
	unit_amount_cents: 2000,
	line_amount_cents: 4000
});
const feeLine = Object.freeze({
	kind: 'service_fee',
	label: 'Campus Books pickup service',
	isbn: null,
	bookstore_id: STORE_ID,
	bookstore_name: 'Campus Books',
	book_id: null,
	course_id: null,
	course_code: null,
	course_title: null,
	quantity: 1,
	unit_amount_cents: 500,
	line_amount_cents: 500
});

/** @param {...any[]} resultRows */
function transactionWithRows(...resultRows) {
	return { execute: vi.fn(async () => ({ rows: resultRows.shift() ?? [] })) };
}

/** @param {any} transaction */
function compiledCalls(transaction) {
	const dialect = new PgDialect();
	return transaction.execute.mock.calls.map((/** @type {any[]} */ call) =>
		dialect.sqlToQuery(call[0])
	);
}

describe('guest order confirmation repository', () => {
	it('loads one paid immutable receipt through a matching unexpired capability', async () => {
		const transaction = transactionWithRows([orderRow()], [feeLine, bookLine]);

		const confirmation = await loadOrderConfirmationInTransaction(transaction, {
			publicReference: REFERENCE,
			capability: CAPABILITY,
			now: NOW
		});

		expect(confirmation).toEqual({
			state: 'paid',
			orderReference: REFERENCE,
			receiptEmail: 'a***@example.com',
			currency: 'cad',
			fulfillmentStatus: 'unstarted',
			bookSubtotalCents: 4000,
			serviceFeeCents: 500,
			taxCents: 674,
			totalCents: 5174,
			refundedAmountCents: 0,
			books: [
				{
					courseId: COURSE_ID,
					bookId: BOOK_ID,
					title: 'Algorithms',
					isbn: '9780000000000',
					bookstoreName: 'Campus Books',
					courseCode: 'CSC 205',
					courseTitle: 'Data Structures',
					quantity: 2,
					unitAmountCents: 2000,
					lineAmountCents: 4000
				}
			],
			fees: [
				{
					bookstoreId: STORE_ID,
					label: 'Campus Books pickup service',
					amountCents: 500
				}
			],
			browserCleanup: {
				requestId: REQUEST_ID,
				cartSelections: [{ courseId: COURSE_ID, bookId: BOOK_ID, quantity: 2 }]
			}
		});
		const calls = compiledCalls(transaction);
		expect(calls).toHaveLength(2);
		expect(
			calls.every((/** @type {{ sql: string }} */ { sql }) => /^SELECT\b/iu.test(sql.trim()))
		).toBe(true);
		expect(calls.map((/** @type {{ sql: string }} */ { sql }) => sql).join(' ')).not.toMatch(
			/FOR UPDATE|INSERT|UPDATE|DELETE/iu
		);
		expect(JSON.stringify(calls)).not.toContain(CAPABILITY);
	});

	it.each([
		['missing order', [], CAPABILITY],
		['forged capability', [orderRow()], Buffer.alloc(32, 8).toString('base64url')],
		[
			'capability from another order',
			[
				orderRow({
					confirmation_token_hash: hashConfirmationCapability(
						Buffer.alloc(32, 9).toString('base64url')
					)
				})
			],
			CAPABILITY
		],
		['expired capability', [orderRow({ confirmation_expires_at: NOW })], CAPABILITY]
	])('returns no order data for a %s', async (_label, firstRows, capability) => {
		const transaction = transactionWithRows(firstRows, [bookLine, feeLine]);

		await expect(
			loadOrderConfirmationInTransaction(transaction, {
				publicReference: REFERENCE,
				capability,
				now: NOW
			})
		).resolves.toBeNull();
		expect(transaction.execute).toHaveBeenCalledOnce();
	});

	it.each([
		['pending', 'ready', 'processing', null],
		['partially_refunded', 'completed', 'partially_refunded', true],
		['refunded', 'completed', 'refunded', false],
		['expired', 'expired', 'expired', false],
		['failed', 'failed', 'failed', false],
		['cancelled', 'expired', 'cancelled', false]
	])(
		'projects %s only from persisted order and attempt state',
		async (paymentStatus, attemptStatus, state, clearsCart) => {
			const refundedAmountCents =
				paymentStatus === 'partially_refunded' ? 1000 : paymentStatus === 'refunded' ? 5174 : 0;
			const transaction = transactionWithRows(
				[
					orderRow({
						payment_status: paymentStatus,
						attempt_status: attemptStatus,
						refunded_amount_cents: refundedAmountCents
					})
				],
				[bookLine, feeLine]
			);

			const confirmation = await loadOrderConfirmationInTransaction(transaction, {
				publicReference: REFERENCE,
				capability: CAPABILITY,
				now: NOW
			});

			expect(confirmation).toMatchObject({ state, refundedAmountCents });
			expect(confirmation).not.toBeNull();
			if (confirmation === null) throw new Error('Expected an authorized confirmation');
			if (state === 'processing') {
				expect(confirmation.browserCleanup).toBeNull();
			} else {
				expect(confirmation.browserCleanup).not.toBeNull();
				if (confirmation.browserCleanup === null) throw new Error('Expected terminal cleanup');
				expect(confirmation.browserCleanup.requestId).toBe(REQUEST_ID);
				expect(confirmation.browserCleanup.cartSelections.length > 0).toBe(clearsCart);
			}
		}
	);

	it.each([
		['a non-object order row', null],
		[
			'a mismatched order and attempt',
			{ attempt_order_id: '99999999-9999-4999-8999-999999999999' }
		],
		['an impossible paid attempt state', { attempt_status: 'ready' }],
		['a wrong currency', { currency: 'usd' }],
		['an inconsistent total', { total_cents: 5173 }],
		['a negative persisted amount', { subtotal_cents: -1 }],
		['a non-date expiry', { confirmation_expires_at: null }],
		['an invalid date expiry', { confirmation_expires_at: 'not-a-date' }],
		[
			'an inconsistent partial refund',
			{ payment_status: 'partially_refunded', refunded_amount_cents: 0 }
		],
		['an unmasked invalid email source', { customer_email: 'not an email' }]
	])('fails closed for persisted order corruption: %s', async (_label, overrides) => {
		const transaction = transactionWithRows(
			[overrides === null ? null : orderRow(overrides)],
			[bookLine, feeLine]
		);

		await expect(
			loadOrderConfirmationInTransaction(transaction, {
				publicReference: REFERENCE,
				capability: CAPABILITY,
				now: NOW
			})
		).rejects.toBeInstanceOf(OrderConfirmationPersistenceError);
	});

	it.each([
		['no immutable lines', []],
		['a non-object immutable line', [null, feeLine]],
		['an invalid line kind', [{ ...bookLine, kind: 'invented' }, feeLine]],
		['an empty snapshot label', [{ ...bookLine, label: '' }, feeLine]],
		['a mismatched book total', [{ ...bookLine, line_amount_cents: 3999 }, feeLine]],
		[
			'a mismatched fee total',
			[bookLine, { ...feeLine, unit_amount_cents: 600, line_amount_cents: 600 }]
		],
		['a service fee with book identity', [bookLine, { ...feeLine, book_id: BOOK_ID }]],
		['a book without course identity', [{ ...bookLine, course_id: null }, feeLine]]
	])('fails closed for %s', async (_label, lineRows) => {
		const transaction = transactionWithRows([orderRow()], lineRows);

		await expect(
			loadOrderConfirmationInTransaction(transaction, {
				publicReference: REFERENCE,
				capability: CAPABILITY,
				now: NOW
			})
		).rejects.toBeInstanceOf(OrderConfirmationPersistenceError);
	});

	it.each([
		['a malformed reference', 'MPC-invalid', CAPABILITY],
		['a malformed capability', REFERENCE, 'not-a-capability'],
		['an invalid clock', REFERENCE, CAPABILITY, new Date('invalid')]
	])(
		'fails closed before database access for %s',
		async (_label, publicReference, capability, now = NOW) => {
			const transaction = transactionWithRows([orderRow()], [bookLine, feeLine]);

			await expect(
				loadOrderConfirmationInTransaction(transaction, { publicReference, capability, now })
			).resolves.toBeNull();
			expect(transaction.execute).not.toHaveBeenCalled();
		}
	);

	it('treats malformed database results as unavailable rather than unauthorized', async () => {
		await expect(
			loadOrderConfirmationInTransaction(
				{ execute: vi.fn(async () => null) },
				{ publicReference: REFERENCE, capability: CAPABILITY, now: NOW }
			)
		).rejects.toBeInstanceOf(OrderConfirmationPersistenceError);
	});

	it.each([null, {}])('rejects a malformed transaction dependency %j', async (value) => {
		await expect(
			loadOrderConfirmationInTransaction(value, {
				publicReference: REFERENCE,
				capability: CAPABILITY,
				now: NOW
			})
		).rejects.toBeInstanceOf(OrderConfirmationPersistenceError);
	});

	it('rejects duplicate rows for one supposedly unique public reference', async () => {
		const transaction = transactionWithRows([orderRow(), orderRow()], [bookLine, feeLine]);

		await expect(
			loadOrderConfirmationInTransaction(transaction, {
				publicReference: REFERENCE,
				capability: CAPABILITY,
				now: NOW
			})
		).rejects.toBeInstanceOf(OrderConfirmationPersistenceError);
	});
});

describe('confirmation cookie routing', () => {
	it('uses one public-reference-scoped Secure cookie name so concurrent orders do not overwrite', () => {
		expect(confirmationCookieName(REFERENCE)).toBe(
			'__Secure-mpc_book_confirmation_MPC-ABCDEFGHJK23'
		);
	});

	it.each(['MPC-invalid', '', null])('rejects an unsafe cookie reference %j', (reference) => {
		expect(() => confirmationCookieName(reference)).toThrow(OrderConfirmationPersistenceError);
	});
});
