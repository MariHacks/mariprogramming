import { sql } from 'drizzle-orm';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const EVENT_ID_PATTERN = /^evt_[A-Za-z0-9_]{1,251}$/u;
const EVENT_TYPE_PATTERN = /^[a-z0-9_.]{1,64}$/u;
const SESSION_ID_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9_]{1,240}$/u;
const PAYMENT_INTENT_ID_PATTERN = /^pi_[A-Za-z0-9_]{1,240}$/u;
const CHARGE_ID_PATTERN = /^ch_[A-Za-z0-9_]{1,240}$/u;
const PAYMENT_STATES = new Set([
	'pending',
	'paid',
	'partially_refunded',
	'refunded',
	'expired',
	'failed',
	'cancelled'
]);
const FULFILLMENT_STATES = new Set([
	'unstarted',
	'purchasing',
	'received',
	'ready_for_pickup',
	'picked_up'
]);
const ATTEMPT_STATES = new Set(['created', 'ready', 'completed', 'expired', 'failed']);
const EVENT_DISPOSITIONS = new Set([
	'applied',
	'duplicate',
	'stale',
	'ignored_unsupported_type',
	'rejected'
]);
const HANDLED_KIND_BY_TYPE = Object.freeze({
	'checkout.session.completed': 'completed',
	'checkout.session.expired': 'expired',
	'charge.refunded': 'refunded'
});
const TERMINAL_PII_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export class StripeWebhookPersistenceError extends Error {
	constructor() {
		super('Stripe webhook persistence is unavailable');
		this.name = 'StripeWebhookPersistenceError';
		this.code = 'STRIPE_WEBHOOK_PERSISTENCE_UNAVAILABLE';
	}
}

/** @returns {never} */
function unavailable() {
	throw new StripeWebhookPersistenceError();
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {unknown} value @param {RegExp} pattern */
function matchesId(value, pattern) {
	return typeof value === 'string' && value.length <= 255 && pattern.test(value);
}

/** @param {unknown} value */
function validEmail(value) {
	return (
		typeof value === 'string' &&
		value.length > 0 &&
		value.length <= 320 &&
		value === value.trim() &&
		!/[\p{Cc}\s]/u.test(value)
	);
}

/** @param {unknown} value */
function validCents(value) {
	return Number.isSafeInteger(value) && /** @type {number} */ (value) >= 0;
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
function rows(value) {
	if (!isObject(value) || !Array.isArray(value.rows)) unavailable();
	return value.rows;
}

/** @param {unknown} value */
function transaction(value) {
	if (!isObject(value) || typeof value.execute !== 'function') unavailable();
	return /** @type {{ execute: (query: unknown) => Promise<unknown> }} */ (value);
}

/** @param {unknown} value */
function clock(value) {
	if (!(value instanceof Date) || !Number.isFinite(value.getTime())) unavailable();
	return value;
}

/** @param {unknown} value */
function descriptorValue(value) {
	if (
		!isObject(value) ||
		!matchesId(value.id, EVENT_ID_PATTERN) ||
		typeof value.type !== 'string' ||
		!EVENT_TYPE_PATTERN.test(value.type) ||
		!['test', 'live'].includes(/** @type {string} */ (value.mode)) ||
		typeof value.environmentMatches !== 'boolean'
	) {
		unavailable();
	}
	const expectedKind = /** @type {string} */ (
		HANDLED_KIND_BY_TYPE[/** @type {keyof typeof HANDLED_KIND_BY_TYPE} */ (value.type)] ??
			'unsupported'
	);
	if (value.kind !== expectedKind) unavailable();
	if (expectedKind === 'unsupported') {
		if (value.objectId !== null) unavailable();
	} else {
		const pattern = expectedKind === 'refunded' ? CHARGE_ID_PATTERN : SESSION_ID_PATTERN;
		if (!matchesId(value.objectId, pattern)) unavailable();
	}
	return /** @type {any} */ (value);
}

/** @param {unknown} value @param {string} expectedKind */
function evidenceValue(value, expectedKind) {
	if (
		!isObject(value) ||
		value.kind !== expectedKind ||
		!matchesId(value.orderId, UUID_V4_PATTERN) ||
		!matchesId(value.attemptId, UUID_V4_PATTERN) ||
		!matchesId(value.sessionId, SESSION_ID_PATTERN) ||
		!validCents(value.totalCents) ||
		value.totalCents < 1 ||
		!validCents(value.refundedAmountCents) ||
		!(value.expiresAt instanceof Date) ||
		!Number.isFinite(value.expiresAt.getTime())
	) {
		unavailable();
	}
	if (expectedKind === 'expired') {
		if (
			!(
				value.paymentIntentId === null ||
				matchesId(value.paymentIntentId, PAYMENT_INTENT_ID_PATTERN)
			) ||
			value.chargeId !== null ||
			value.refundedAmountCents !== 0 ||
			!(value.receiptEmail === null || validEmail(value.receiptEmail))
		) {
			unavailable();
		}
	} else if (
		!matchesId(value.paymentIntentId, PAYMENT_INTENT_ID_PATTERN) ||
		!matchesId(value.chargeId, CHARGE_ID_PATTERN) ||
		!validEmail(value.receiptEmail) ||
		(expectedKind === 'completed' && value.refundedAmountCents !== 0) ||
		(expectedKind === 'refunded' && value.refundedAmountCents < 1)
	) {
		unavailable();
	}
	return /** @type {any} */ (value);
}

/** @param {any} row */
function persistedRow(row) {
	if (
		!isObject(row) ||
		!matchesId(row.attempt_id, UUID_V4_PATTERN) ||
		!matchesId(row.attempt_order_id, UUID_V4_PATTERN) ||
		!matchesId(row.order_id, UUID_V4_PATTERN) ||
		row.attempt_order_id !== row.order_id ||
		!PAYMENT_STATES.has(row.payment_status) ||
		!FULFILLMENT_STATES.has(row.fulfillment_status) ||
		!ATTEMPT_STATES.has(row.attempt_status) ||
		row.currency !== 'cad' ||
		!validEmail(row.customer_email) ||
		!Number.isSafeInteger(row.order_version) ||
		row.order_version < 1 ||
		!Number.isSafeInteger(row.attempt_version) ||
		row.attempt_version < 1 ||
		!validCents(row.total_cents) ||
		row.total_cents < 1 ||
		!validCents(row.refunded_amount_cents) ||
		row.refunded_amount_cents > row.total_cents ||
		!(row.stripe_session_id === null || matchesId(row.stripe_session_id, SESSION_ID_PATTERN)) ||
		!(
			row.payment_intent_id === null || matchesId(row.payment_intent_id, PAYMENT_INTENT_ID_PATTERN)
		) ||
		!(row.stripe_charge_id === null || matchesId(row.stripe_charge_id, CHARGE_ID_PATTERN))
	) {
		unavailable();
	}
	const stripeExpiresAt = nullableDate(row.stripe_expires_at);
	const checkoutReadyAt = nullableDate(row.checkout_ready_at);
	const terminalAt = nullableDate(row.terminal_at);
	const piiPurgeAfter = nullableDate(row.pii_purge_after);
	const noRefund = ['pending', 'paid', 'expired', 'failed', 'cancelled'].includes(
		row.payment_status
	);
	if (
		(noRefund && row.refunded_amount_cents !== 0) ||
		(row.payment_status === 'partially_refunded' &&
			(row.refunded_amount_cents < 1 || row.refunded_amount_cents >= row.total_cents)) ||
		(row.payment_status === 'refunded' && row.refunded_amount_cents !== row.total_cents)
	) {
		unavailable();
	}
	const noProviderState =
		row.stripe_session_id === null &&
		row.payment_intent_id === null &&
		row.stripe_charge_id === null &&
		stripeExpiresAt === null &&
		checkoutReadyAt === null;
	if (
		(row.attempt_status === 'created' && (!noProviderState || terminalAt !== null)) ||
		(row.attempt_status === 'ready' &&
			(row.stripe_session_id === null ||
				row.stripe_charge_id !== null ||
				stripeExpiresAt === null ||
				checkoutReadyAt === null ||
				terminalAt !== null)) ||
		(row.attempt_status === 'completed' &&
			(row.stripe_session_id === null ||
				row.payment_intent_id === null ||
				row.stripe_charge_id === null ||
				stripeExpiresAt === null ||
				checkoutReadyAt === null ||
				terminalAt === null)) ||
		(row.attempt_status === 'expired' &&
			(row.stripe_session_id === null ||
				row.stripe_charge_id !== null ||
				stripeExpiresAt === null ||
				checkoutReadyAt === null ||
				terminalAt === null)) ||
		(row.attempt_status === 'failed' && (!noProviderState || terminalAt === null))
	) {
		unavailable();
	}
	return /** @type {any} */ ({
		...row,
		stripeExpiresAt,
		checkoutReadyAt,
		terminalAt,
		piiPurgeAfter
	});
}

/**
 * Loads only the Session identifier needed to complete refund evidence retrieval. The caller lets
 * this read transaction close before making the Session API call, then the final reducer locks and
 * rechecks the same attempt and order.
 *
 * @param {unknown} rawTransaction
 * @param {{ orderId: unknown, attemptId: unknown, paymentIntentId: unknown, chargeId: unknown }} input
 */
export async function loadRefundTargetInTransaction(rawTransaction, input) {
	const tx = transaction(rawTransaction);
	if (
		!isObject(input) ||
		!matchesId(input.orderId, UUID_V4_PATTERN) ||
		!matchesId(input.attemptId, UUID_V4_PATTERN) ||
		!matchesId(input.paymentIntentId, PAYMENT_INTENT_ID_PATTERN) ||
		!matchesId(input.chargeId, CHARGE_ID_PATTERN)
	) {
		unavailable();
	}
	const resultRows = rows(
		await tx.execute(sql`SELECT
			ca.id AS attempt_id, ca.order_id AS attempt_order_id, ca.stripe_session_id,
			ca.payment_intent_id, ca.stripe_charge_id, ca.stripe_expires_at,
			ca.checkout_ready_at, ca.terminal_at, ca.status AS attempt_status,
			ca.version AS attempt_version,
			o.id AS order_id, o.customer_email, o.currency, o.payment_status,
			o.fulfillment_status, o.refunded_amount_cents, o.total_cents,
			o.version AS order_version, o.pii_purge_after
		FROM checkout_attempts ca
		JOIN orders o ON o.id = ca.order_id
		WHERE ca.id = ${input.attemptId} AND ca.order_id = ${input.orderId}`)
	);
	if (resultRows.length === 0) return null;
	if (resultRows.length !== 1) unavailable();
	const row = persistedRow(resultRows[0]);
	if (
		row.attempt_id !== input.attemptId ||
		row.order_id !== input.orderId ||
		row.stripe_session_id === null
	) {
		unavailable();
	}
	if (
		!(row.payment_intent_id === null || row.payment_intent_id === input.paymentIntentId) ||
		!(row.stripe_charge_id === null || row.stripe_charge_id === input.chargeId)
	) {
		return null;
	}
	return Object.freeze({ sessionId: row.stripe_session_id });
}

/** @param {any} row @param {any} evidence @param {string} kind */
function evidenceMatchesRow(row, evidence, kind) {
	const base =
		row.order_id === evidence.orderId &&
		row.attempt_id === evidence.attemptId &&
		row.stripe_session_id === evidence.sessionId &&
		row.total_cents === evidence.totalCents &&
		row.stripeExpiresAt.getTime() === evidence.expiresAt.getTime();
	if (!base) return false;
	if (kind === 'expired') {
		return (
			(row.payment_intent_id === null || row.payment_intent_id === evidence.paymentIntentId) &&
			(evidence.receiptEmail === null || row.customer_email === evidence.receiptEmail)
		);
	}
	return (
		(row.payment_intent_id === null || row.payment_intent_id === evidence.paymentIntentId) &&
		(row.stripe_charge_id === null || row.stripe_charge_id === evidence.chargeId) &&
		row.customer_email === evidence.receiptEmail
	);
}

/** @param {any} row @param {any} evidence */
function decision(row, evidence) {
	if (!evidenceMatchesRow(row, evidence, evidence.kind)) return { disposition: 'rejected' };
	if (evidence.kind === 'completed') {
		if (['pending', 'cancelled'].includes(row.payment_status)) {
			return { disposition: 'applied', nextPaymentStatus: 'paid', nextRefundedAmount: 0 };
		}
		return { disposition: 'stale' };
	}
	if (evidence.kind === 'expired') {
		if (row.payment_status !== 'pending') return { disposition: 'stale' };
		if (!['ready', 'expired'].includes(row.attempt_status)) return { disposition: 'rejected' };
		return { disposition: 'applied', nextPaymentStatus: 'expired', nextRefundedAmount: 0 };
	}
	if (evidence.refundedAmountCents < row.refunded_amount_cents) {
		return { disposition: 'rejected' };
	}
	if (evidence.refundedAmountCents === row.refunded_amount_cents) {
		return { disposition: 'stale' };
	}
	if (
		evidence.refundedAmountCents > row.total_cents ||
		evidence.totalCents !== row.total_cents ||
		!['pending', 'paid', 'partially_refunded'].includes(row.payment_status) ||
		!['ready', 'completed'].includes(row.attempt_status)
	) {
		return {
			disposition: ['cancelled', 'expired', 'failed', 'refunded'].includes(row.payment_status)
				? 'stale'
				: 'rejected'
		};
	}
	return {
		disposition: 'applied',
		nextPaymentStatus:
			evidence.refundedAmountCents === row.total_cents ? 'refunded' : 'partially_refunded',
		nextRefundedAmount: evidence.refundedAmountCents
	};
}

/** @param {any} tx @param {any} row @param {any} evidence @param {Date} now */
async function applyAttemptTransition(tx, row, evidence, now) {
	if (evidence.kind === 'expired') {
		if (row.attempt_status === 'expired') return;
		const updated = rows(
			await tx.execute(sql`UPDATE checkout_attempts
			SET payment_intent_id = ${evidence.paymentIntentId}, status = 'expired',
				terminal_at = ${now}, version = version + 1, updated_at = ${now}
			WHERE id = ${row.attempt_id} AND order_id = ${row.order_id}
				AND status = ${row.attempt_status} AND version = ${row.attempt_version}
			RETURNING id AS attempt_id`)
		);
		if (updated.length !== 1 || updated[0]?.attempt_id !== row.attempt_id) unavailable();
		return;
	}
	if (row.attempt_status === 'completed') return;
	const updated = rows(
		await tx.execute(sql`UPDATE checkout_attempts
		SET payment_intent_id = ${evidence.paymentIntentId}, stripe_charge_id = ${evidence.chargeId},
			status = 'completed', terminal_at = ${now}, version = version + 1, updated_at = ${now}
		WHERE id = ${row.attempt_id} AND order_id = ${row.order_id}
			AND status = ${row.attempt_status} AND version = ${row.attempt_version}
		RETURNING id AS attempt_id`)
	);
	if (updated.length !== 1 || updated[0]?.attempt_id !== row.attempt_id) unavailable();
}

/** @param {any} tx @param {any} row @param {any} decisionResult @param {Date} now */
async function applyOrderTransition(tx, row, decisionResult, now) {
	let updated;
	if (decisionResult.nextPaymentStatus === 'paid') {
		updated = rows(
			await tx.execute(sql`UPDATE orders
			SET payment_status = 'paid', refunded_amount_cents = 0, pii_purge_after = NULL,
				version = version + 1, updated_at = ${now}
			WHERE id = ${row.order_id} AND payment_status = ${row.payment_status}
				AND refunded_amount_cents = ${row.refunded_amount_cents}
				AND version = ${row.order_version}
			RETURNING id AS order_id`)
		);
	} else if (decisionResult.nextPaymentStatus === 'expired') {
		const purgeAfter = new Date(now.getTime() + TERMINAL_PII_RETENTION_MS);
		updated = rows(
			await tx.execute(sql`UPDATE orders
			SET payment_status = 'expired', refunded_amount_cents = 0,
				pii_purge_after = ${purgeAfter}, version = version + 1, updated_at = ${now}
			WHERE id = ${row.order_id} AND payment_status = ${row.payment_status}
				AND refunded_amount_cents = ${row.refunded_amount_cents}
				AND version = ${row.order_version}
			RETURNING id AS order_id`)
		);
	} else {
		const purgeAfter =
			decisionResult.nextPaymentStatus === 'refunded'
				? (row.piiPurgeAfter ?? new Date(now.getTime() + TERMINAL_PII_RETENTION_MS))
				: row.piiPurgeAfter;
		updated = rows(
			await tx.execute(sql`UPDATE orders
			SET payment_status = ${decisionResult.nextPaymentStatus},
				refunded_amount_cents = ${decisionResult.nextRefundedAmount},
				pii_purge_after = ${purgeAfter}, version = version + 1, updated_at = ${now}
			WHERE id = ${row.order_id} AND payment_status = ${row.payment_status}
				AND refunded_amount_cents = ${row.refunded_amount_cents}
				AND version = ${row.order_version}
			RETURNING id AS order_id`)
		);
	}
	if (updated.length !== 1 || updated[0]?.order_id !== row.order_id) unavailable();
}

/** @param {any} tx @param {any} descriptor @param {string} disposition @param {Date} now */
async function finalizeEvent(tx, descriptor, disposition, now) {
	const updated = rows(
		await tx.execute(sql`UPDATE stripe_events
		SET disposition = ${disposition}, processed_at = ${now}
		WHERE id = ${descriptor.id} AND processed_at IS NULL
		RETURNING id AS event_id`)
	);
	if (updated.length !== 1 || updated[0]?.event_id !== descriptor.id) unavailable();
	return Object.freeze({ disposition });
}

/** @param {any} tx @param {any} descriptor @param {any} row @param {any} evidence @param {string} disposition @param {Date} now */
async function appendAudit(tx, descriptor, row, evidence, disposition, now) {
	const previousState = JSON.stringify({
		paymentStatus: row.payment_status,
		fulfillmentStatus: row.fulfillment_status,
		attemptStatus: row.attempt_status,
		refundedAmountCents: row.refunded_amount_cents
	});
	const nextState = JSON.stringify({
		paymentStatus:
			disposition === 'applied'
				? evidence.kind === 'completed'
					? 'paid'
					: evidence.kind === 'expired'
						? 'expired'
						: evidence.refundedAmountCents === row.total_cents
							? 'refunded'
							: 'partially_refunded'
				: row.payment_status,
		fulfillmentStatus: row.fulfillment_status,
		attemptStatus:
			disposition === 'applied'
				? evidence.kind === 'expired'
					? 'expired'
					: 'completed'
				: row.attempt_status,
		refundedAmountCents:
			disposition === 'applied' && evidence.kind === 'refunded'
				? evidence.refundedAmountCents
				: row.refunded_amount_cents,
		disposition
	});
	await tx.execute(sql`INSERT INTO audit_log
		(order_id, resource_type, resource_id, actor_kind, action, previous_state, next_state,
		 provider_event_id, created_at)
	VALUES
		(${row.order_id}, 'order', ${row.order_id}, 'stripe', ${`stripe_${evidence.kind}_${disposition}`},
		 ${previousState}::jsonb, ${nextState}::jsonb, ${descriptor.id}, ${now})`);
}

/**
 * Records one verified Stripe event and applies at most one monotonic payment transition. The
 * caller owns the outer transaction; any thrown error rolls back the event, state, and audit row.
 *
 * @param {unknown} rawTransaction
 * @param {{ descriptor: unknown, evidence?: unknown, rejection?: unknown, now?: Date }} input
 */
export async function reduceStripeWebhookInTransaction(
	rawTransaction,
	{ descriptor: rawDescriptor, evidence: rawEvidence, rejection, now = new Date() }
) {
	const tx = transaction(rawTransaction);
	const descriptor = descriptorValue(rawDescriptor);
	clock(now);
	if (!(rejection === undefined || rejection === 'provider_mismatch')) unavailable();
	const evidence =
		descriptor.kind === 'unsupported' || rejection === 'provider_mismatch'
			? null
			: evidenceValue(rawEvidence, descriptor.kind);

	const inserted = rows(
		await tx.execute(sql`INSERT INTO stripe_events
			(id, type, mode, received_at, disposition)
		VALUES (${descriptor.id}, ${descriptor.type}, ${descriptor.mode}, ${now}, 'rejected')
		ON CONFLICT (id) DO NOTHING
		RETURNING id AS event_id`)
	);
	if (inserted.length === 0) {
		const existing = rows(
			await tx.execute(sql`SELECT type, mode, disposition, processed_at
			FROM stripe_events WHERE id = ${descriptor.id}`)
		);
		if (existing.length !== 1 || !isObject(existing[0])) unavailable();
		const row = existing[0];
		if (
			row.type !== descriptor.type ||
			row.mode !== descriptor.mode ||
			!EVENT_DISPOSITIONS.has(/** @type {string} */ (row.disposition)) ||
			row.processed_at === null
		) {
			unavailable();
		}
		dateValue(row.processed_at);
		return Object.freeze({ disposition: 'duplicate' });
	}
	if (inserted.length !== 1 || inserted[0]?.event_id !== descriptor.id) unavailable();

	if (descriptor.kind === 'unsupported') {
		return finalizeEvent(tx, descriptor, 'ignored_unsupported_type', now);
	}
	if (rejection === 'provider_mismatch') {
		return finalizeEvent(tx, descriptor, 'rejected', now);
	}

	const resultRows = rows(
		await tx.execute(sql`SELECT
			ca.id AS attempt_id, ca.order_id AS attempt_order_id, ca.stripe_session_id,
			ca.payment_intent_id, ca.stripe_charge_id, ca.stripe_expires_at,
			ca.checkout_ready_at, ca.terminal_at, ca.status AS attempt_status,
			ca.version AS attempt_version,
			o.id AS order_id, o.customer_email, o.currency, o.payment_status,
			o.fulfillment_status, o.refunded_amount_cents, o.total_cents,
			o.version AS order_version, o.pii_purge_after
		FROM checkout_attempts ca
		JOIN orders o ON o.id = ca.order_id
		WHERE ca.id = ${evidence.attemptId} AND ca.order_id = ${evidence.orderId}
		FOR UPDATE OF ca, o`)
	);
	if (resultRows.length === 0) return finalizeEvent(tx, descriptor, 'rejected', now);
	if (resultRows.length !== 1) unavailable();
	const row = persistedRow(resultRows[0]);
	const transition = decision(row, evidence);
	if (transition.disposition === 'applied') {
		await applyAttemptTransition(tx, row, evidence, now);
		await applyOrderTransition(tx, row, transition, now);
	}
	await appendAudit(tx, descriptor, row, evidence, transition.disposition, now);
	return finalizeEvent(tx, descriptor, transition.disposition, now);
}
