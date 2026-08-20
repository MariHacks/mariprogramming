// @vitest-environment node

import { createHash } from 'node:crypto';
import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import {
	CheckoutConflictError,
	CheckoutPersistenceError,
	failCheckoutAttemptInTransaction,
	persistCheckoutSessionInTransaction,
	reserveCheckoutAttemptInTransaction
} from './persistence.js';
import { createConfirmationCapability, hashConfirmationCapability } from './request.js';

const ORDER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ATTEMPT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const COURSE_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const BOOK_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const STORE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const TEACHER_ID = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const REQUEST_ID = `ckr1_${Buffer.alloc(32, 1).toString('base64url')}`;
const FINGERPRINT = createHash('sha256').update('intent').digest('hex');
const CAPABILITY_KEY = 'checkout-capability-secret-kept-separate-1234567890';
const NOW = new Date('2026-08-13T18:00:00.000Z');

const canonicalRequest = Object.freeze({
	version: 1,
	clientRequestId: REQUEST_ID,
	customerName: 'Ada Lovelace',
	customerEmail: 'ada@example.com',
	courses: Object.freeze([
		Object.freeze({
			teacherSlug: 'prof-a',
			courseId: COURSE_ID,
			selections: Object.freeze([Object.freeze({ bookId: BOOK_ID, quantity: 2 })])
		})
	])
});

const bookLine = Object.freeze({
	kind: 'book',
	label: 'Algorithms',
	isbn: '9780000000000',
	bookId: BOOK_ID,
	teacherId: TEACHER_ID,
	teacherName: 'Prof A',
	courseId: COURSE_ID,
	courseCode: 'CSC 205',
	courseTitle: 'Data Structures',
	bookstoreId: STORE_ID,
	bookstoreName: 'Campus Books',
	quantity: 2,
	unitAmountCents: 2000,
	lineAmountCents: 4000
});
const feeLine = Object.freeze({
	kind: 'service_fee',
	label: 'Campus Books pickup service',
	isbn: null,
	bookId: null,
	teacherId: null,
	teacherName: null,
	courseId: null,
	courseCode: null,
	courseTitle: null,
	bookstoreId: STORE_ID,
	bookstoreName: 'Campus Books',
	quantity: 1,
	unitAmountCents: 500,
	lineAmountCents: 500
});
const quote = Object.freeze({
	currency: 'cad',
	subtotalCents: 4000,
	serviceFeeCents: 500,
	taxCents: 674,
	totalCents: 5174,
	taxRateBps: 1498,
	lines: Object.freeze([bookLine, feeLine])
});

function identifiers() {
	const confirmationCapability = createConfirmationCapability({
		capabilityKey: CAPABILITY_KEY,
		orderId: ORDER_ID,
		attemptId: ATTEMPT_ID
	});
	return Object.freeze({
		orderId: ORDER_ID,
		attemptId: ATTEMPT_ID,
		publicReference: 'MPC-ABCDEFGHJK23',
		stripeIdempotencyKey: `mpc-book-checkout-v1:${ATTEMPT_ID}`,
		confirmationCapability,
		confirmationTokenHash: hashConfirmationCapability(confirmationCapability),
		confirmationExpiresAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1000)
	});
}

/** @param {...any[]} rows */
function transactionWithRows(...rows) {
	return {
		execute: vi.fn(async () => ({ rows: rows.shift() ?? [] }))
	};
}

/** @param {any} transaction */
function compileCalls(transaction) {
	const dialect = new PgDialect();
	return transaction.execute.mock.calls.map((/** @type {any} */ call) =>
		dialect.sqlToQuery(call[0])
	);
}

function persistedAttemptRow(overrides = {}) {
	const generated = identifiers();
	return {
		attempt_id: ATTEMPT_ID,
		attempt_order_id: ORDER_ID,
		client_request_id: REQUEST_ID,
		request_fingerprint: FINGERPRINT,
		stripe_idempotency_key: generated.stripeIdempotencyKey,
		stripe_session_id: null,
		payment_intent_id: null,
		stripe_expires_at: null,
		checkout_ready_at: null,
		terminal_at: null,
		attempt_status: 'created',
		attempt_version: 1,
		attempt_created_at: NOW,
		order_id: ORDER_ID,
		customer_name: canonicalRequest.customerName,
		customer_email: canonicalRequest.customerEmail,
		public_reference: generated.publicReference,
		confirmation_token_hash: generated.confirmationTokenHash,
		confirmation_expires_at: generated.confirmationExpiresAt,
		currency: quote.currency,
		payment_status: 'pending',
		fulfillment_status: 'unstarted',
		order_version: 1,
		subtotal_cents: quote.subtotalCents,
		service_fee_cents: quote.serviceFeeCents,
		tax_cents: quote.taxCents,
		total_cents: quote.totalCents,
		order_created_at: NOW,
		...overrides
	};
}

/** @param {any} line */
function persistedLine(line) {
	return {
		kind: line.kind,
		label: line.label,
		isbn: line.isbn,
		bookstore_id: line.bookstoreId,
		bookstore_name: line.bookstoreName,
		book_id: line.bookId,
		teacher_id: line.teacherId,
		teacher_name: line.teacherName,
		course_id: line.courseId,
		course_code: line.courseCode,
		course_title: line.courseTitle,
		quantity: line.quantity,
		unit_amount_cents: line.unitAmountCents,
		line_amount_cents: line.lineAmountCents
	};
}

describe('checkout reservation transaction', () => {
	it('locks identity, quotes, and persists the order, immutable lines, attempt, and audit before returning', async () => {
		const transaction = transactionWithRows([], [], [], [], [], [], [], [], []);
		const repository = {
			quoteSelectedBooksInTransaction: vi.fn()
		};
		const quoteCheckout = vi.fn(async (receivedTransaction, request, receivedRepository) => {
			expect(transaction.execute).toHaveBeenCalledTimes(4);
			expect(receivedTransaction).toBe(transaction);
			expect(request).toBe(canonicalRequest);
			expect(receivedRepository).toBe(repository);
			return quote;
		});
		const identifierFactory = vi.fn(() => identifiers());

		const reserved = await reserveCheckoutAttemptInTransaction(transaction, {
			canonicalRequest,
			requestFingerprint: FINGERPRINT,
			capabilityKey: CAPABILITY_KEY,
			now: NOW,
			repository,
			quoteCheckout,
			identifierFactory
		});

		expect(reserved.outcome).toBe('created');
		expect(reserved.order).toMatchObject({
			id: ORDER_ID,
			customerEmail: 'ada@example.com',
			totalCents: 5174
		});
		expect(reserved.attempt).toMatchObject({
			id: ATTEMPT_ID,
			clientRequestId: REQUEST_ID,
			requestFingerprint: FINGERPRINT,
			status: 'created'
		});
		expect(reserved.lines).toEqual([bookLine, feeLine]);
		expect(reserved.confirmationCapability).toBe(identifiers().confirmationCapability);
		expect(quoteCheckout).toHaveBeenCalledOnce();
		expect(identifierFactory).toHaveBeenCalledWith({
			capabilityKey: CAPABILITY_KEY,
			now: NOW
		});

		const calls = compileCalls(transaction);
		expect(calls).toHaveLength(9);
		expect(calls[0].sql).toContain('pg_advisory_xact_lock');
		expect(calls[1].sql).toContain('pg_advisory_xact_lock');
		expect(calls[2].sql).toContain('FROM checkout_attempts');
		expect(calls[3].sql).toContain('request_fingerprint');
		expect(calls[4].sql).toContain('INSERT INTO orders');
		expect(calls[5].sql).toContain('INSERT INTO order_lines');
		expect(calls[6].sql).toContain('INSERT INTO order_lines');
		expect(calls[7].sql).toContain('INSERT INTO checkout_attempts');
		expect(calls[8].sql).toContain('INSERT INTO audit_log');
		const persistedParameters = JSON.stringify(
			calls.flatMap((/** @type {any} */ { params }) => params)
		);
		expect(persistedParameters).not.toContain(reserved.confirmationCapability);
		expect(persistedParameters).toContain(identifiers().confirmationTokenHash);
	});

	it('recovers the same immutable attempt and deterministic capability without repricing', async () => {
		const transaction = transactionWithRows(
			[],
			[],
			[persistedAttemptRow()],
			[persistedLine(feeLine), persistedLine(bookLine)]
		);
		const quoteCheckout = vi.fn();
		const identifierFactory = vi.fn();

		const recovered = await reserveCheckoutAttemptInTransaction(transaction, {
			canonicalRequest,
			requestFingerprint: FINGERPRINT,
			capabilityKey: CAPABILITY_KEY,
			now: NOW,
			repository: {},
			quoteCheckout,
			identifierFactory
		});

		expect(recovered.outcome).toBe('recovered');
		expect(recovered.order.id).toBe(ORDER_ID);
		expect(recovered.attempt.id).toBe(ATTEMPT_ID);
		expect(recovered.lines).toEqual([bookLine, feeLine]);
		expect(recovered.confirmationCapability).toBe(identifiers().confirmationCapability);
		expect(quoteCheckout).not.toHaveBeenCalled();
		expect(identifierFactory).not.toHaveBeenCalled();
		expect(transaction.execute).toHaveBeenCalledTimes(4);
	});

	it('rejects a reused request ID with a different intent before quote or insert', async () => {
		const transaction = transactionWithRows([], [], [persistedAttemptRow()]);
		const quoteCheckout = vi.fn();
		await expect(
			reserveCheckoutAttemptInTransaction(transaction, {
				canonicalRequest,
				requestFingerprint: '0'.repeat(64),
				capabilityKey: CAPABILITY_KEY,
				now: NOW,
				repository: {},
				quoteCheckout
			})
		).rejects.toBeInstanceOf(CheckoutConflictError);
		expect(quoteCheckout).not.toHaveBeenCalled();
		expect(transaction.execute).toHaveBeenCalledTimes(3);
	});

	it('rejects a new request ID while the same intent is nonterminal', async () => {
		const transaction = transactionWithRows([], [], [], [{ attempt_id: ATTEMPT_ID }]);
		const quoteCheckout = vi.fn();
		await expect(
			reserveCheckoutAttemptInTransaction(transaction, {
				canonicalRequest,
				requestFingerprint: FINGERPRINT,
				capabilityKey: CAPABILITY_KEY,
				now: NOW,
				repository: {},
				quoteCheckout
			})
		).rejects.toBeInstanceOf(CheckoutConflictError);
		expect(quoteCheckout).not.toHaveBeenCalled();
		expect(transaction.execute).toHaveBeenCalledTimes(4);
	});

	it.each([
		['a forged capability hash', { confirmation_token_hash: '0'.repeat(64) }],
		['a terminal attempt', { attempt_status: 'expired', terminal_at: NOW }],
		['a created attempt with provider state', { stripe_session_id: 'cs_test_forged' }],
		['corrupted totals', { total_cents: 1 }]
	])('fails closed when persisted recovery contains %s', async (_label, override) => {
		const transaction = transactionWithRows(
			[],
			[],
			[persistedAttemptRow(override)],
			[persistedLine(bookLine), persistedLine(feeLine)]
		);
		await expect(
			reserveCheckoutAttemptInTransaction(transaction, {
				canonicalRequest,
				requestFingerprint: FINGERPRINT,
				capabilityKey: CAPABILITY_KEY,
				now: NOW,
				repository: {},
				quoteCheckout: vi.fn()
			})
		).rejects.toBeInstanceOf(
			_label === 'a terminal attempt' ? CheckoutConflictError : CheckoutPersistenceError
		);
	});
});

describe('checkout Session persistence transaction', () => {
	const providerSession = Object.freeze({
		id: 'cs_test_persisted_checkout',
		paymentIntentId: null,
		expiresAt: new Date('2026-08-14T18:00:00.000Z')
	});

	it('atomically transitions created to ready and writes one audit record', async () => {
		const transaction = transactionWithRows(
			[persistedAttemptRow()],
			[{ attempt_id: ATTEMPT_ID }],
			[]
		);
		const result = await persistCheckoutSessionInTransaction(transaction, {
			orderId: ORDER_ID,
			attemptId: ATTEMPT_ID,
			requestFingerprint: FINGERPRINT,
			providerSession,
			now: NOW
		});

		expect(result).toEqual({ outcome: 'ready', readyAt: NOW });
		const calls = compileCalls(transaction);
		expect(calls).toHaveLength(3);
		expect(calls[0].sql).toContain('FOR UPDATE OF ca, o');
		expect(calls[1].sql).toContain('UPDATE checkout_attempts');
		expect(calls[2].sql).toContain('INSERT INTO audit_log');
	});

	it('treats an exact ready replay as a no-op', async () => {
		const readyAt = new Date('2026-08-13T18:01:00.000Z');
		const transaction = transactionWithRows([
			persistedAttemptRow({
				attempt_status: 'ready',
				stripe_session_id: providerSession.id,
				stripe_expires_at: providerSession.expiresAt,
				checkout_ready_at: readyAt
			})
		]);

		await expect(
			persistCheckoutSessionInTransaction(transaction, {
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				requestFingerprint: FINGERPRINT,
				providerSession,
				now: NOW
			})
		).resolves.toEqual({ outcome: 'already_ready', readyAt });
		expect(transaction.execute).toHaveBeenCalledOnce();
	});

	it('atomically records a PaymentIntent first observed while revalidating the ready Session', async () => {
		const readyAt = new Date('2026-08-13T18:01:00.000Z');
		const recoveredSession = Object.freeze({
			...providerSession,
			paymentIntentId: 'pi_test_attached_later'
		});
		const transaction = transactionWithRows(
			[
				persistedAttemptRow({
					attempt_status: 'ready',
					stripe_session_id: providerSession.id,
					stripe_expires_at: providerSession.expiresAt,
					checkout_ready_at: readyAt
				})
			],
			[{ attempt_id: ATTEMPT_ID }],
			[]
		);

		await expect(
			persistCheckoutSessionInTransaction(transaction, {
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				requestFingerprint: FINGERPRINT,
				providerSession: recoveredSession,
				now: NOW
			})
		).resolves.toEqual({ outcome: 'payment_intent_attached', readyAt });
		const calls = compileCalls(transaction);
		expect(calls).toHaveLength(3);
		expect(calls[1].sql).toContain('SET payment_intent_id = $1');
		expect(calls[1].params).toContain(recoveredSession.paymentIntentId);
		expect(calls[2].sql).toContain('INSERT INTO audit_log');
	});

	it.each([
		['a different Session', { stripe_session_id: 'cs_test_other' }],
		['a different expiry', { stripe_expires_at: new Date('2026-08-14T17:00:00.000Z') }],
		['a terminal attempt', { attempt_status: 'completed', terminal_at: NOW }],
		['a wrong request fingerprint', { request_fingerprint: '0'.repeat(64) }]
	])('rejects %s without updating readiness', async (_label, override) => {
		const transaction = transactionWithRows([
			persistedAttemptRow({
				attempt_status: 'ready',
				stripe_session_id: providerSession.id,
				stripe_expires_at: providerSession.expiresAt,
				checkout_ready_at: NOW,
				...override
			})
		]);
		await expect(
			persistCheckoutSessionInTransaction(transaction, {
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				requestFingerprint: FINGERPRINT,
				providerSession,
				now: NOW
			})
		).rejects.toBeInstanceOf(
			_label === 'a terminal attempt' ? CheckoutConflictError : CheckoutPersistenceError
		);
		expect(transaction.execute).toHaveBeenCalledOnce();
	});

	it('fails closed when the readiness compare-and-set updates no row', async () => {
		const transaction = transactionWithRows([persistedAttemptRow()], [], []);
		await expect(
			persistCheckoutSessionInTransaction(transaction, {
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				requestFingerprint: FINGERPRINT,
				providerSession,
				now: NOW
			})
		).rejects.toBeInstanceOf(CheckoutPersistenceError);
		expect(transaction.execute).toHaveBeenCalledTimes(2);
	});
});

describe('definitive checkout creation failure transaction', () => {
	it.each([
		['a non-string order ID', null, ATTEMPT_ID],
		['a malformed order ID', 'not-a-uuid', ATTEMPT_ID],
		['a non-string attempt ID', ORDER_ID, null],
		['a malformed attempt ID', ORDER_ID, 'not-a-uuid']
	])('rejects %s before accessing the database', async (_label, orderId, attemptId) => {
		const transaction = transactionWithRows();

		await expect(
			failCheckoutAttemptInTransaction(transaction, {
				orderId,
				attemptId,
				requestFingerprint: FINGERPRINT,
				now: NOW
			})
		).rejects.toBeInstanceOf(CheckoutPersistenceError);
		expect(transaction.execute).not.toHaveBeenCalled();
	});

	it('atomically marks a created attempt and pending order failed with retention and audit state', async () => {
		const transaction = transactionWithRows(
			[persistedAttemptRow()],
			[{ attempt_id: ATTEMPT_ID }],
			[{ order_id: ORDER_ID }],
			[]
		);

		await expect(
			failCheckoutAttemptInTransaction(transaction, {
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				requestFingerprint: FINGERPRINT,
				now: NOW
			})
		).resolves.toEqual({
			outcome: 'failed',
			terminalAt: NOW,
			piiPurgeAfter: new Date('2026-11-11T18:00:00.000Z')
		});

		const calls = compileCalls(transaction);
		expect(calls).toHaveLength(4);
		expect(calls[0].sql).toContain('FOR UPDATE OF ca, o');
		expect(calls[1].sql).toContain("status = 'failed'");
		expect(calls[1].sql).toContain('terminal_at');
		expect(calls[2].sql).toContain("payment_status = 'failed'");
		expect(calls[2].sql).toContain('pii_purge_after');
		expect(calls[3].sql).toContain('checkout_creation_failed');
		expect(JSON.stringify(calls[3].params)).not.toContain('ada@example.com');
	});

	it.each([
		['no matching attempt', [], CheckoutPersistenceError],
		[
			'a terminal attempt',
			[persistedAttemptRow({ attempt_status: 'failed', terminal_at: NOW })],
			CheckoutConflictError
		],
		[
			'provider state on the created attempt',
			[persistedAttemptRow({ stripe_session_id: 'cs_test_unknown' })],
			CheckoutPersistenceError
		],
		[
			'a mismatched request fingerprint',
			[persistedAttemptRow({ request_fingerprint: '0'.repeat(64) })],
			CheckoutPersistenceError
		],
		[
			'a non-pending order',
			[persistedAttemptRow({ payment_status: 'paid' })],
			CheckoutPersistenceError
		]
	])('rejects %s without a state transition', async (_label, existingRows, ErrorClass) => {
		const transaction = transactionWithRows(existingRows);
		await expect(
			failCheckoutAttemptInTransaction(transaction, {
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				requestFingerprint: FINGERPRINT,
				now: NOW
			})
		).rejects.toBeInstanceOf(ErrorClass);
		expect(transaction.execute).toHaveBeenCalledOnce();
	});

	it.each([
		['attempt compare-and-set loss', [], [{ order_id: ORDER_ID }]],
		['order compare-and-set loss', [{ attempt_id: ATTEMPT_ID }], []]
	])('fails closed on %s', async (_label, attemptRows, orderRows) => {
		const transaction = transactionWithRows([persistedAttemptRow()], attemptRows, orderRows);
		await expect(
			failCheckoutAttemptInTransaction(transaction, {
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				requestFingerprint: FINGERPRINT,
				now: NOW
			})
		).rejects.toBeInstanceOf(CheckoutPersistenceError);
	});
});

describe('checkout persistence validation', () => {
	it.each([
		['a missing transaction', null],
		['an invalid fingerprint', 'not-a-hash'],
		['an invalid clock', new Date('invalid')]
	])('rejects %s', async (_label, invalid) => {
		await expect(
			reserveCheckoutAttemptInTransaction(
				_label === 'a missing transaction' ? invalid : transactionWithRows(),
				{
					canonicalRequest,
					requestFingerprint: _label === 'an invalid fingerprint' ? invalid : FINGERPRINT,
					capabilityKey: CAPABILITY_KEY,
					now: /** @type {any} */ (_label === 'an invalid clock' ? invalid : NOW),
					repository: {},
					quoteCheckout: vi.fn()
				}
			)
		).rejects.toBeInstanceOf(CheckoutPersistenceError);
	});

	it('fails closed on a malformed database result envelope', async () => {
		const transaction = { execute: vi.fn().mockResolvedValue(null) };
		await expect(
			reserveCheckoutAttemptInTransaction(transaction, {
				canonicalRequest,
				requestFingerprint: FINGERPRINT,
				capabilityKey: CAPABILITY_KEY,
				now: NOW,
				repository: {},
				quoteCheckout: vi.fn()
			})
		).rejects.toBeInstanceOf(CheckoutPersistenceError);
	});

	it.each([
		['a malformed canonical request', { canonicalRequest: null }],
		['a malformed quote function', { quoteCheckout: null }],
		['a malformed identifier factory', { identifierFactory: null }]
	])('rejects %s before persistence', async (_label, override) => {
		await expect(
			reserveCheckoutAttemptInTransaction(
				transactionWithRows(),
				/** @type {any} */ ({
					canonicalRequest,
					requestFingerprint: FINGERPRINT,
					capabilityKey: CAPABILITY_KEY,
					now: NOW,
					repository: {},
					quoteCheckout: vi.fn(),
					identifierFactory: vi.fn(),
					...override
				})
			)
		).rejects.toBeInstanceOf(CheckoutPersistenceError);
	});

	it.each([
		['a malformed line collection', { ...quote, lines: null }],
		['an empty line collection', { ...quote, lines: [] }],
		['a malformed line', { ...quote, lines: [null] }],
		['an invalid line kind', { ...quote, lines: [{ ...bookLine, kind: 'other' }] }],
		['a mismatched line amount', { ...quote, lines: [{ ...bookLine, lineAmountCents: 1 }] }],
		['an incomplete book snapshot', { ...quote, lines: [{ ...bookLine, teacherId: null }] }],
		[
			'an invalid service fee',
			{ ...quote, lines: [{ ...feeLine, quantity: 2, lineAmountCents: 1000 }] }
		],
		['a negative amount', { ...quote, subtotalCents: -1 }],
		['a non-CAD quote', { ...quote, currency: 'usd' }],
		['an inconsistent quote total', { ...quote, totalCents: quote.totalCents + 1 }]
	])('fails closed on %s', async (_label, invalidQuote) => {
		const transaction = transactionWithRows([], [], [], []);
		await expect(
			reserveCheckoutAttemptInTransaction(transaction, {
				canonicalRequest,
				requestFingerprint: FINGERPRINT,
				capabilityKey: CAPABILITY_KEY,
				now: NOW,
				repository: {},
				quoteCheckout: vi.fn().mockResolvedValue(invalidQuote),
				identifierFactory: vi.fn(() => identifiers())
			})
		).rejects.toBeInstanceOf(CheckoutPersistenceError);
	});

	it('fails closed when identifier generation throws or returns malformed identifiers', async () => {
		for (const identifierFactory of [
			vi.fn(() => {
				throw new Error('entropy unavailable');
			}),
			vi.fn(() => ({ ...identifiers(), publicReference: 'invalid' }))
		]) {
			await expect(
				reserveCheckoutAttemptInTransaction(transactionWithRows([], [], [], []), {
					canonicalRequest,
					requestFingerprint: FINGERPRINT,
					capabilityKey: CAPABILITY_KEY,
					now: NOW,
					repository: {},
					quoteCheckout: vi.fn().mockResolvedValue(quote),
					identifierFactory
				})
			).rejects.toBeInstanceOf(CheckoutPersistenceError);
		}
	});

	it('fails closed on duplicate existing-attempt rows', async () => {
		await expect(
			reserveCheckoutAttemptInTransaction(
				transactionWithRows([], [], [persistedAttemptRow(), persistedAttemptRow()]),
				{
					canonicalRequest,
					requestFingerprint: FINGERPRINT,
					capabilityKey: CAPABILITY_KEY,
					now: NOW,
					repository: {},
					quoteCheckout: vi.fn()
				}
			)
		).rejects.toBeInstanceOf(CheckoutPersistenceError);
	});

	it.each([
		['a malformed persisted row', null],
		['a malformed persisted order state', persistedAttemptRow({ order_version: 0 })],
		['an invalid persisted date', persistedAttemptRow({ order_created_at: 42 })],
		['an unparsable persisted date', persistedAttemptRow({ order_created_at: 'not-a-date' })],
		['an invalid persisted idempotency key', persistedAttemptRow({ stripe_idempotency_key: '' })],
		[
			'an invalid persisted ready provider state',
			persistedAttemptRow({
				attempt_status: 'ready',
				stripe_session_id: null,
				stripe_expires_at: new Date('2026-08-14T18:00:00.000Z'),
				checkout_ready_at: NOW
			})
		],
		[
			'a malformed persisted ready Session ID',
			persistedAttemptRow({
				attempt_status: 'ready',
				stripe_session_id: 'not-a-session',
				stripe_expires_at: new Date('2026-08-14T18:00:00.000Z'),
				checkout_ready_at: NOW
			})
		],
		[
			'a missing persisted ready expiry',
			persistedAttemptRow({
				attempt_status: 'ready',
				stripe_session_id: 'cs_test_ready',
				stripe_expires_at: null,
				checkout_ready_at: NOW
			})
		],
		[
			'a missing persisted ready timestamp',
			persistedAttemptRow({
				attempt_status: 'ready',
				stripe_session_id: 'cs_test_ready',
				stripe_expires_at: new Date('2026-08-14T18:00:00.000Z'),
				checkout_ready_at: null
			})
		],
		[
			'a nonterminal ready attempt with a terminal timestamp',
			persistedAttemptRow({
				attempt_status: 'ready',
				stripe_session_id: 'cs_test_ready',
				stripe_expires_at: new Date('2026-08-14T18:00:00.000Z'),
				checkout_ready_at: NOW,
				terminal_at: NOW
			})
		]
	])('fails closed on %s', async (_label, persistedRow) => {
		await expect(
			reserveCheckoutAttemptInTransaction(transactionWithRows([], [], [persistedRow]), {
				canonicalRequest,
				requestFingerprint: FINGERPRINT,
				capabilityKey: CAPABILITY_KEY,
				now: NOW,
				repository: {},
				quoteCheckout: vi.fn()
			})
		).rejects.toBeInstanceOf(CheckoutPersistenceError);
	});

	it('fails closed when persisted line totals no longer match the order', async () => {
		await expect(
			reserveCheckoutAttemptInTransaction(
				transactionWithRows([], [], [persistedAttemptRow()], [persistedLine(bookLine)]),
				{
					canonicalRequest,
					requestFingerprint: FINGERPRINT,
					capabilityKey: CAPABILITY_KEY,
					now: NOW,
					repository: {},
					quoteCheckout: vi.fn()
				}
			)
		).rejects.toBeInstanceOf(CheckoutPersistenceError);
	});

	it('redacts a capability derivation failure during recovery', async () => {
		await expect(
			reserveCheckoutAttemptInTransaction(
				transactionWithRows(
					[],
					[],
					[persistedAttemptRow()],
					[persistedLine(bookLine), persistedLine(feeLine)]
				),
				{
					canonicalRequest,
					requestFingerprint: FINGERPRINT,
					capabilityKey: 'short',
					now: NOW,
					repository: {},
					quoteCheckout: vi.fn()
				}
			)
		).rejects.toBeInstanceOf(CheckoutPersistenceError);
	});

	it('recovers a valid ready attempt with an attached PaymentIntent', async () => {
		const expiry = new Date('2026-08-14T18:00:00.000Z');
		const result = await reserveCheckoutAttemptInTransaction(
			transactionWithRows(
				[],
				[],
				[
					persistedAttemptRow({
						attempt_status: 'ready',
						stripe_session_id: 'cs_test_ready',
						payment_intent_id: 'pi_test_ready',
						stripe_expires_at: expiry,
						checkout_ready_at: NOW
					})
				],
				[persistedLine(bookLine), persistedLine(feeLine)]
			),
			{
				canonicalRequest,
				requestFingerprint: FINGERPRINT,
				capabilityKey: CAPABILITY_KEY,
				now: NOW,
				repository: {},
				quoteCheckout: vi.fn()
			}
		);

		expect(result.attempt).toMatchObject({
			status: 'ready',
			stripeSessionId: 'cs_test_ready',
			paymentIntentId: 'pi_test_ready'
		});
	});

	it('sorts persisted books and fees by every stable snapshot key', async () => {
		const secondBookId = '11111111-1111-4111-8111-111111111111';
		const secondCourseId = '22222222-2222-4222-8222-222222222222';
		const secondStoreId = '33333333-3333-4333-8333-333333333333';
		const expandedLines = [
			feeLine,
			{
				...bookLine,
				bookId: secondBookId,
				quantity: 1,
				unitAmountCents: 100,
				lineAmountCents: 100
			},
			{
				...bookLine,
				courseId: secondCourseId,
				bookId: secondBookId,
				quantity: 1,
				unitAmountCents: 200,
				lineAmountCents: 200
			},
			bookLine,
			{
				...feeLine,
				bookstoreId: secondStoreId,
				bookstoreName: 'Second Store',
				label: 'Second Store pickup service'
			}
		];
		const expandedQuote = {
			currency: 'cad',
			subtotalCents: 4300,
			serviceFeeCents: 1000,
			taxCents: 0,
			totalCents: 5300,
			lines: expandedLines
		};

		const result = await reserveCheckoutAttemptInTransaction(transactionWithRows([], [], [], []), {
			canonicalRequest,
			requestFingerprint: FINGERPRINT,
			capabilityKey: CAPABILITY_KEY,
			now: NOW,
			repository: {},
			quoteCheckout: vi.fn().mockResolvedValue(expandedQuote),
			identifierFactory: vi.fn(() => identifiers())
		});

		expect(
			result.lines.map((line) => [line.kind, line.courseId, line.bookId, line.bookstoreId])
		).toEqual([
			['book', secondCourseId, secondBookId, STORE_ID],
			['book', COURSE_ID, secondBookId, STORE_ID],
			['book', COURSE_ID, BOOK_ID, STORE_ID],
			['service_fee', null, null, secondStoreId],
			['service_fee', null, null, STORE_ID]
		]);
	});

	it('rejects malformed provider persistence input before querying', async () => {
		const transaction = transactionWithRows();
		await expect(
			persistCheckoutSessionInTransaction(transaction, {
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				requestFingerprint: FINGERPRINT,
				providerSession: null,
				now: NOW
			})
		).rejects.toBeInstanceOf(CheckoutPersistenceError);
		expect(transaction.execute).not.toHaveBeenCalled();
	});

	it('fails closed when the persisted attempt disappears before readiness', async () => {
		await expect(
			persistCheckoutSessionInTransaction(transactionWithRows([]), {
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				requestFingerprint: FINGERPRINT,
				providerSession: {
					id: 'cs_test_persisted_checkout',
					paymentIntentId: null,
					expiresAt: new Date('2026-08-14T18:00:00.000Z')
				},
				now: NOW
			})
		).rejects.toBeInstanceOf(CheckoutPersistenceError);
	});

	it('rejects an inconsistent created attempt before its readiness update', async () => {
		const transaction = transactionWithRows([
			persistedAttemptRow({ stripe_session_id: 'cs_test_forged' })
		]);
		await expect(
			persistCheckoutSessionInTransaction(transaction, {
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				requestFingerprint: FINGERPRINT,
				providerSession: {
					id: 'cs_test_persisted_checkout',
					paymentIntentId: null,
					expiresAt: new Date('2026-08-14T18:00:00.000Z')
				},
				now: NOW
			})
		).rejects.toBeInstanceOf(CheckoutPersistenceError);
		expect(transaction.execute).toHaveBeenCalledOnce();
	});

	it('fails closed when attaching a late PaymentIntent loses its compare-and-set', async () => {
		const readyAt = new Date('2026-08-13T18:01:00.000Z');
		const transaction = transactionWithRows(
			[
				persistedAttemptRow({
					attempt_status: 'ready',
					stripe_session_id: 'cs_test_persisted_checkout',
					stripe_expires_at: new Date('2026-08-14T18:00:00.000Z'),
					checkout_ready_at: readyAt
				})
			],
			[]
		);
		await expect(
			persistCheckoutSessionInTransaction(transaction, {
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				requestFingerprint: FINGERPRINT,
				providerSession: {
					id: 'cs_test_persisted_checkout',
					paymentIntentId: 'pi_test_late',
					expiresAt: new Date('2026-08-14T18:00:00.000Z')
				},
				now: NOW
			})
		).rejects.toBeInstanceOf(CheckoutPersistenceError);
	});

	it('rejects replacing an already-persisted PaymentIntent', async () => {
		const expiry = new Date('2026-08-14T18:00:00.000Z');
		const transaction = transactionWithRows([
			persistedAttemptRow({
				attempt_status: 'ready',
				stripe_session_id: 'cs_test_persisted_checkout',
				payment_intent_id: 'pi_test_original',
				stripe_expires_at: expiry,
				checkout_ready_at: NOW
			})
		]);
		await expect(
			persistCheckoutSessionInTransaction(transaction, {
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				requestFingerprint: FINGERPRINT,
				providerSession: {
					id: 'cs_test_persisted_checkout',
					paymentIntentId: 'pi_test_different',
					expiresAt: expiry
				},
				now: NOW
			})
		).rejects.toBeInstanceOf(CheckoutPersistenceError);
	});
});
