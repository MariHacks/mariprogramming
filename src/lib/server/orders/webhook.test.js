// @vitest-environment node

import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import {
	loadRefundTargetInTransaction,
	reduceStripeWebhookInTransaction,
	StripeWebhookPersistenceError
} from './webhook';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const ATTEMPT_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = 'cs_test_verified_session';
const PAYMENT_INTENT_ID = 'pi_verified_payment';
const CHARGE_ID = 'ch_verified_charge';
const EVENT_ID = 'evt_verified_event';
const NOW = new Date('2026-08-13T18:00:00.000Z');
const EXPIRES_AT = new Date('2026-08-14T18:00:00.000Z');
const TOTAL_CENTS = 2500;

/** @param {Record<string, any>} [overrides] */
function descriptor(overrides = {}) {
	return Object.freeze({
		id: EVENT_ID,
		type: 'checkout.session.completed',
		mode: 'test',
		kind: 'completed',
		objectId: SESSION_ID,
		environmentMatches: true,
		...overrides
	});
}

/** @param {Record<string, any>} [overrides] */
function evidence(overrides = {}) {
	return Object.freeze({
		kind: 'completed',
		orderId: ORDER_ID,
		attemptId: ATTEMPT_ID,
		sessionId: SESSION_ID,
		paymentIntentId: PAYMENT_INTENT_ID,
		chargeId: CHARGE_ID,
		totalCents: TOTAL_CENTS,
		refundedAmountCents: 0,
		receiptEmail: 'ada@example.com',
		expiresAt: EXPIRES_AT,
		...overrides
	});
}

/** @param {Record<string, any>} [overrides] */
function persistedRow(overrides = {}) {
	return {
		attempt_id: ATTEMPT_ID,
		attempt_order_id: ORDER_ID,
		stripe_session_id: SESSION_ID,
		payment_intent_id: null,
		stripe_charge_id: null,
		stripe_expires_at: EXPIRES_AT,
		checkout_ready_at: NOW,
		terminal_at: null,
		attempt_status: 'ready',
		attempt_version: 2,
		order_id: ORDER_ID,
		customer_email: 'ada@example.com',
		currency: 'cad',
		payment_status: 'pending',
		fulfillment_status: 'unstarted',
		refunded_amount_cents: 0,
		total_cents: TOTAL_CENTS,
		order_version: 1,
		pii_purge_after: null,
		...overrides
	};
}

/** @param {any} query */
function compile(query) {
	return new PgDialect().sqlToQuery(query);
}

/** @param {Record<string, any> | null} [row] @param {Record<string, any>} [options] */
function transactionFor(row = persistedRow(), options = {}) {
	let eventInserted = false;
	const transaction = {
		execute: vi.fn(async (query) => {
			const compiled = compile(query);
			if (options.throwOn?.(compiled)) throw new Error('database failure');
			if (compiled.sql.includes('INSERT INTO stripe_events')) {
				if (options.duplicate) return { rows: [] };
				eventInserted = true;
				return { rows: [{ event_id: options.insertedEventId ?? EVENT_ID }] };
			}
			if (compiled.sql.includes('SELECT type, mode, disposition, processed_at')) {
				return {
					rows: [
						Object.prototype.hasOwnProperty.call(options, 'duplicateRow')
							? options.duplicateRow
							: {
									type: descriptor().type,
									mode: 'test',
									disposition: 'applied',
									processed_at: NOW
								}
					]
				};
			}
			if (compiled.sql.includes('FOR UPDATE OF ca, o')) {
				if (Object.prototype.hasOwnProperty.call(options, 'orderRows')) {
					return { rows: options.orderRows };
				}
				return { rows: row === null ? [] : [row] };
			}
			if (compiled.sql.includes('FROM checkout_attempts ca')) {
				return { rows: row === null ? [] : [row] };
			}
			if (compiled.sql.includes('UPDATE checkout_attempts')) {
				return {
					rows: options.attemptUpdateMissing
						? []
						: [{ attempt_id: options.attemptUpdateId ?? ATTEMPT_ID }]
				};
			}
			if (compiled.sql.includes('UPDATE orders')) {
				return { rows: options.orderUpdateMissing ? [] : [{ order_id: ORDER_ID }] };
			}
			if (compiled.sql.includes('UPDATE stripe_events')) {
				return {
					rows: eventInserted ? [{ event_id: options.finalEventId ?? EVENT_ID }] : []
				};
			}
			return { rows: [] };
		})
	};
	return transaction;
}

/** @param {any} transaction */
function calls(transaction) {
	return /** @type {Array<{ sql: string, params: any[] }>} */ (
		transaction.execute.mock.calls.map((/** @type {any[]} */ [query]) => compile(query))
	);
}

describe('refund target preflight', () => {
	it('returns only the stored Session id without mutating state', async () => {
		const transaction = transactionFor();
		expect(
			await loadRefundTargetInTransaction(transaction, {
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				paymentIntentId: PAYMENT_INTENT_ID,
				chargeId: CHARGE_ID
			})
		).toEqual({ sessionId: SESSION_ID });
		const compiled = calls(transaction);
		expect(compiled).toHaveLength(1);
		expect(compiled[0].sql).not.toContain('FOR UPDATE');
		expect(compiled[0].sql).not.toMatch(/INSERT|UPDATE|DELETE/u);
	});

	it('returns null for an unknown target', async () => {
		expect(
			await loadRefundTargetInTransaction(transactionFor(null), {
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				paymentIntentId: PAYMENT_INTENT_ID,
				chargeId: CHARGE_ID
			})
		).toBeNull();
	});

	it.each([
		['a conflicting stored PaymentIntent', { payment_intent_id: 'pi_other' }],
		[
			'a conflicting stored Charge',
			{
				payment_status: 'paid',
				attempt_status: 'completed',
				payment_intent_id: PAYMENT_INTENT_ID,
				stripe_charge_id: 'ch_other',
				terminal_at: NOW
			}
		]
	])(
		'returns no refund target for %s so the event can be recorded as rejected',
		async (_label, row) => {
			await expect(
				loadRefundTargetInTransaction(transactionFor(persistedRow(row)), {
					orderId: ORDER_ID,
					attemptId: ATTEMPT_ID,
					paymentIntentId: PAYMENT_INTENT_ID,
					chargeId: CHARGE_ID
				})
			).resolves.toBeNull();
		}
	);

	it.each([
		['invalid identifiers', { orderId: 'bad' }, undefined],
		['a malformed transaction', {}, null],
		['multiple persisted targets', {}, [persistedRow(), persistedRow()]],
		['a target without a Session', {}, [{ ...persistedRow(), stripe_session_id: null }]]
	])('fails closed for %s', async (_label, overrides, explicitRows) => {
		const transaction =
			explicitRows === null
				? {}
				: explicitRows
					? { execute: vi.fn(async () => ({ rows: explicitRows })) }
					: transactionFor();
		await expect(
			loadRefundTargetInTransaction(transaction, {
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				paymentIntentId: PAYMENT_INTENT_ID,
				chargeId: CHARGE_ID,
				...overrides
			})
		).rejects.toBeInstanceOf(StripeWebhookPersistenceError);
	});

	it('rejects a structurally valid target that does not match the requested identifiers', async () => {
		await expect(
			loadRefundTargetInTransaction(
				transactionFor(persistedRow({ attempt_id: '33333333-3333-4333-8333-333333333333' })),
				{
					orderId: ORDER_ID,
					attemptId: ATTEMPT_ID,
					paymentIntentId: PAYMENT_INTENT_ID,
					chargeId: CHARGE_ID
				}
			)
		).rejects.toBeInstanceOf(StripeWebhookPersistenceError);
	});
});

describe('transactional Stripe event reducer', () => {
	it('records a valid unsupported type and acknowledges it without order work', async () => {
		const transaction = transactionFor(null);
		const result = await reduceStripeWebhookInTransaction(transaction, {
			descriptor: descriptor({
				type: 'payment_intent.processing',
				kind: 'unsupported',
				objectId: null
			}),
			now: NOW
		});
		expect(result).toEqual({ disposition: 'ignored_unsupported_type' });
		const compiled = calls(transaction);
		expect(compiled).toHaveLength(2);
		expect(compiled[0].sql).toContain('INSERT INTO stripe_events');
		expect(compiled[1].sql).toContain('UPDATE stripe_events');
		expect(compiled.every(({ sql }) => !sql.includes('audit_log'))).toBe(true);
	});

	it('records a bounded rejection for a valid signed environment mismatch without provider facts', async () => {
		const transaction = transactionFor(null);
		expect(
			await reduceStripeWebhookInTransaction(transaction, {
				descriptor: descriptor({ environmentMatches: false }),
				rejection: 'provider_mismatch',
				now: NOW
			})
		).toEqual({ disposition: 'rejected' });
		expect(calls(transaction)).toHaveLength(2);
	});

	it('acknowledges the same event ID without repeating state or audit effects', async () => {
		const transaction = transactionFor(persistedRow(), { duplicate: true });
		expect(
			await reduceStripeWebhookInTransaction(transaction, {
				descriptor: descriptor(),
				evidence: evidence(),
				now: NOW
			})
		).toEqual({ disposition: 'duplicate' });
		const compiled = calls(transaction);
		expect(compiled).toHaveLength(2);
		expect(compiled.every(({ sql }) => !sql.includes('UPDATE orders'))).toBe(true);
		expect(compiled.every(({ sql }) => !sql.includes('audit_log'))).toBe(true);
	});

	it.each([
		[
			'a duplicate type mismatch',
			{ type: 'charge.refunded', mode: 'test', disposition: 'applied', processed_at: NOW }
		],
		[
			'an unprocessed duplicate',
			{ type: descriptor().type, mode: 'test', disposition: 'applied', processed_at: null }
		],
		['malformed duplicate state', null]
	])('fails closed for %s', async (_label, duplicateRow) => {
		const transaction = transactionFor(persistedRow(), { duplicate: true, duplicateRow });
		await expect(
			reduceStripeWebhookInTransaction(transaction, {
				descriptor: descriptor(),
				evidence: evidence(),
				now: NOW
			})
		).rejects.toBeInstanceOf(StripeWebhookPersistenceError);
	});

	it.each([
		['a handled descriptor with the wrong kind', descriptor({ kind: 'expired' })],
		[
			'an unsupported descriptor carrying an object id',
			descriptor({ type: 'customer.created', kind: 'unsupported', objectId: SESSION_ID })
		],
		['a handled descriptor with a malformed object id', descriptor({ objectId: CHARGE_ID })]
	])('rejects %s before writing an event', async (_label, invalidDescriptor) => {
		await expect(
			reduceStripeWebhookInTransaction(transactionFor(), {
				descriptor: invalidDescriptor,
				evidence: evidence(),
				now: NOW
			})
		).rejects.toBeInstanceOf(StripeWebhookPersistenceError);
	});

	it('accepts provider timestamps returned as ISO strings', async () => {
		const transaction = transactionFor(
			persistedRow({
				stripe_expires_at: EXPIRES_AT.toISOString(),
				checkout_ready_at: NOW.toISOString()
			})
		);
		expect(
			await reduceStripeWebhookInTransaction(transaction, {
				descriptor: descriptor(),
				evidence: evidence(),
				now: NOW
			})
		).toEqual({ disposition: 'applied' });
	});

	it.each(['pending', 'cancelled'])(
		'applies verified completion from %s and never changes fulfillment',
		async (paymentStatus) => {
			const transaction = transactionFor(persistedRow({ payment_status: paymentStatus }));
			expect(
				await reduceStripeWebhookInTransaction(transaction, {
					descriptor: descriptor(),
					evidence: evidence(),
					now: NOW
				})
			).toEqual({ disposition: 'applied' });
			const compiled = calls(transaction);
			expect(compiled.some(({ sql }) => sql.includes('UPDATE checkout_attempts'))).toBe(true);
			const orderUpdate = compiled.find(({ sql }) => sql.includes('UPDATE orders'));
			expect(orderUpdate?.sql).toContain("payment_status = 'paid'");
			expect(orderUpdate?.sql).toContain('refunded_amount_cents = 0');
			expect(orderUpdate?.sql).not.toContain('fulfillment_status =');
			expect(compiled.some(({ sql }) => sql.includes('INSERT INTO audit_log'))).toBe(true);
		}
	);

	it.each(['paid', 'partially_refunded', 'refunded', 'expired', 'failed'])(
		'records completion from %s as a stale no-op',
		async (paymentStatus) => {
			const refunded =
				paymentStatus === 'partially_refunded'
					? 500
					: paymentStatus === 'refunded'
						? TOTAL_CENTS
						: 0;
			const transaction = transactionFor(
				persistedRow({
					payment_status: paymentStatus,
					refunded_amount_cents: refunded,
					attempt_status:
						paymentStatus === 'paid' || paymentStatus.includes('refunded')
							? 'completed'
							: 'expired',
					payment_intent_id:
						paymentStatus === 'paid' || paymentStatus.includes('refunded')
							? PAYMENT_INTENT_ID
							: null,
					stripe_charge_id:
						paymentStatus === 'paid' || paymentStatus.includes('refunded') ? CHARGE_ID : null,
					terminal_at: NOW
				})
			);
			expect(
				await reduceStripeWebhookInTransaction(transaction, {
					descriptor: descriptor(),
					evidence: evidence(),
					now: NOW
				})
			).toEqual({ disposition: 'stale' });
			const compiled = calls(transaction);
			expect(compiled.every(({ sql }) => !sql.includes('UPDATE orders'))).toBe(true);
			expect(compiled.some(({ sql }) => sql.includes('INSERT INTO audit_log'))).toBe(true);
		}
	);

	it('expires a pending order and attempt with a retention deadline', async () => {
		const transaction = transactionFor();
		const expiredDescriptor = descriptor({
			type: 'checkout.session.expired',
			kind: 'expired'
		});
		const expiredEvidence = evidence({
			kind: 'expired',
			paymentIntentId: null,
			chargeId: null,
			receiptEmail: null
		});
		expect(
			await reduceStripeWebhookInTransaction(transaction, {
				descriptor: expiredDescriptor,
				evidence: expiredEvidence,
				now: NOW
			})
		).toEqual({ disposition: 'applied' });
		const compiled = calls(transaction);
		expect(compiled.find(({ sql }) => sql.includes('UPDATE checkout_attempts'))?.sql).toContain(
			"status = 'expired'"
		);
		const orderUpdate = compiled.find(({ sql }) => sql.includes('UPDATE orders'));
		expect(orderUpdate?.sql).toContain("payment_status = 'expired'");
		expect(orderUpdate?.sql).toContain('pii_purge_after');
		expect(orderUpdate?.sql).not.toContain('fulfillment_status =');
	});

	it('accepts a bound PaymentIntent and receipt email on an expired event', async () => {
		const transaction = transactionFor();
		expect(
			await reduceStripeWebhookInTransaction(transaction, {
				descriptor: descriptor({ type: 'checkout.session.expired', kind: 'expired' }),
				evidence: evidence({
					kind: 'expired',
					paymentIntentId: PAYMENT_INTENT_ID,
					chargeId: null,
					refundedAmountCents: 0,
					receiptEmail: 'ada@example.com'
				}),
				now: NOW
			})
		).toEqual({ disposition: 'applied' });
	});

	it.each([
		[
			'a conflicting stored PaymentIntent',
			{ payment_intent_id: 'pi_other' },
			{ paymentIntentId: PAYMENT_INTENT_ID, receiptEmail: 'ada@example.com' }
		],
		[
			'a customer email mismatch',
			{ customer_email: 'other@example.com' },
			{ paymentIntentId: null, receiptEmail: 'ada@example.com' }
		]
	])(
		'rejects expired evidence with %s without changing persisted state',
		async (_label, row, provider) => {
			const transaction = transactionFor(persistedRow(row));
			expect(
				await reduceStripeWebhookInTransaction(transaction, {
					descriptor: descriptor({ type: 'checkout.session.expired', kind: 'expired' }),
					evidence: evidence({
						kind: 'expired',
						paymentIntentId: provider.paymentIntentId,
						chargeId: null,
						refundedAmountCents: 0,
						receiptEmail: provider.receiptEmail
					}),
					now: NOW
				})
			).toEqual({ disposition: 'rejected' });
			const compiled = calls(transaction);
			expect(compiled.every(({ sql }) => !sql.includes('UPDATE checkout_attempts'))).toBe(true);
			expect(compiled.every(({ sql }) => !sql.includes('UPDATE orders'))).toBe(true);
		}
	);

	it('rejects malformed expired and completed evidence after inserting no state', async () => {
		await expect(
			reduceStripeWebhookInTransaction(transactionFor(), {
				descriptor: descriptor({ type: 'checkout.session.expired', kind: 'expired' }),
				evidence: evidence({
					kind: 'expired',
					paymentIntentId: null,
					chargeId: CHARGE_ID,
					receiptEmail: null
				}),
				now: NOW
			})
		).rejects.toBeInstanceOf(StripeWebhookPersistenceError);
		await expect(
			reduceStripeWebhookInTransaction(transactionFor(), {
				descriptor: descriptor(),
				evidence: evidence({ refundedAmountCents: 1 }),
				now: NOW
			})
		).rejects.toBeInstanceOf(StripeWebhookPersistenceError);
	});

	it.each(['paid', 'partially_refunded', 'refunded', 'cancelled', 'expired', 'failed'])(
		'never regresses %s on expiration',
		async (paymentStatus) => {
			const refunded =
				paymentStatus === 'partially_refunded'
					? 500
					: paymentStatus === 'refunded'
						? TOTAL_CENTS
						: 0;
			const transaction = transactionFor(
				persistedRow({
					payment_status: paymentStatus,
					refunded_amount_cents: refunded,
					attempt_status:
						paymentStatus === 'paid' || paymentStatus.includes('refunded')
							? 'completed'
							: 'expired',
					payment_intent_id:
						paymentStatus === 'paid' || paymentStatus.includes('refunded')
							? PAYMENT_INTENT_ID
							: null,
					stripe_charge_id:
						paymentStatus === 'paid' || paymentStatus.includes('refunded') ? CHARGE_ID : null,
					terminal_at: NOW
				})
			);
			const result = await reduceStripeWebhookInTransaction(transaction, {
				descriptor: descriptor({ type: 'checkout.session.expired', kind: 'expired' }),
				evidence: evidence({
					kind: 'expired',
					paymentIntentId:
						paymentStatus === 'paid' || paymentStatus.includes('refunded')
							? PAYMENT_INTENT_ID
							: null,
					chargeId: null,
					receiptEmail: null
				}),
				now: NOW
			});
			expect(result).toEqual({ disposition: 'stale' });
			expect(calls(transaction).every(({ sql }) => !sql.includes('UPDATE orders'))).toBe(true);
		}
	);

	it.each([
		['refund before completion', 'pending', 0, 600, 'partially_refunded'],
		['first partial refund', 'paid', 0, 600, 'partially_refunded'],
		['increasing partial refund', 'partially_refunded', 400, 600, 'partially_refunded'],
		['full refund', 'partially_refunded', 600, TOTAL_CENTS, 'refunded']
	])(
		'applies %s monotonically',
		async (_label, paymentStatus, previousRefund, nextRefund, nextStatus) => {
			const isPending = paymentStatus === 'pending';
			const transaction = transactionFor(
				persistedRow({
					payment_status: paymentStatus,
					refunded_amount_cents: previousRefund,
					attempt_status: isPending ? 'ready' : 'completed',
					payment_intent_id: isPending ? null : PAYMENT_INTENT_ID,
					stripe_charge_id: isPending ? null : CHARGE_ID,
					terminal_at: isPending ? null : NOW
				})
			);
			const result = await reduceStripeWebhookInTransaction(transaction, {
				descriptor: descriptor({ type: 'charge.refunded', kind: 'refunded', objectId: CHARGE_ID }),
				evidence: evidence({ kind: 'refunded', refundedAmountCents: nextRefund }),
				now: NOW
			});
			expect(result).toEqual({ disposition: 'applied' });
			const compiled = calls(transaction);
			const orderUpdate = compiled.find(({ sql }) => sql.includes('UPDATE orders'));
			expect(orderUpdate?.sql).toContain('refunded_amount_cents =');
			expect(orderUpdate?.params).toContain(nextRefund);
			expect(orderUpdate?.params).toContain(nextStatus);
			expect(orderUpdate?.sql).not.toContain('fulfillment_status =');
			if (isPending) {
				expect(compiled.some(({ sql }) => sql.includes('UPDATE checkout_attempts'))).toBe(true);
			}
		}
	);

	it.each([
		['the same cumulative amount', 'partially_refunded', 600, 600, 'stale'],
		['a decreasing cumulative amount', 'partially_refunded', 600, 500, 'rejected'],
		['an excess amount', 'paid', 0, TOTAL_CENTS + 1, 'rejected'],
		['a mismatched provider total', 'paid', 0, 600, 'rejected', TOTAL_CENTS + 1]
	])(
		'records %s without changing the order',
		async (
			_label,
			paymentStatus,
			previousRefund,
			nextRefund,
			disposition,
			providerTotal = TOTAL_CENTS
		) => {
			const transaction = transactionFor(
				persistedRow({
					payment_status: paymentStatus,
					refunded_amount_cents: previousRefund,
					attempt_status: 'completed',
					payment_intent_id: PAYMENT_INTENT_ID,
					stripe_charge_id: CHARGE_ID,
					terminal_at: NOW
				})
			);
			expect(
				await reduceStripeWebhookInTransaction(transaction, {
					descriptor: descriptor({
						type: 'charge.refunded',
						kind: 'refunded',
						objectId: CHARGE_ID
					}),
					evidence: evidence({
						kind: 'refunded',
						refundedAmountCents: nextRefund,
						totalCents: providerTotal
					}),
					now: NOW
				})
			).toEqual({ disposition });
			expect(calls(transaction).every(({ sql }) => !sql.includes('UPDATE orders'))).toBe(true);
		}
	);

	it('records a refund against a terminal payment state as a stale no-op', async () => {
		const transaction = transactionFor(
			persistedRow({
				payment_status: 'refunded',
				refunded_amount_cents: TOTAL_CENTS,
				attempt_status: 'completed',
				payment_intent_id: PAYMENT_INTENT_ID,
				stripe_charge_id: CHARGE_ID,
				terminal_at: NOW
			})
		);
		expect(
			await reduceStripeWebhookInTransaction(transaction, {
				descriptor: descriptor({ type: 'charge.refunded', kind: 'refunded', objectId: CHARGE_ID }),
				evidence: evidence({ kind: 'refunded', refundedAmountCents: TOTAL_CENTS + 1 }),
				now: NOW
			})
		).toEqual({ disposition: 'stale' });
	});

	it('applies expiry without repeating the already-expired attempt transition', async () => {
		const transaction = transactionFor(
			persistedRow({
				attempt_status: 'expired',
				terminal_at: NOW
			})
		);
		expect(
			await reduceStripeWebhookInTransaction(transaction, {
				descriptor: descriptor({ type: 'checkout.session.expired', kind: 'expired' }),
				evidence: evidence({
					kind: 'expired',
					paymentIntentId: null,
					chargeId: null,
					receiptEmail: null
				}),
				now: NOW
			})
		).toEqual({ disposition: 'applied' });
		expect(calls(transaction).every(({ sql }) => !sql.includes('UPDATE checkout_attempts'))).toBe(
			true
		);
	});

	it('rejects expiry when an impossible completed attempt still has a pending order', async () => {
		const transaction = transactionFor(
			persistedRow({
				attempt_status: 'completed',
				payment_intent_id: PAYMENT_INTENT_ID,
				stripe_charge_id: CHARGE_ID,
				terminal_at: NOW
			})
		);
		expect(
			await reduceStripeWebhookInTransaction(transaction, {
				descriptor: descriptor({ type: 'checkout.session.expired', kind: 'expired' }),
				evidence: evidence({
					kind: 'expired',
					paymentIntentId: PAYMENT_INTENT_ID,
					chargeId: null,
					receiptEmail: null
				}),
				now: NOW
			})
		).toEqual({ disposition: 'rejected' });
	});

	it('rejects structurally inconsistent stored refund and provider states', async () => {
		for (const row of [
			persistedRow({
				payment_status: 'partially_refunded',
				refunded_amount_cents: 0,
				attempt_status: 'completed',
				payment_intent_id: PAYMENT_INTENT_ID,
				stripe_charge_id: CHARGE_ID,
				terminal_at: NOW
			}),
			persistedRow({
				attempt_status: 'created',
				stripe_session_id: null,
				stripe_expires_at: null,
				checkout_ready_at: null,
				terminal_at: NOW
			})
		]) {
			await expect(
				reduceStripeWebhookInTransaction(transactionFor(row), {
					descriptor: descriptor(),
					evidence: evidence(),
					now: NOW
				})
			).rejects.toBeInstanceOf(StripeWebhookPersistenceError);
		}
	});

	it.each([
		[
			'a valid created attempt',
			{
				attempt_status: 'created',
				stripe_session_id: null,
				stripe_expires_at: null,
				checkout_ready_at: null
			}
		],
		[
			'a valid failed attempt',
			{
				payment_status: 'failed',
				attempt_status: 'failed',
				stripe_session_id: null,
				stripe_expires_at: null,
				checkout_ready_at: null,
				terminal_at: NOW
			}
		]
	])('records evidence against %s as rejected', async (_label, row) => {
		expect(
			await reduceStripeWebhookInTransaction(transactionFor(persistedRow(row)), {
				descriptor: descriptor(),
				evidence: evidence(),
				now: NOW
			})
		).toEqual({ disposition: 'rejected' });
	});

	it.each([
		['a stored Session mismatch', { stripe_session_id: 'cs_test_other' }],
		['a stored PaymentIntent mismatch', { payment_intent_id: 'pi_other' }],
		[
			'a stored Charge mismatch',
			{
				payment_status: 'paid',
				attempt_status: 'completed',
				payment_intent_id: PAYMENT_INTENT_ID,
				stripe_charge_id: 'ch_other',
				terminal_at: NOW
			}
		],
		['a customer receipt mismatch', { customer_email: 'other@example.com' }],
		['a provider expiry mismatch', { stripe_expires_at: new Date(EXPIRES_AT.getTime() + 1000) }]
	])('records %s as rejected', async (_label, override) => {
		const transaction = transactionFor(persistedRow(override));
		expect(
			await reduceStripeWebhookInTransaction(transaction, {
				descriptor: descriptor(),
				evidence: evidence(),
				now: NOW
			})
		).toEqual({ disposition: 'rejected' });
		expect(calls(transaction).every(({ sql }) => !sql.includes('UPDATE orders'))).toBe(true);
	});

	it('records an unknown order as rejected without creating fulfillment work', async () => {
		const transaction = transactionFor(null);
		expect(
			await reduceStripeWebhookInTransaction(transaction, {
				descriptor: descriptor(),
				evidence: evidence(),
				now: NOW
			})
		).toEqual({ disposition: 'rejected' });
		const compiled = calls(transaction);
		expect(compiled.every(({ sql }) => !sql.includes('audit_log'))).toBe(true);
		expect(compiled.every(({ sql }) => !sql.includes('fulfillment_status ='))).toBe(true);
	});

	it.each([
		['a malformed transaction', {}, {}],
		['a malformed clock', transactionFor(), { now: new Date('invalid') }],
		['a malformed descriptor', transactionFor(), { descriptor: { id: 'bad' } }],
		['missing handled evidence', transactionFor(), { evidence: undefined }],
		['a malformed database row', transactionFor({ ...persistedRow(), total_cents: -1 }), {}],
		['a failed attempt update', transactionFor(persistedRow(), { attemptUpdateMissing: true }), {}],
		['a failed order update', transactionFor(persistedRow(), { orderUpdateMissing: true }), {}],
		[
			'an invalid evidence timestamp',
			transactionFor(),
			{ evidence: evidence({ expiresAt: new Date('invalid') }) }
		],
		[
			'an invalid stored timestamp',
			transactionFor(persistedRow({ stripe_expires_at: 'not-a-date' })),
			{}
		],
		['a non-date stored timestamp', transactionFor(persistedRow({ stripe_expires_at: 1 })), {}],
		['a malformed database result', { execute: vi.fn(async () => ({})) }, {}],
		['an invalid rejection code', transactionFor(), { rejection: 'other' }],
		[
			'a mismatched attempt update result',
			transactionFor(persistedRow(), { attemptUpdateId: ORDER_ID }),
			{}
		],
		[
			'a mismatched event insert result',
			transactionFor(persistedRow(), { insertedEventId: 'evt_other' }),
			{}
		],
		[
			'a mismatched event finalize result',
			transactionFor(persistedRow(), { finalEventId: 'evt_other' }),
			{}
		],
		[
			'multiple locked orders',
			transactionFor(persistedRow(), { orderRows: [persistedRow(), persistedRow()] }),
			{}
		]
	])(
		'fails closed and relies on transaction rollback for %s',
		async (_label, transaction, overrides) => {
			await expect(
				reduceStripeWebhookInTransaction(transaction, {
					descriptor: descriptor(),
					evidence: evidence(),
					now: NOW,
					...overrides
				})
			).rejects.toBeInstanceOf(StripeWebhookPersistenceError);
		}
	);

	it('fails closed when an expiry attempt CAS returns another row', async () => {
		await expect(
			reduceStripeWebhookInTransaction(
				transactionFor(persistedRow(), { attemptUpdateId: ORDER_ID }),
				{
					descriptor: descriptor({ type: 'checkout.session.expired', kind: 'expired' }),
					evidence: evidence({
						kind: 'expired',
						paymentIntentId: null,
						chargeId: null,
						receiptEmail: null
					}),
					now: NOW
				}
			)
		).rejects.toBeInstanceOf(StripeWebhookPersistenceError);
	});

	it('propagates audit/database failure so the outer transaction commits nothing', async () => {
		const transaction = transactionFor(persistedRow(), {
			throwOn: (/** @type {{ sql: string }} */ { sql }) => sql.includes('INSERT INTO audit_log')
		});
		await expect(
			reduceStripeWebhookInTransaction(transaction, {
				descriptor: descriptor(),
				evidence: evidence(),
				now: NOW
			})
		).rejects.toThrow('database failure');
	});
});
