// @vitest-environment node

import { PgDialect } from 'drizzle-orm/pg-core';
import { describe, expect, it, vi } from 'vitest';
import {
	BookDeliveryJobError,
	cleanupExpiredRateBucketsInTransaction,
	failAbandonedCheckoutAttemptInTransaction,
	listReconciliationCandidatesInTransaction,
	purgeDueCustomerDataInTransaction,
	reconcileProviderEvidenceInTransaction,
	runBookDeliveryJob
} from './book-delivery.js';

const NOW = new Date('2026-08-13T18:00:00.000Z');
const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const ATTEMPT_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = 'cs_test_reconcile';
const EXPIRES_AT = new Date('2026-08-13T17:00:00.000Z');
const CREATED_AT = new Date('2026-08-13T16:00:00.000Z');

/** @param {any} query */
function compile(query) {
	return new PgDialect().sqlToQuery(query);
}

function candidate(overrides = {}) {
	return {
		kind: 'ready',
		orderId: ORDER_ID,
		attemptId: ATTEMPT_ID,
		sessionId: SESSION_ID,
		paymentIntentId: null,
		customerEmail: 'student@example.com',
		totalCents: 2500,
		expiresAt: EXPIRES_AT,
		createdAt: CREATED_AT,
		...overrides
	};
}

function persistedRow(overrides = {}) {
	return {
		attempt_id: ATTEMPT_ID,
		attempt_order_id: ORDER_ID,
		stripe_session_id: SESSION_ID,
		payment_intent_id: null,
		stripe_charge_id: null,
		stripe_expires_at: EXPIRES_AT,
		checkout_ready_at: new Date('2026-08-13T16:05:00.000Z'),
		terminal_at: null,
		attempt_status: 'ready',
		attempt_version: 2,
		attempt_created_at: CREATED_AT,
		order_id: ORDER_ID,
		customer_email: 'student@example.com',
		currency: 'cad',
		payment_status: 'pending',
		fulfillment_status: 'unstarted',
		refunded_amount_cents: 0,
		total_cents: 2500,
		order_version: 1,
		pii_purge_after: null,
		...overrides
	};
}

function providerEvidence(overrides = {}) {
	return {
		kind: 'expired',
		orderId: ORDER_ID,
		attemptId: ATTEMPT_ID,
		sessionId: SESSION_ID,
		paymentIntentId: null,
		chargeId: null,
		totalCents: 2500,
		refundedAmountCents: 0,
		receiptEmail: null,
		expiresAt: EXPIRES_AT,
		...overrides
	};
}

/**
 * @typedef {{
 *   throwOn?: (sql: string) => boolean,
 *   candidateRows?: any[],
 *   lockRows?: any[],
 *   attemptUpdated?: boolean,
 *   orderUpdated?: boolean,
 *   purgeRows?: any[],
 *   bucketRows?: any[]
 * }} TxOptions
 * @param {TxOptions} [options]
 */
function txFor(options = {}) {
	return {
		execute: vi.fn(async (query) => {
			const { sql } = compile(query);
			if (options.throwOn?.(sql)) throw new Error('database detail');
			if (sql.includes('FROM checkout_attempts ca') && sql.includes('ORDER BY')) {
				return { rows: options.candidateRows ?? [] };
			}
			if (sql.includes('FOR UPDATE OF ca, o')) {
				return { rows: options.lockRows ?? [persistedRow()] };
			}
			if (sql.includes('UPDATE checkout_attempts')) {
				return { rows: options.attemptUpdated === false ? [] : [{ attempt_id: ATTEMPT_ID }] };
			}
			if (sql.includes('UPDATE orders')) {
				return { rows: options.orderUpdated === false ? [] : [{ order_id: ORDER_ID }] };
			}
			if (sql.includes('SELECT') && sql.includes('FROM orders') && sql.includes('SKIP LOCKED')) {
				return { rows: options.purgeRows ?? [] };
			}
			if (sql.includes('DELETE FROM rate_limit_buckets')) {
				return { rows: options.bucketRows ?? [] };
			}
			return { rows: [] };
		})
	};
}

describe('Book Delivery reconciliation persistence', () => {
	it('lists only bounded due created and ready attempts as private DTOs', async () => {
		const transaction = txFor({
			candidateRows: [
				{
					...persistedRow(),
					candidate_kind: 'ready'
				},
				{
					...persistedRow({
						stripe_session_id: null,
						stripe_expires_at: null,
						checkout_ready_at: null,
						attempt_status: 'created',
						attempt_version: 1
					}),
					candidate_kind: 'created'
				}
			]
		});
		const result = await listReconciliationCandidatesInTransaction(transaction, {
			now: NOW,
			limit: 2
		});
		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({ kind: 'ready', orderId: ORDER_ID, sessionId: SESSION_ID });
		expect(result[1]).toMatchObject({ kind: 'created', sessionId: null });
		expect(Object.isFrozen(result)).toBe(true);
		const compiled = compile(transaction.execute.mock.calls[0][0]);
		expect(compiled.params).toContain(2);
		expect(compiled.sql).toContain('LIMIT');
	});

	it('accepts serialized database timestamps and rejects malformed result envelopes', async () => {
		const serialized = txFor({
			candidateRows: [
				{
					...persistedRow({
						stripe_expires_at: EXPIRES_AT.toISOString(),
						checkout_ready_at: '2026-08-13T16:05:00.000Z',
						attempt_created_at: CREATED_AT.toISOString()
					}),
					candidate_kind: 'ready'
				}
			]
		});
		await expect(
			listReconciliationCandidatesInTransaction(serialized, { now: NOW })
		).resolves.toEqual([expect.objectContaining({ createdAt: CREATED_AT, expiresAt: EXPIRES_AT })]);

		for (const transaction of [
			{ execute: vi.fn(async () => null) },
			{ execute: vi.fn(async () => ({ rows: {} })) },
			txFor({ candidateRows: [{ ...persistedRow(), candidate_kind: 'forged' }] }),
			txFor({
				candidateRows: [{ ...persistedRow({ customer_email: 'invalid' }), candidate_kind: 'ready' }]
			}),
			txFor({
				candidateRows: [{ ...persistedRow({ attempt_created_at: 42 }), candidate_kind: 'ready' }]
			}),
			txFor({
				candidateRows: [
					{ ...persistedRow({ attempt_created_at: 'invalid' }), candidate_kind: 'ready' }
				]
			}),
			txFor({
				candidateRows: [{ ...persistedRow({ currency: 'usd' }), candidate_kind: 'ready' }]
			})
		]) {
			await expect(
				listReconciliationCandidatesInTransaction(transaction, { now: NOW })
			).rejects.toBeInstanceOf(BookDeliveryJobError);
		}
	});

	it('rejects a database result that exceeds its requested reconciliation bound', async () => {
		await expect(
			listReconciliationCandidatesInTransaction(
				txFor({ candidateRows: [persistedRow(), persistedRow()] }),
				{ now: NOW, limit: 1 }
			)
		).rejects.toBeInstanceOf(BookDeliveryJobError);
	});

	it.each([0, 21, 1.5])('rejects invalid reconciliation batch limit %s', async (limit) => {
		await expect(
			listReconciliationCandidatesInTransaction(txFor(), { now: NOW, limit })
		).rejects.toBeInstanceOf(BookDeliveryJobError);
	});

	it('fails an hour-old providerless attempt atomically and schedules retention', async () => {
		const transaction = txFor({
			lockRows: [
				persistedRow({
					stripe_session_id: null,
					stripe_expires_at: null,
					checkout_ready_at: null,
					attempt_status: 'created',
					attempt_version: 1
				})
			]
		});
		await expect(
			failAbandonedCheckoutAttemptInTransaction(transaction, {
				candidate: candidate({ kind: 'created', sessionId: null, expiresAt: null }),
				now: NOW
			})
		).resolves.toEqual({ disposition: 'applied' });
		const sql = transaction.execute.mock.calls.map(([query]) => compile(query).sql).join('\n');
		expect(sql).toContain("status = 'failed'");
		expect(sql).toContain("payment_status = 'failed'");
		expect(sql).toContain('INSERT INTO audit_log');
	});

	it('treats a concurrently terminal attempt as a safe no-op', async () => {
		const transaction = txFor({
			lockRows: [
				persistedRow({
					attempt_status: 'completed',
					payment_status: 'paid',
					payment_intent_id: 'pi_paid',
					stripe_charge_id: 'ch_paid',
					terminal_at: NOW
				})
			]
		});
		await expect(
			failAbandonedCheckoutAttemptInTransaction(transaction, {
				candidate: candidate({ kind: 'created', sessionId: null, expiresAt: null }),
				now: NOW
			})
		).resolves.toEqual({ disposition: 'stale' });
		expect(transaction.execute).toHaveBeenCalledTimes(1);
	});

	it('rejects a changed or not-yet-abandoned providerless attempt without writing', async () => {
		const created = candidate({ kind: 'created', sessionId: null, expiresAt: null });
		await expect(
			failAbandonedCheckoutAttemptInTransaction(txFor({ lockRows: [] }), {
				candidate: created,
				now: NOW
			})
		).rejects.toBeInstanceOf(BookDeliveryJobError);
		await expect(
			failAbandonedCheckoutAttemptInTransaction(
				txFor({
					lockRows: [
						persistedRow({
							attempt_status: 'created',
							stripe_session_id: null,
							stripe_expires_at: null,
							checkout_ready_at: null,
							payment_intent_id: 'pi_changed'
						})
					]
				}),
				{ candidate: created, now: NOW }
			)
		).resolves.toEqual({ disposition: 'rejected' });
		await expect(
			failAbandonedCheckoutAttemptInTransaction(txFor(), {
				candidate: candidate({ kind: 'forged' }),
				now: NOW
			})
		).rejects.toBeInstanceOf(BookDeliveryJobError);
	});

	it('fails the abandoned transition when either compare-and-set misses', async () => {
		const input = {
			candidate: candidate({ kind: 'created', sessionId: null, expiresAt: null }),
			now: NOW
		};
		const createdRow = persistedRow({
			attempt_status: 'created',
			stripe_session_id: null,
			stripe_expires_at: null,
			checkout_ready_at: null,
			attempt_version: 1
		});
		await expect(
			failAbandonedCheckoutAttemptInTransaction(
				txFor({ lockRows: [createdRow], attemptUpdated: false }),
				input
			)
		).rejects.toBeInstanceOf(BookDeliveryJobError);
		await expect(
			failAbandonedCheckoutAttemptInTransaction(
				txFor({ lockRows: [createdRow], orderUpdated: false }),
				input
			)
		).rejects.toBeInstanceOf(BookDeliveryJobError);
	});

	it.each([
		['completed', 'paid', 'pi_paid', 'ch_paid'],
		['expired', 'expired', null, null]
	])(
		'applies provider-proven %s evidence without changing fulfillment',
		async (kind, payment, pi, ch) => {
			const transaction = txFor();
			const evidence = {
				kind,
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				sessionId: SESSION_ID,
				paymentIntentId: pi,
				chargeId: ch,
				totalCents: 2500,
				refundedAmountCents: 0,
				receiptEmail: kind === 'completed' ? 'student@example.com' : null,
				expiresAt: EXPIRES_AT
			};
			await expect(
				reconcileProviderEvidenceInTransaction(transaction, { evidence, now: NOW })
			).resolves.toEqual({ disposition: 'applied', paymentStatus: payment });
			const compiled = transaction.execute.mock.calls.map(([query]) => compile(query));
			const orderUpdate = compiled.find(({ sql }) => sql.includes('UPDATE orders'));
			if (!orderUpdate) throw new Error('Expected order update');
			expect(orderUpdate.params).toContain(payment);
			expect(orderUpdate.sql).not.toContain('SET fulfillment_status');
			expect(compiled.some(({ sql }) => sql.includes('INSERT INTO audit_log'))).toBe(true);
		}
	);

	it('rejects mismatched provider evidence without mutating state', async () => {
		const transaction = txFor();
		await expect(
			reconcileProviderEvidenceInTransaction(transaction, {
				evidence: {
					kind: 'expired',
					orderId: ORDER_ID,
					attemptId: ATTEMPT_ID,
					sessionId: 'cs_test_other',
					paymentIntentId: null,
					chargeId: null,
					totalCents: 2500,
					refundedAmountCents: 0,
					receiptEmail: null,
					expiresAt: EXPIRES_AT
				},
				now: NOW
			})
		).resolves.toEqual({ disposition: 'rejected' });
		expect(transaction.execute).toHaveBeenCalledTimes(1);
	});

	it('accepts already-bound provider identifiers and a matching expiry receipt email', async () => {
		await expect(
			reconcileProviderEvidenceInTransaction(
				txFor({ lockRows: [persistedRow({ payment_intent_id: 'pi_bound' })] }),
				{
					evidence: providerEvidence({
						kind: 'completed',
						paymentIntentId: 'pi_bound',
						chargeId: 'ch_bound',
						receiptEmail: 'student@example.com'
					}),
					now: NOW
				}
			)
		).resolves.toEqual({ disposition: 'applied', paymentStatus: 'paid' });
		await expect(
			reconcileProviderEvidenceInTransaction(txFor(), {
				evidence: providerEvidence({ receiptEmail: 'student@example.com' }),
				now: NOW
			})
		).resolves.toEqual({ disposition: 'applied', paymentStatus: 'expired' });
	});

	it('never regresses an order that a concurrent webhook already paid', async () => {
		const transaction = txFor({
			lockRows: [
				persistedRow({
					attempt_status: 'completed',
					payment_status: 'paid',
					payment_intent_id: 'pi_paid',
					stripe_charge_id: 'ch_paid',
					terminal_at: NOW
				})
			]
		});
		await expect(
			reconcileProviderEvidenceInTransaction(transaction, {
				evidence: {
					kind: 'expired',
					orderId: ORDER_ID,
					attemptId: ATTEMPT_ID,
					sessionId: SESSION_ID,
					paymentIntentId: null,
					chargeId: null,
					totalCents: 2500,
					refundedAmountCents: 0,
					receiptEmail: null,
					expiresAt: EXPIRES_AT
				},
				now: NOW
			})
		).resolves.toEqual({ disposition: 'stale' });
		expect(transaction.execute).toHaveBeenCalledTimes(1);
	});

	it('fails closed when a compare-and-set or audit operation fails', async () => {
		await expect(
			reconcileProviderEvidenceInTransaction(txFor({ attemptUpdated: false }), {
				evidence: providerEvidence(),
				now: NOW
			})
		).rejects.toBeInstanceOf(BookDeliveryJobError);
		await expect(
			reconcileProviderEvidenceInTransaction(txFor({ orderUpdated: false }), {
				evidence: providerEvidence(),
				now: NOW
			})
		).rejects.toBeInstanceOf(BookDeliveryJobError);
	});

	it.each([
		['invalid transaction', null, {}, { evidence: {}, now: NOW }],
		['invalid evidence', null, txFor(), { evidence: {}, now: NOW }],
		['invalid clock', null, txFor(), { evidence: {}, now: new Date('invalid') }],
		['missing row', [], txFor({ lockRows: [] }), null],
		[
			'multiple rows',
			[persistedRow(), persistedRow()],
			txFor({ lockRows: [persistedRow(), persistedRow()] }),
			null
		]
	])('fails closed for %s', async (_label, _rows, transaction, explicitInput) => {
		const input = explicitInput ?? {
			evidence: {
				kind: 'expired',
				orderId: ORDER_ID,
				attemptId: ATTEMPT_ID,
				sessionId: SESSION_ID,
				paymentIntentId: null,
				chargeId: null,
				totalCents: 2500,
				refundedAmountCents: 0,
				receiptEmail: null,
				expiresAt: EXPIRES_AT
			},
			now: NOW
		};
		await expect(reconcileProviderEvidenceInTransaction(transaction, input)).rejects.toBeInstanceOf(
			BookDeliveryJobError
		);
	});
});

describe('Book Delivery retention', () => {
	it('purges only due terminal customer fields and invalidates confirmation capabilities', async () => {
		const transaction = txFor({
			purgeRows: [
				{
					order_id: ORDER_ID,
					payment_status: 'expired',
					fulfillment_status: 'unstarted',
					order_version: 3,
					pii_purge_after: new Date('2026-08-13T17:59:59.000Z'),
					pii_present: true,
					capability_active: true
				}
			]
		});
		await expect(
			purgeDueCustomerDataInTransaction(transaction, { now: NOW, limit: 10 })
		).resolves.toEqual({ purged: 1 });
		const compiled = transaction.execute.mock.calls.map(([query]) => compile(query));
		const update = compiled.find(({ sql }) => sql.includes('UPDATE orders'));
		if (!update) throw new Error('Expected PII update');
		expect(update.sql).toContain('confirmation_token_hash = NULL');
		expect(update.sql).toContain('confirmation_expires_at = NULL');
		const selector = compiled.find(({ sql }) => sql.includes('FROM orders'));
		if (!selector) throw new Error('Expected PII selector');
		expect(selector.sql).toContain(
			"customer_name <> '[removed]' OR customer_email <> 'removed@invalid.local'"
		);
		expect(selector.sql).toContain(
			'confirmation_token_hash IS NOT NULL OR confirmation_expires_at IS NOT NULL'
		);
		expect(compiled.some(({ sql }) => sql.includes('INSERT INTO audit_log'))).toBe(true);
		expect(JSON.stringify(compiled)).not.toContain('student@example.com');
	});

	it('purges a capability-only residual after customer fields were already anonymized', async () => {
		const transaction = txFor({
			purgeRows: [
				{
					order_id: ORDER_ID,
					payment_status: 'cancelled',
					fulfillment_status: 'unstarted',
					order_version: 4,
					pii_purge_after: new Date('2026-08-13T17:59:59.000Z'),
					pii_present: false,
					capability_active: true
				}
			]
		});

		await expect(
			purgeDueCustomerDataInTransaction(transaction, { now: NOW, limit: 10 })
		).resolves.toEqual({ purged: 1 });
		const compiled = transaction.execute.mock.calls.map(([query]) => compile(query));
		const selector = compiled.find(({ sql }) => sql.includes('FROM orders'));
		const update = compiled.find(({ sql }) => sql.includes('UPDATE orders'));
		if (!selector || !update) throw new Error('Expected retention selector and update');
		expect(selector.sql).toContain(
			'confirmation_token_hash IS NOT NULL OR confirmation_expires_at IS NOT NULL'
		);
		expect(update.sql).toContain(
			'confirmation_token_hash IS NOT NULL OR confirmation_expires_at IS NOT NULL'
		);
		const audit = compiled.find(({ sql }) => sql.includes('INSERT INTO audit_log'));
		if (!audit) throw new Error('Expected retention audit');
		const states = audit.params
			.filter((value) => typeof value === 'string' && value.startsWith('{'))
			.map((value) => JSON.parse(/** @type {string} */ (value)));
		expect(states[0]).toMatchObject({ piiPresent: false, capabilityActive: true });
		expect(states[1]).toMatchObject({ piiPresent: false, capabilityActive: false });
	});

	it('records an already inactive confirmation capability while completing a partial purge', async () => {
		const transaction = txFor({
			purgeRows: [
				{
					order_id: ORDER_ID,
					payment_status: 'expired',
					fulfillment_status: 'unstarted',
					order_version: 3,
					pii_purge_after: new Date('2026-08-13T17:59:59.000Z'),
					pii_present: true,
					capability_active: false
				}
			]
		});
		await expect(
			purgeDueCustomerDataInTransaction(transaction, { now: NOW, limit: 10 })
		).resolves.toEqual({ purged: 1 });
		const audits = transaction.execute.mock.calls
			.map(([query]) => compile(query))
			.filter(({ sql }) => sql.includes('INSERT INTO audit_log'));
		expect(audits).toHaveLength(1);
		const states = audits[0].params
			.filter((value) => typeof value === 'string' && value.startsWith('{'))
			.map((value) => JSON.parse(/** @type {string} */ (value)));
		expect(states[0]).toMatchObject({ piiPresent: true, capabilityActive: false });
		expect(states[1]).toMatchObject({ piiPresent: false, capabilityActive: false });
	});

	it('fails closed for malformed, future, oversized, or concurrently changed purge rows', async () => {
		const due = {
			order_id: ORDER_ID,
			payment_status: 'expired',
			fulfillment_status: 'unstarted',
			order_version: 3,
			pii_purge_after: new Date('2026-08-13T17:59:59.000Z'),
			pii_present: true,
			capability_active: true
		};
		for (const transaction of [
			txFor({ purgeRows: [{}] }),
			txFor({ purgeRows: [{ ...due, pii_present: 'yes' }] }),
			txFor({ purgeRows: [{ ...due, pii_present: false, capability_active: false }] }),
			txFor({ purgeRows: [{ ...due, pii_purge_after: new Date('2026-08-13T18:00:01.000Z') }] }),
			txFor({ purgeRows: [due], orderUpdated: false })
		]) {
			await expect(
				purgeDueCustomerDataInTransaction(transaction, { now: NOW, limit: 10 })
			).rejects.toBeInstanceOf(BookDeliveryJobError);
		}
		await expect(
			purgeDueCustomerDataInTransaction(txFor({ purgeRows: [due, due] }), {
				now: NOW,
				limit: 1
			})
		).rejects.toBeInstanceOf(BookDeliveryJobError);
	});

	it('cleans a bounded number of expired checkout, staff, and auth rate buckets', async () => {
		const transaction = txFor({ bucketRows: [{ bucket_key: 'one' }, { bucket_key: 'two' }] });
		await expect(
			cleanupExpiredRateBucketsInTransaction(transaction, { now: NOW, limit: 100 })
		).resolves.toEqual({ deleted: 2 });
		const compiled = compile(transaction.execute.mock.calls[0][0]);
		expect(compiled.sql).toContain('DELETE FROM rate_limit_buckets');
		expect(compiled.sql).not.toContain("scope <> 'auth_request'");
		expect(compiled.sql).toContain('LIMIT');
		expect(compiled.params).toContain(100);
	});

	it('rejects a rate-bucket delete result above the requested bound', async () => {
		await expect(
			cleanupExpiredRateBucketsInTransaction(
				txFor({ bucketRows: [{ bucket_key: 'one' }, { bucket_key: 'two' }] }),
				{ now: NOW, limit: 1 }
			)
		).rejects.toBeInstanceOf(BookDeliveryJobError);
	});

	it('returns zero work for empty due sets', async () => {
		await expect(purgeDueCustomerDataInTransaction(txFor(), { now: NOW })).resolves.toEqual({
			purged: 0
		});
		await expect(cleanupExpiredRateBucketsInTransaction(txFor(), { now: NOW })).resolves.toEqual({
			deleted: 0
		});
	});

	it.each([0, 101])('rejects unsafe maintenance batch %s', async (limit) => {
		await expect(
			purgeDueCustomerDataInTransaction(txFor(), { now: NOW, limit })
		).rejects.toBeInstanceOf(BookDeliveryJobError);
		await expect(
			cleanupExpiredRateBucketsInTransaction(txFor(), { now: NOW, limit })
		).rejects.toBeInstanceOf(BookDeliveryJobError);
	});
});

describe('scheduled Book Delivery job orchestration', () => {
	function options(overrides = {}) {
		return {
			databaseUrl: 'postgresql://runtime:password@db.example.com/books',
			stripe: {},
			stripeMode: 'test',
			now: NOW,
			runTransaction: vi.fn(async (operation) => operation({ execute: vi.fn() })),
			listCandidates: vi.fn(async () => []),
			failAbandoned: vi.fn(async () => ({ disposition: 'applied' })),
			retrieveEvidence: vi.fn(async () => providerEvidence()),
			reconcileEvidence: vi.fn(async () => ({ disposition: 'applied' })),
			purgeDue: vi.fn(async () => ({ purged: 0 })),
			cleanupBuckets: vi.fn(async () => ({ deleted: 0 })),
			...overrides
		};
	}

	it('keeps provider calls outside transactions and continues through a bounded batch', async () => {
		const created = candidate({ kind: 'created', sessionId: null, expiresAt: null });
		const ready = candidate();
		let inTransaction = false;
		const runTransaction = vi.fn(async (operation) => {
			inTransaction = true;
			try {
				return await operation({ execute: vi.fn() });
			} finally {
				inTransaction = false;
			}
		});
		const retrieveEvidence = vi.fn(async () => {
			expect(inTransaction).toBe(false);
			return { kind: 'expired' };
		});
		const report = await runBookDeliveryJob({
			databaseUrl: 'postgresql://runtime:password@db.example.com/books',
			stripe: {},
			stripeMode: 'test',
			now: NOW,
			runTransaction,
			listCandidates: vi.fn(async () => [created, ready]),
			failAbandoned: vi.fn(async () => ({ disposition: 'applied' })),
			retrieveEvidence,
			reconcileEvidence: vi.fn(async () => ({ disposition: 'applied', paymentStatus: 'expired' })),
			purgeDue: vi.fn(async () => ({ purged: 2 })),
			cleanupBuckets: vi.fn(async () => ({ deleted: 3 }))
		});
		expect(report).toEqual({
			candidates: 2,
			reconciled: 2,
			pending: 0,
			providerFailures: 0,
			purged: 2,
			bucketsDeleted: 3,
			retryRequired: false
		});
		expect(retrieveEvidence).toHaveBeenCalledTimes(1);
	});

	it('records retry need without skipping retention after a provider failure', async () => {
		const report = await runBookDeliveryJob({
			databaseUrl: 'postgresql://runtime:password@db.example.com/books',
			stripe: {},
			stripeMode: 'test',
			now: NOW,
			runTransaction: vi.fn(async (operation) => operation({ execute: vi.fn() })),
			listCandidates: vi.fn(async () => [candidate()]),
			failAbandoned: vi.fn(),
			retrieveEvidence: vi.fn(async () => {
				throw new Error('provider detail');
			}),
			reconcileEvidence: vi.fn(),
			purgeDue: vi.fn(async () => ({ purged: 1 })),
			cleanupBuckets: vi.fn(async () => ({ deleted: 1 }))
		});
		expect(report).toMatchObject({ providerFailures: 1, purged: 1, retryRequired: true });
	});

	it('counts a provider Session that remains open as pending', async () => {
		const report = await runBookDeliveryJob({
			databaseUrl: 'postgresql://runtime:password@db.example.com/books',
			stripe: {},
			stripeMode: 'test',
			now: NOW,
			runTransaction: vi.fn(async (operation) => operation({ execute: vi.fn() })),
			listCandidates: vi.fn(async () => [candidate()]),
			failAbandoned: vi.fn(),
			retrieveEvidence: vi.fn(async () => null),
			reconcileEvidence: vi.fn(),
			purgeDue: vi.fn(async () => ({ purged: 0 })),
			cleanupBuckets: vi.fn(async () => ({ deleted: 0 }))
		});
		expect(report).toMatchObject({ pending: 1, reconciled: 0, retryRequired: false });
	});

	it('rejects malformed or oversized candidate batches before reconciliation', async () => {
		for (const candidates of [null, Array.from({ length: 21 }, () => candidate())]) {
			await expect(
				runBookDeliveryJob(options({ listCandidates: vi.fn(async () => candidates) }))
			).rejects.toBeInstanceOf(BookDeliveryJobError);
		}
	});

	it('turns malformed per-candidate persistence results into retryable failures', async () => {
		for (const [candidateValue, override] of [
			[
				candidate({ kind: 'created', sessionId: null, expiresAt: null }),
				{ failAbandoned: vi.fn(async () => null) }
			],
			[candidate(), { reconcileEvidence: vi.fn(async () => null) }]
		]) {
			const report = await runBookDeliveryJob(
				options({ listCandidates: vi.fn(async () => [candidateValue]), ...override })
			);
			expect(report).toMatchObject({ providerFailures: 1, reconciled: 0, retryRequired: true });
		}
	});

	it('fails closed for malformed maintenance reports', async () => {
		for (const overrides of [
			{ purgeDue: vi.fn(async () => null) },
			{ cleanupBuckets: vi.fn(async () => ({ deleted: 101 })) }
		]) {
			await expect(runBookDeliveryJob(options(overrides))).rejects.toBeInstanceOf(
				BookDeliveryJobError
			);
		}
	});

	it.each([
		['missing options', undefined],
		['missing database URL', {}],
		['invalid clock', { databaseUrl: 'postgresql://x', now: new Date('invalid') }],
		['invalid transaction runner', { databaseUrl: 'postgresql://x', runTransaction: null }]
	])('fails closed for %s', async (_label, options) => {
		await expect(runBookDeliveryJob(options)).rejects.toBeInstanceOf(BookDeliveryJobError);
	});
});
