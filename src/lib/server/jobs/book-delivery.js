import { sql } from 'drizzle-orm';
import { withDatabaseTransaction } from '../db/transaction.js';
import { retrieveReconciliationEvidence } from './book-delivery-provider.js';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SESSION_ID_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9_]{1,240}$/u;
const PAYMENT_INTENT_PATTERN = /^pi_[A-Za-z0-9_]{1,240}$/u;
const CHARGE_PATTERN = /^ch_[A-Za-z0-9_]{1,240}$/u;
const PAYMENT_STATES = new Set([
	'pending',
	'paid',
	'partially_refunded',
	'refunded',
	'expired',
	'failed',
	'cancelled'
]);
const ATTEMPT_STATES = new Set(['created', 'ready', 'completed', 'expired', 'failed']);
const FULFILLMENT_STATES = new Set([
	'unstarted',
	'purchasing',
	'received',
	'ready_for_pickup',
	'picked_up'
]);
const RECONCILIATION_BATCH_LIMIT = 20;
const MAINTENANCE_BATCH_LIMIT = 100;
const ABANDONED_ATTEMPT_MS = 60 * 60 * 1000;
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export class BookDeliveryJobError extends Error {
	constructor() {
		super('Book Delivery scheduled work is unavailable');
		this.name = 'BookDeliveryJobError';
		this.code = 'BOOK_DELIVERY_JOB_UNAVAILABLE';
	}
}

/** @returns {never} */
function unavailable() {
	throw new BookDeliveryJobError();
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {unknown} value */
function txValue(value) {
	if (!isObject(value) || typeof value.execute !== 'function') unavailable();
	return /** @type {{ execute: (query: unknown) => Promise<unknown> }} */ (value);
}

/** @param {unknown} value @returns {any[]} */
function rows(value) {
	if (!isObject(value) || !Array.isArray(value.rows)) unavailable();
	return value.rows;
}

/** @param {unknown} value */
function dateValue(value) {
	if (!(value instanceof Date || typeof value === 'string')) unavailable();
	const date = new Date(value);
	if (!Number.isFinite(date.getTime())) unavailable();
	return date;
}

/** @param {unknown} value */
function nullableDate(value) {
	return value === null ? null : dateValue(value);
}

/** @param {unknown} value */
function clock(value) {
	if (!(value instanceof Date) || !Number.isFinite(value.getTime())) unavailable();
	return value;
}

/** @param {unknown} value @param {number} maximum */
function batchLimit(value, maximum) {
	if (
		!Number.isSafeInteger(value) ||
		/** @type {number} */ (value) < 1 ||
		/** @type {number} */ (value) > maximum
	) {
		unavailable();
	}
	return /** @type {number} */ (value);
}

/** @param {unknown} value */
function email(value) {
	if (
		typeof value !== 'string' ||
		value.length < 3 ||
		value.length > 320 ||
		value !== value.trim() ||
		!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value)
	) {
		unavailable();
	}
	return value;
}

/** @param {unknown} row @returns {Record<string, any>} */
function persistedRow(row) {
	if (
		!isObject(row) ||
		!UUID_V4_PATTERN.test(row.attempt_id) ||
		!UUID_V4_PATTERN.test(row.attempt_order_id) ||
		!UUID_V4_PATTERN.test(row.order_id) ||
		row.attempt_order_id !== row.order_id ||
		!ATTEMPT_STATES.has(row.attempt_status) ||
		!PAYMENT_STATES.has(row.payment_status) ||
		!FULFILLMENT_STATES.has(row.fulfillment_status) ||
		!Number.isSafeInteger(row.attempt_version) ||
		row.attempt_version < 1 ||
		!Number.isSafeInteger(row.order_version) ||
		row.order_version < 1 ||
		!Number.isSafeInteger(row.total_cents) ||
		row.total_cents < 1 ||
		!Number.isSafeInteger(row.refunded_amount_cents) ||
		row.refunded_amount_cents < 0 ||
		row.currency !== 'cad'
	) {
		unavailable();
	}
	return {
		...row,
		customer_email: email(row.customer_email),
		stripe_expires_at: nullableDate(row.stripe_expires_at),
		checkout_ready_at: nullableDate(row.checkout_ready_at),
		terminal_at: nullableDate(row.terminal_at),
		attempt_created_at: dateValue(row.attempt_created_at),
		pii_purge_after: nullableDate(row.pii_purge_after)
	};
}

/** @param {unknown} row */
function candidateDto(row) {
	const stored = persistedRow(row);
	if (
		!['created', 'ready'].includes(stored.attempt_status) ||
		stored.payment_status !== 'pending' ||
		stored.fulfillment_status !== 'unstarted' ||
		!['created', 'ready'].includes(stored.candidate_kind) ||
		stored.candidate_kind !== stored.attempt_status ||
		(stored.attempt_status === 'created' &&
			(stored.stripe_session_id !== null || stored.stripe_expires_at !== null)) ||
		(stored.attempt_status === 'ready' &&
			(!SESSION_ID_PATTERN.test(stored.stripe_session_id) || stored.stripe_expires_at === null))
	) {
		unavailable();
	}
	return Object.freeze({
		kind: stored.attempt_status,
		orderId: stored.order_id,
		attemptId: stored.attempt_id,
		sessionId: stored.stripe_session_id,
		paymentIntentId: stored.payment_intent_id,
		customerEmail: stored.customer_email,
		totalCents: stored.total_cents,
		expiresAt: stored.stripe_expires_at,
		createdAt: stored.attempt_created_at
	});
}

/**
 * @param {unknown} rawTransaction
 * @param {{ now?: Date, limit?: number }} [options]
 */
export async function listReconciliationCandidatesInTransaction(
	rawTransaction,
	{ now = new Date(), limit = RECONCILIATION_BATCH_LIMIT } = {}
) {
	const tx = txValue(rawTransaction);
	clock(now);
	const boundedLimit = batchLimit(limit, RECONCILIATION_BATCH_LIMIT);
	const abandonedBefore = new Date(now.getTime() - ABANDONED_ATTEMPT_MS);
	const result = rows(
		await tx.execute(sql`SELECT
			ca.id AS attempt_id, ca.order_id AS attempt_order_id, ca.stripe_session_id,
			ca.payment_intent_id, ca.stripe_charge_id, ca.stripe_expires_at,
			ca.checkout_ready_at, ca.terminal_at, ca.status AS attempt_status,
			ca.version AS attempt_version, ca.created_at AS attempt_created_at,
			o.id AS order_id, o.customer_email, o.currency, o.payment_status,
			o.fulfillment_status, o.refunded_amount_cents, o.total_cents,
			o.version AS order_version, o.pii_purge_after,
			ca.status AS candidate_kind
		FROM checkout_attempts ca
		JOIN orders o ON o.id = ca.order_id
		WHERE o.payment_status = 'pending' AND o.fulfillment_status = 'unstarted'
			AND ((ca.status = 'created' AND ca.stripe_session_id IS NULL
				AND ca.created_at <= ${abandonedBefore})
				OR (ca.status = 'ready' AND ca.stripe_session_id IS NOT NULL
					AND ca.stripe_expires_at <= ${now}))
		ORDER BY ca.created_at, ca.id
		LIMIT ${boundedLimit}`)
	);
	if (result.length > boundedLimit) unavailable();
	return Object.freeze(result.map(candidateDto));
}

/** @param {unknown} value @returns {Record<string, any>} */
function candidateValue(value) {
	if (
		!isObject(value) ||
		!['created', 'ready'].includes(value.kind) ||
		!UUID_V4_PATTERN.test(value.orderId) ||
		!UUID_V4_PATTERN.test(value.attemptId) ||
		!(value.sessionId === null || SESSION_ID_PATTERN.test(value.sessionId)) ||
		!(value.expiresAt === null || value.expiresAt instanceof Date) ||
		!(value.createdAt instanceof Date)
	) {
		unavailable();
	}
	return value;
}

/** @param {unknown} rawTransaction @param {{ candidate: unknown, now?: Date }} input */
export async function failAbandonedCheckoutAttemptInTransaction(
	rawTransaction,
	{ candidate: rawCandidate, now = new Date() }
) {
	const tx = txValue(rawTransaction);
	const candidate = candidateValue(rawCandidate);
	clock(now);
	const result = rows(
		await tx.execute(sql`SELECT
			ca.id AS attempt_id, ca.order_id AS attempt_order_id, ca.stripe_session_id,
			ca.payment_intent_id, ca.stripe_charge_id, ca.stripe_expires_at,
			ca.checkout_ready_at, ca.terminal_at, ca.status AS attempt_status,
			ca.version AS attempt_version, ca.created_at AS attempt_created_at,
			o.id AS order_id, o.customer_email, o.currency, o.payment_status,
			o.fulfillment_status, o.refunded_amount_cents, o.total_cents,
			o.version AS order_version, o.pii_purge_after
		FROM checkout_attempts ca JOIN orders o ON o.id = ca.order_id
		WHERE ca.id = ${candidate.attemptId} AND ca.order_id = ${candidate.orderId}
		FOR UPDATE OF ca, o`)
	);
	if (result.length !== 1) unavailable();
	const row = persistedRow(result[0]);
	if (row.attempt_status !== 'created' || row.payment_status !== 'pending') {
		return Object.freeze({ disposition: 'stale' });
	}
	if (
		candidate.kind !== 'created' ||
		candidate.sessionId !== null ||
		row.stripe_session_id !== null ||
		row.payment_intent_id !== null ||
		row.stripe_charge_id !== null ||
		row.stripe_expires_at !== null ||
		row.checkout_ready_at !== null ||
		row.terminal_at !== null ||
		row.fulfillment_status !== 'unstarted' ||
		row.attempt_created_at.getTime() > now.getTime() - ABANDONED_ATTEMPT_MS
	) {
		return Object.freeze({ disposition: 'rejected' });
	}
	const attemptUpdate = rows(
		await tx.execute(sql`UPDATE checkout_attempts
		SET status = 'failed', terminal_at = ${now}, version = version + 1, updated_at = ${now}
		WHERE id = ${row.attempt_id} AND order_id = ${row.order_id}
			AND status = 'created' AND version = ${row.attempt_version}
			AND stripe_session_id IS NULL AND payment_intent_id IS NULL
		RETURNING id AS attempt_id`)
	);
	if (attemptUpdate.length !== 1 || attemptUpdate[0]?.attempt_id !== row.attempt_id) unavailable();
	const purgeAfter = new Date(now.getTime() + RETENTION_MS);
	const orderUpdate = rows(
		await tx.execute(sql`UPDATE orders
		SET payment_status = 'failed', pii_purge_after = ${purgeAfter},
			version = version + 1, updated_at = ${now}
		WHERE id = ${row.order_id} AND payment_status = 'pending'
			AND fulfillment_status = 'unstarted' AND version = ${row.order_version}
		RETURNING id AS order_id`)
	);
	if (orderUpdate.length !== 1 || orderUpdate[0]?.order_id !== row.order_id) unavailable();
	const previousState = JSON.stringify({
		paymentStatus: 'pending',
		fulfillmentStatus: 'unstarted',
		attemptStatus: 'created'
	});
	const nextState = JSON.stringify({
		paymentStatus: 'failed',
		fulfillmentStatus: 'unstarted',
		attemptStatus: 'failed',
		disposition: 'applied'
	});
	await tx.execute(sql`INSERT INTO audit_log
		(order_id, resource_type, resource_id, actor_kind, action, previous_state,
		 next_state, created_at)
	VALUES (${row.order_id}, 'order', ${row.order_id}, 'system',
		'reconciliation_abandoned_failed', ${previousState}::jsonb, ${nextState}::jsonb, ${now})`);
	return Object.freeze({ disposition: 'applied' });
}

/** @param {unknown} value @returns {Record<string, any>} */
function evidenceValue(value) {
	if (
		!isObject(value) ||
		!['completed', 'expired'].includes(value.kind) ||
		!UUID_V4_PATTERN.test(value.orderId) ||
		!UUID_V4_PATTERN.test(value.attemptId) ||
		!SESSION_ID_PATTERN.test(value.sessionId) ||
		!(value.paymentIntentId === null || PAYMENT_INTENT_PATTERN.test(value.paymentIntentId)) ||
		!(value.chargeId === null || CHARGE_PATTERN.test(value.chargeId)) ||
		!Number.isSafeInteger(value.totalCents) ||
		value.totalCents < 1 ||
		value.refundedAmountCents !== 0 ||
		!(value.expiresAt instanceof Date) ||
		!Number.isFinite(value.expiresAt.getTime()) ||
		!(value.receiptEmail === null || typeof value.receiptEmail === 'string')
	) {
		unavailable();
	}
	return value;
}

/** @param {unknown} rawTransaction @param {{ evidence: unknown, now?: Date }} input */
export async function reconcileProviderEvidenceInTransaction(
	rawTransaction,
	{ evidence: rawEvidence, now = new Date() }
) {
	const tx = txValue(rawTransaction);
	const evidence = evidenceValue(rawEvidence);
	clock(now);
	const result = rows(
		await tx.execute(sql`SELECT
			ca.id AS attempt_id, ca.order_id AS attempt_order_id, ca.stripe_session_id,
			ca.payment_intent_id, ca.stripe_charge_id, ca.stripe_expires_at,
			ca.checkout_ready_at, ca.terminal_at, ca.status AS attempt_status,
			ca.version AS attempt_version, ca.created_at AS attempt_created_at,
			o.id AS order_id, o.customer_email, o.currency, o.payment_status,
			o.fulfillment_status, o.refunded_amount_cents, o.total_cents,
			o.version AS order_version, o.pii_purge_after
		FROM checkout_attempts ca JOIN orders o ON o.id = ca.order_id
		WHERE ca.id = ${evidence.attemptId} AND ca.order_id = ${evidence.orderId}
		FOR UPDATE OF ca, o`)
	);
	if (result.length !== 1) unavailable();
	const row = persistedRow(result[0]);
	if (row.payment_status !== 'pending' || row.attempt_status !== 'ready') {
		return Object.freeze({ disposition: 'stale' });
	}
	const matches =
		row.order_id === evidence.orderId &&
		row.attempt_id === evidence.attemptId &&
		row.stripe_session_id === evidence.sessionId &&
		row.total_cents === evidence.totalCents &&
		row.stripe_expires_at?.getTime() === evidence.expiresAt.getTime() &&
		(row.payment_intent_id === null || row.payment_intent_id === evidence.paymentIntentId) &&
		(evidence.kind === 'expired'
			? evidence.chargeId === null &&
				(evidence.receiptEmail === null || evidence.receiptEmail === row.customer_email)
			: PAYMENT_INTENT_PATTERN.test(evidence.paymentIntentId) &&
				CHARGE_PATTERN.test(evidence.chargeId) &&
				evidence.receiptEmail === row.customer_email);
	if (!matches) return Object.freeze({ disposition: 'rejected' });
	const nextPaymentStatus = evidence.kind === 'completed' ? 'paid' : 'expired';
	const nextAttemptStatus = evidence.kind === 'completed' ? 'completed' : 'expired';
	const attemptUpdate = rows(
		await tx.execute(sql`UPDATE checkout_attempts
		SET payment_intent_id = ${evidence.paymentIntentId},
			stripe_charge_id = ${evidence.chargeId}, status = ${nextAttemptStatus},
			terminal_at = ${now}, version = version + 1, updated_at = ${now}
		WHERE id = ${row.attempt_id} AND status = 'ready' AND version = ${row.attempt_version}
		RETURNING id AS attempt_id`)
	);
	if (attemptUpdate.length !== 1 || attemptUpdate[0]?.attempt_id !== row.attempt_id) unavailable();
	const purgeAfter = evidence.kind === 'expired' ? new Date(now.getTime() + RETENTION_MS) : null;
	const orderUpdate = rows(
		await tx.execute(sql`UPDATE orders
		SET payment_status = ${nextPaymentStatus}, pii_purge_after = ${purgeAfter},
			version = version + 1, updated_at = ${now}
		WHERE id = ${row.order_id} AND payment_status = 'pending'
			AND fulfillment_status = 'unstarted' AND version = ${row.order_version}
		RETURNING id AS order_id`)
	);
	if (orderUpdate.length !== 1 || orderUpdate[0]?.order_id !== row.order_id) unavailable();
	const previousState = JSON.stringify({
		paymentStatus: row.payment_status,
		fulfillmentStatus: row.fulfillment_status,
		attemptStatus: row.attempt_status
	});
	const nextState = JSON.stringify({
		paymentStatus: nextPaymentStatus,
		fulfillmentStatus: row.fulfillment_status,
		attemptStatus: nextAttemptStatus,
		disposition: 'applied'
	});
	await tx.execute(sql`INSERT INTO audit_log
		(order_id, resource_type, resource_id, actor_kind, action, previous_state,
		 next_state, created_at)
	VALUES (${row.order_id}, 'order', ${row.order_id}, 'system',
		${`reconciliation_${evidence.kind}_applied`}, ${previousState}::jsonb,
		${nextState}::jsonb, ${now})`);
	return Object.freeze({ disposition: 'applied', paymentStatus: nextPaymentStatus });
}

/** @param {unknown} rawTransaction @param {{ now?: Date, limit?: number }} [options] */
export async function purgeDueCustomerDataInTransaction(
	rawTransaction,
	{ now = new Date(), limit = MAINTENANCE_BATCH_LIMIT } = {}
) {
	const tx = txValue(rawTransaction);
	clock(now);
	const boundedLimit = batchLimit(limit, MAINTENANCE_BATCH_LIMIT);
	const dueRows = rows(
		await tx.execute(sql`SELECT id AS order_id, payment_status, fulfillment_status,
			version AS order_version, pii_purge_after,
			(customer_name <> '[removed]' OR customer_email <> 'removed@invalid.local') AS pii_present,
			(confirmation_token_hash IS NOT NULL OR confirmation_expires_at IS NOT NULL) AS capability_active
		FROM orders
		WHERE pii_purge_after IS NOT NULL AND pii_purge_after <= ${now}
			AND (customer_name <> '[removed]' OR customer_email <> 'removed@invalid.local'
				OR confirmation_token_hash IS NOT NULL OR confirmation_expires_at IS NOT NULL)
			AND (payment_status IN ('expired', 'failed', 'cancelled', 'refunded')
				OR fulfillment_status = 'picked_up')
		ORDER BY pii_purge_after, id
		LIMIT ${boundedLimit}
		FOR UPDATE SKIP LOCKED`)
	);
	if (dueRows.length > boundedLimit) unavailable();
	let purged = 0;
	for (const rawRow of dueRows) {
		if (
			!isObject(rawRow) ||
			!UUID_V4_PATTERN.test(rawRow.order_id) ||
			!PAYMENT_STATES.has(rawRow.payment_status) ||
			!FULFILLMENT_STATES.has(rawRow.fulfillment_status) ||
			!Number.isSafeInteger(rawRow.order_version) ||
			rawRow.order_version < 1 ||
			typeof rawRow.pii_present !== 'boolean' ||
			typeof rawRow.capability_active !== 'boolean' ||
			(!rawRow.pii_present && !rawRow.capability_active) ||
			dateValue(rawRow.pii_purge_after).getTime() > now.getTime()
		) {
			unavailable();
		}
		const updated = rows(
			await tx.execute(sql`UPDATE orders
			SET customer_name = '[removed]', customer_email = 'removed@invalid.local',
				confirmation_token_hash = NULL, confirmation_expires_at = NULL,
				version = version + 1, updated_at = ${now}
			WHERE id = ${rawRow.order_id} AND version = ${rawRow.order_version}
				AND pii_purge_after IS NOT NULL AND pii_purge_after <= ${now}
				AND (customer_name <> '[removed]' OR customer_email <> 'removed@invalid.local'
					OR confirmation_token_hash IS NOT NULL OR confirmation_expires_at IS NOT NULL)
				AND (payment_status IN ('expired', 'failed', 'cancelled', 'refunded')
					OR fulfillment_status = 'picked_up')
			RETURNING id AS order_id`)
		);
		if (updated.length !== 1 || updated[0]?.order_id !== rawRow.order_id) unavailable();
		const previousState = JSON.stringify({
			paymentStatus: rawRow.payment_status,
			fulfillmentStatus: rawRow.fulfillment_status,
			piiPresent: rawRow.pii_present,
			capabilityActive: rawRow.capability_active
		});
		const nextState = JSON.stringify({
			paymentStatus: rawRow.payment_status,
			fulfillmentStatus: rawRow.fulfillment_status,
			piiPresent: false,
			capabilityActive: false
		});
		await tx.execute(sql`INSERT INTO audit_log
			(order_id, resource_type, resource_id, actor_kind, action, previous_state,
			 next_state, created_at)
		VALUES (${rawRow.order_id}, 'order', ${rawRow.order_id}, 'maintenance',
			'customer_data_anonymized', ${previousState}::jsonb, ${nextState}::jsonb, ${now})`);
		purged += 1;
	}
	return Object.freeze({ purged });
}

/** @param {unknown} rawTransaction @param {{ now?: Date, limit?: number }} [options] */
export async function cleanupExpiredRateBucketsInTransaction(
	rawTransaction,
	{ now = new Date(), limit = MAINTENANCE_BATCH_LIMIT } = {}
) {
	const tx = txValue(rawTransaction);
	clock(now);
	const boundedLimit = batchLimit(limit, MAINTENANCE_BATCH_LIMIT);
	const deleted = rows(
		await tx.execute(sql`DELETE FROM rate_limit_buckets
		WHERE bucket_key IN (
			SELECT bucket_key FROM rate_limit_buckets
			WHERE expires_at <= ${now}
			ORDER BY expires_at, bucket_key
			LIMIT ${boundedLimit}
			FOR UPDATE SKIP LOCKED
		)
		RETURNING bucket_key`)
	);
	if (deleted.length > boundedLimit) unavailable();
	return Object.freeze({ deleted: deleted.length });
}

/**
 * @param {Record<string, any> | null | undefined} options
 */
export async function runBookDeliveryJob(options) {
	const {
		databaseUrl,
		stripe,
		stripeMode,
		now = new Date(),
		runTransaction = withDatabaseTransaction,
		listCandidates = listReconciliationCandidatesInTransaction,
		failAbandoned = failAbandonedCheckoutAttemptInTransaction,
		retrieveEvidence = retrieveReconciliationEvidence,
		reconcileEvidence = reconcileProviderEvidenceInTransaction,
		purgeDue = purgeDueCustomerDataInTransaction,
		cleanupBuckets = cleanupExpiredRateBucketsInTransaction
	} = options ?? {};
	if (
		typeof databaseUrl !== 'string' ||
		databaseUrl.length === 0 ||
		typeof runTransaction !== 'function'
	) {
		unavailable();
	}
	clock(now);
	const candidates = await runTransaction(
		/** @param {any} transaction */
		(transaction) => listCandidates(transaction, { now, limit: RECONCILIATION_BATCH_LIMIT }),
		{ databaseUrl }
	);
	if (!Array.isArray(candidates) || candidates.length > RECONCILIATION_BATCH_LIMIT) unavailable();
	let reconciled = 0;
	let pending = 0;
	let providerFailures = 0;
	for (const rawCandidate of candidates) {
		const candidate = candidateValue(rawCandidate);
		try {
			if (candidate.kind === 'created') {
				const result = await runTransaction(
					/** @param {any} transaction */
					(transaction) => failAbandoned(transaction, { candidate, now }),
					{ databaseUrl }
				);
				if (!isObject(result) || !['applied', 'stale', 'rejected'].includes(result.disposition)) {
					unavailable();
				}
				if (result.disposition === 'applied') reconciled += 1;
				continue;
			}
			const evidence = await retrieveEvidence(stripe, candidate, { stripeMode });
			if (evidence === null) {
				pending += 1;
				continue;
			}
			const result = await runTransaction(
				/** @param {any} transaction */
				(transaction) => reconcileEvidence(transaction, { evidence, now }),
				{ databaseUrl }
			);
			if (!isObject(result) || !['applied', 'stale', 'rejected'].includes(result.disposition)) {
				unavailable();
			}
			if (result.disposition === 'applied') reconciled += 1;
		} catch {
			providerFailures += 1;
		}
	}
	const retention = await runTransaction(
		/** @param {any} transaction */
		(transaction) => purgeDue(transaction, { now, limit: MAINTENANCE_BATCH_LIMIT }),
		{ databaseUrl }
	);
	const cleanup = await runTransaction(
		/** @param {any} transaction */
		(transaction) => cleanupBuckets(transaction, { now, limit: MAINTENANCE_BATCH_LIMIT }),
		{ databaseUrl }
	);
	if (
		!isObject(retention) ||
		!Number.isSafeInteger(retention.purged) ||
		retention.purged < 0 ||
		retention.purged > MAINTENANCE_BATCH_LIMIT ||
		!isObject(cleanup) ||
		!Number.isSafeInteger(cleanup.deleted) ||
		cleanup.deleted < 0 ||
		cleanup.deleted > MAINTENANCE_BATCH_LIMIT
	) {
		unavailable();
	}
	return Object.freeze({
		candidates: candidates.length,
		reconciled,
		pending,
		providerFailures,
		purged: retention.purged,
		bucketsDeleted: cleanup.deleted,
		retryRequired: providerFailures > 0
	});
}
