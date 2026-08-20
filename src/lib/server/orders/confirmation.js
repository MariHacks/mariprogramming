import { sql } from 'drizzle-orm';
import { verifyConfirmationCapabilityHash } from './request.js';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PUBLIC_REFERENCE_PATTERN = /^MPC-[A-HJ-NP-Z2-9]{12}$/u;
const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const REQUEST_ID_PATTERN = /^ckr1_[A-Za-z0-9_-]{43}$/u;
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
const EXPECTED_ATTEMPT_STATE = Object.freeze({
	pending: new Set(['created', 'ready']),
	paid: new Set(['completed']),
	partially_refunded: new Set(['completed']),
	refunded: new Set(['completed']),
	expired: new Set(['expired']),
	failed: new Set(['failed']),
	cancelled: new Set(['expired'])
});
const PRESENTATION_STATE = Object.freeze({ pending: 'processing' });

export class OrderConfirmationPersistenceError extends Error {
	constructor() {
		super('Order confirmation is unavailable');
		this.name = 'OrderConfirmationPersistenceError';
		this.code = 'ORDER_CONFIRMATION_UNAVAILABLE';
	}
}

/** @returns {never} */
function unavailable() {
	throw new OrderConfirmationPersistenceError();
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
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
function dateValue(value) {
	if (!(value instanceof Date || typeof value === 'string')) unavailable();
	const parsed = new Date(value);
	if (!Number.isFinite(parsed.getTime())) unavailable();
	return parsed;
}

/** @param {unknown} value */
function cents(value) {
	if (!Number.isSafeInteger(value) || /** @type {number} */ (value) < 0) unavailable();
	return /** @type {number} */ (value);
}

/** @param {unknown} value @param {number} maximum @param {{ nullable?: boolean }} [options] */
function boundedString(value, maximum, { nullable = false } = {}) {
	if (nullable && value === null) return null;
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > maximum ||
		value !== value.trim() ||
		/\p{Cc}/u.test(value)
	) {
		unavailable();
	}
	return value;
}

/** @param {unknown} value */
function maskedEmail(value) {
	const email = /** @type {string} */ (boundedString(value, 320));
	if (email !== email.toLowerCase() || !/^[^@\s]+@[^@\s]+$/u.test(email)) unavailable();
	const separator = email.lastIndexOf('@');
	return `${email[0]}***${email.slice(separator)}`;
}

/** @param {unknown} value */
function storedOrder(value) {
	if (!isObject(value)) unavailable();
	const row = value;
	if (
		typeof row.order_id !== 'string' ||
		!UUID_V4_PATTERN.test(row.order_id) ||
		typeof row.attempt_id !== 'string' ||
		!UUID_V4_PATTERN.test(row.attempt_id) ||
		row.attempt_order_id !== row.order_id ||
		row.public_reference === undefined ||
		!PUBLIC_REFERENCE_PATTERN.test(row.public_reference) ||
		!HASH_PATTERN.test(row.confirmation_token_hash) ||
		!REQUEST_ID_PATTERN.test(row.client_request_id) ||
		!PAYMENT_STATES.has(row.payment_status) ||
		!FULFILLMENT_STATES.has(row.fulfillment_status) ||
		!EXPECTED_ATTEMPT_STATE[
			/** @type {keyof typeof EXPECTED_ATTEMPT_STATE} */ (row.payment_status)
		]?.has(row.attempt_status) ||
		row.currency !== 'cad'
	) {
		unavailable();
	}
	const normalized = {
		orderId: row.order_id,
		publicReference: row.public_reference,
		confirmationTokenHash: row.confirmation_token_hash,
		confirmationExpiresAt: dateValue(row.confirmation_expires_at),
		receiptEmail: maskedEmail(row.customer_email),
		currency: row.currency,
		paymentStatus: row.payment_status,
		fulfillmentStatus: row.fulfillment_status,
		bookSubtotalCents: cents(row.subtotal_cents),
		serviceFeeCents: cents(row.service_fee_cents),
		taxCents: cents(row.tax_cents),
		totalCents: cents(row.total_cents),
		refundedAmountCents: cents(row.refunded_amount_cents),
		requestId: row.client_request_id
	};
	if (
		normalized.totalCents !==
			normalized.bookSubtotalCents + normalized.serviceFeeCents + normalized.taxCents ||
		normalized.totalCents < 1 ||
		normalized.refundedAmountCents > normalized.totalCents ||
		(['pending', 'paid', 'expired', 'failed', 'cancelled'].includes(normalized.paymentStatus) &&
			normalized.refundedAmountCents !== 0) ||
		(normalized.paymentStatus === 'partially_refunded' &&
			(normalized.refundedAmountCents < 1 ||
				normalized.refundedAmountCents >= normalized.totalCents)) ||
		(normalized.paymentStatus === 'refunded' &&
			normalized.refundedAmountCents !== normalized.totalCents)
	) {
		unavailable();
	}
	return normalized;
}

/** @param {unknown} rawLine */
function storedLine(rawLine) {
	if (!isObject(rawLine)) unavailable();
	const line = rawLine;
	if (
		!['book', 'service_fee'].includes(line.kind) ||
		!UUID_V4_PATTERN.test(line.bookstore_id) ||
		!Number.isSafeInteger(line.quantity) ||
		line.quantity < 1 ||
		line.quantity > 99
	) {
		unavailable();
	}
	const normalized = {
		kind: line.kind,
		title: boundedString(line.label, 240),
		isbn: boundedString(line.isbn, 32, { nullable: true }),
		bookstoreId: line.bookstore_id,
		bookstoreName: boundedString(line.bookstore_name, 160),
		bookId: line.book_id,
		courseId: line.course_id,
		courseCode: boundedString(line.course_code, 64, { nullable: true }),
		courseTitle: boundedString(line.course_title, 200, { nullable: true }),
		quantity: line.quantity,
		unitAmountCents: cents(line.unit_amount_cents),
		lineAmountCents: cents(line.line_amount_cents)
	};
	if (normalized.lineAmountCents !== normalized.quantity * normalized.unitAmountCents)
		unavailable();
	if (normalized.kind === 'book') {
		if (
			!UUID_V4_PATTERN.test(normalized.bookId) ||
			!UUID_V4_PATTERN.test(normalized.courseId) ||
			normalized.courseCode === null ||
			normalized.courseTitle === null
		) {
			unavailable();
		}
	} else if (
		normalized.bookId !== null ||
		normalized.courseId !== null ||
		normalized.courseCode !== null ||
		normalized.courseTitle !== null ||
		normalized.isbn !== null ||
		normalized.quantity !== 1 ||
		normalized.unitAmountCents < 500 ||
		normalized.unitAmountCents > 700
	) {
		unavailable();
	}
	return normalized;
}

/** @param {unknown[]} rawLines @param {ReturnType<typeof storedOrder>} order */
function receiptLines(rawLines, order) {
	if (rawLines.length === 0 || rawLines.length > 50) unavailable();
	const lines = rawLines.map(storedLine);
	const books = lines.filter(({ kind }) => kind === 'book');
	const fees = lines.filter(({ kind }) => kind === 'service_fee');
	if (
		books.reduce((total, line) => total + line.lineAmountCents, 0) !== order.bookSubtotalCents ||
		fees.reduce((total, line) => total + line.lineAmountCents, 0) !== order.serviceFeeCents
	) {
		unavailable();
	}
	return {
		books: books.map((line) => ({
			courseId: line.courseId,
			bookId: line.bookId,
			title: line.title,
			isbn: line.isbn,
			bookstoreName: line.bookstoreName,
			courseCode: line.courseCode,
			courseTitle: line.courseTitle,
			quantity: line.quantity,
			unitAmountCents: line.unitAmountCents,
			lineAmountCents: line.lineAmountCents
		})),
		fees: fees.map((line) => ({
			bookstoreId: line.bookstoreId,
			label: line.title,
			amountCents: line.lineAmountCents
		}))
	};
}

/** @param {unknown} publicReference */
export function confirmationCookieName(publicReference) {
	if (typeof publicReference !== 'string' || !PUBLIC_REFERENCE_PATTERN.test(publicReference)) {
		unavailable();
	}
	return `__Secure-mpc_book_confirmation_${publicReference}`;
}

/**
 * Reads an immutable receipt only after a timing-safe capability check. This function performs
 * SELECTs only; payment state remains owned by the signed webhook and protected reconciliation.
 *
 * @param {unknown} rawTransaction
 * @param {{ publicReference: unknown, capability: unknown, now?: Date }} input
 */
export async function loadOrderConfirmationInTransaction(
	rawTransaction,
	{ publicReference, capability, now = new Date() }
) {
	if (
		typeof publicReference !== 'string' ||
		!PUBLIC_REFERENCE_PATTERN.test(publicReference) ||
		typeof capability !== 'string' ||
		!CAPABILITY_PATTERN.test(capability) ||
		!(now instanceof Date) ||
		!Number.isFinite(now.getTime())
	) {
		return null;
	}
	const tx = transaction(rawTransaction);
	const orderRows = rows(
		await tx.execute(sql`SELECT
			o.id AS order_id, o.public_reference, o.confirmation_token_hash,
			o.confirmation_expires_at, o.customer_email, o.currency, o.payment_status,
			o.fulfillment_status, o.subtotal_cents, o.service_fee_cents, o.tax_cents,
			o.total_cents, o.refunded_amount_cents,
			ca.id AS attempt_id, ca.order_id AS attempt_order_id, ca.client_request_id,
			ca.status AS attempt_status
		FROM orders o
		JOIN checkout_attempts ca ON ca.order_id = o.id
		WHERE o.public_reference = ${publicReference}
		LIMIT 2`)
	);
	if (orderRows.length === 0) return null;
	if (orderRows.length !== 1) unavailable();
	const order = storedOrder(orderRows[0]);
	const matchesCapability = verifyConfirmationCapabilityHash(
		capability,
		order.confirmationTokenHash
	);
	if (!matchesCapability || order.confirmationExpiresAt.getTime() <= now.getTime()) return null;

	const lineRows = rows(
		await tx.execute(sql`SELECT kind, label, isbn, bookstore_id, bookstore_name,
			book_id, course_id, course_code, course_title, quantity,
			unit_amount_cents, line_amount_cents
		FROM order_lines
		WHERE order_id = ${order.orderId}
		ORDER BY CASE WHEN kind = 'book' THEN 0 ELSE 1 END,
			course_id NULLS LAST, book_id NULLS LAST, bookstore_id, id`)
	);
	const { books, fees } = receiptLines(lineRows, order);
	const state =
		PRESENTATION_STATE[/** @type {keyof typeof PRESENTATION_STATE} */ (order.paymentStatus)] ??
		order.paymentStatus;
	const isConfirmedPurchase = ['paid', 'partially_refunded'].includes(order.paymentStatus);
	const browserCleanup =
		state === 'processing'
			? null
			: {
					requestId: order.requestId,
					cartSelections: isConfirmedPurchase
						? books.map(({ courseId, bookId, quantity }) => ({ courseId, bookId, quantity }))
						: []
				};

	return Object.freeze({
		state,
		orderReference: order.publicReference,
		receiptEmail: order.receiptEmail,
		currency: order.currency,
		fulfillmentStatus: order.fulfillmentStatus,
		bookSubtotalCents: order.bookSubtotalCents,
		serviceFeeCents: order.serviceFeeCents,
		taxCents: order.taxCents,
		totalCents: order.totalCents,
		refundedAmountCents: order.refundedAmountCents,
		books,
		fees,
		browserCleanup
	});
}
