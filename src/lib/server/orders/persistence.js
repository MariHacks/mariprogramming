import { sql } from 'drizzle-orm';
import { quoteCheckoutCoursesInTransaction } from './quote.js';
import {
	createCheckoutIdentifiers,
	createConfirmationCapability,
	verifyConfirmationCapabilityHash
} from './request.js';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const REQUEST_ID_PATTERN = /^ckr1_[A-Za-z0-9_-]{43}$/u;
const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const PUBLIC_REFERENCE_PATTERN = /^MPC-[A-HJ-NP-Z2-9]{12}$/u;
const STRIPE_SESSION_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9_]{1,240}$/u;
const PAYMENT_INTENT_PATTERN = /^pi_[A-Za-z0-9_]{1,240}$/u;
const FAILED_ORDER_PII_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export class CheckoutConflictError extends Error {
	constructor() {
		super('Checkout request conflicts with an existing attempt');
		this.name = 'CheckoutConflictError';
		this.code = 'CHECKOUT_CONFLICT';
	}
}

export class CheckoutPersistenceError extends Error {
	constructor() {
		super('Checkout persistence is unavailable');
		this.name = 'CheckoutPersistenceError';
		this.code = 'CHECKOUT_PERSISTENCE_UNAVAILABLE';
	}
}

/** @returns {never} */
function unavailable() {
	throw new CheckoutPersistenceError();
}

/** @returns {never} */
function conflict() {
	throw new CheckoutConflictError();
}

/** @param {unknown} value */
function rows(value) {
	if (
		value === null ||
		typeof value !== 'object' ||
		!Array.isArray(/** @type {{ rows?: unknown }} */ (value).rows)
	) {
		unavailable();
	}
	return /** @type {{ rows: unknown[] }} */ (value).rows;
}

/** @param {unknown} value */
function dateValue(value) {
	if (!(value instanceof Date || typeof value === 'string')) unavailable();
	const parsed = new Date(value);
	if (!Number.isFinite(parsed.getTime())) unavailable();
	return parsed;
}

/** @param {unknown} value */
function nullableDate(value) {
	return value === null ? null : dateValue(value);
}

/** @param {unknown} value */
function safeCents(value) {
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
function isObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {unknown} value */
function validateTransaction(value) {
	if (!isObject(value) || typeof (/** @type {any} */ (value).execute) !== 'function') unavailable();
	return /** @type {{ execute: (query: unknown) => Promise<unknown> }} */ (value);
}

/** @param {unknown} value */
function validateFingerprint(value) {
	if (typeof value !== 'string' || !HASH_PATTERN.test(value)) unavailable();
	return value;
}

/** @param {unknown} value */
function validateClock(value) {
	if (!(value instanceof Date) || !Number.isFinite(value.getTime())) unavailable();
	return value;
}

/** @param {unknown} value */
function validateCanonicalRequest(value) {
	if (
		!isObject(value) ||
		/** @type {any} */ (value).version !== 1 ||
		typeof (/** @type {any} */ (value).clientRequestId) !== 'string' ||
		!REQUEST_ID_PATTERN.test(/** @type {any} */ (value).clientRequestId) ||
		typeof (/** @type {any} */ (value).customerName) !== 'string' ||
		typeof (/** @type {any} */ (value).customerEmail) !== 'string' ||
		!Array.isArray(/** @type {any} */ (value).courses)
	) {
		unavailable();
	}
	return /** @type {any} */ (value);
}

/** @param {any} left @param {any} right */
function compareLines(left, right) {
	const leftKind = left.kind === 'book' ? 0 : 1;
	const rightKind = right.kind === 'book' ? 0 : 1;
	return (
		leftKind - rightKind ||
		(left.courseId ?? '').localeCompare(right.courseId ?? '') ||
		(left.bookId ?? '').localeCompare(right.bookId ?? '') ||
		left.bookstoreId.localeCompare(right.bookstoreId)
	);
}

/** @param {unknown} rawLine */
function validateLine(rawLine) {
	if (!isObject(rawLine)) unavailable();
	const line = /** @type {any} */ (rawLine);
	if (
		!['book', 'service_fee'].includes(line.kind) ||
		typeof line.bookstoreId !== 'string' ||
		!UUID_V4_PATTERN.test(line.bookstoreId) ||
		!Number.isSafeInteger(line.quantity) ||
		line.quantity < 1 ||
		line.quantity > 99
	) {
		unavailable();
	}
	const normalized = {
		kind: line.kind,
		label: boundedString(line.label, 240),
		isbn: boundedString(line.isbn, 32, { nullable: true }),
		bookId: line.bookId,
		teacherId: line.teacherId,
		teacherName: boundedString(line.teacherName, 160, { nullable: true }),
		courseId: line.courseId,
		courseCode: boundedString(line.courseCode, 64, { nullable: true }),
		courseTitle: boundedString(line.courseTitle, 200, { nullable: true }),
		bookstoreId: line.bookstoreId,
		bookstoreName: boundedString(line.bookstoreName, 160),
		quantity: line.quantity,
		unitAmountCents: safeCents(line.unitAmountCents),
		lineAmountCents: safeCents(line.lineAmountCents)
	};
	if (normalized.lineAmountCents !== normalized.quantity * normalized.unitAmountCents)
		unavailable();
	if (normalized.kind === 'book') {
		if (
			typeof normalized.bookId !== 'string' ||
			!UUID_V4_PATTERN.test(normalized.bookId) ||
			typeof normalized.teacherId !== 'string' ||
			!UUID_V4_PATTERN.test(normalized.teacherId) ||
			typeof normalized.courseId !== 'string' ||
			!UUID_V4_PATTERN.test(normalized.courseId) ||
			normalized.teacherName === null ||
			normalized.courseCode === null ||
			normalized.courseTitle === null
		) {
			unavailable();
		}
	} else if (
		normalized.bookId !== null ||
		normalized.teacherId !== null ||
		normalized.teacherName !== null ||
		normalized.courseId !== null ||
		normalized.courseCode !== null ||
		normalized.courseTitle !== null ||
		normalized.quantity !== 1 ||
		normalized.unitAmountCents < 500 ||
		normalized.unitAmountCents > 700
	) {
		unavailable();
	}
	return Object.freeze(normalized);
}

/** @param {unknown[]} rawLines */
function validateLines(rawLines) {
	if (!Array.isArray(rawLines) || rawLines.length === 0 || rawLines.length > 50) unavailable();
	const lines = rawLines.map(validateLine).sort(compareLines);
	return Object.freeze(lines);
}

/** @param {any[]} rawRows */
function persistedLines(rawRows) {
	return validateLines(
		rawRows.map((line) => ({
			kind: line.kind,
			label: line.label,
			isbn: line.isbn,
			bookstoreId: line.bookstore_id,
			bookstoreName: line.bookstore_name,
			bookId: line.book_id,
			teacherId: line.teacher_id,
			teacherName: line.teacher_name,
			courseId: line.course_id,
			courseCode: line.course_code,
			courseTitle: line.course_title,
			quantity: line.quantity,
			unitAmountCents: line.unit_amount_cents,
			lineAmountCents: line.line_amount_cents
		}))
	);
}

/** @param {any} row @param {any} canonicalRequest @param {string} fingerprint */
function persistedSnapshot(row, canonicalRequest, fingerprint) {
	if (!isObject(row)) unavailable();
	if (row.request_fingerprint !== fingerprint) conflict();
	if (['completed', 'expired', 'failed'].includes(row.attempt_status)) conflict();
	if (
		!UUID_V4_PATTERN.test(row.attempt_id) ||
		!UUID_V4_PATTERN.test(row.attempt_order_id) ||
		!UUID_V4_PATTERN.test(row.order_id) ||
		row.attempt_order_id !== row.order_id ||
		row.client_request_id !== canonicalRequest.clientRequestId ||
		row.customer_name !== canonicalRequest.customerName ||
		row.customer_email !== canonicalRequest.customerEmail ||
		!PUBLIC_REFERENCE_PATTERN.test(row.public_reference) ||
		!HASH_PATTERN.test(row.confirmation_token_hash) ||
		row.currency !== 'cad' ||
		row.payment_status !== 'pending' ||
		row.fulfillment_status !== 'unstarted' ||
		row.order_version < 1 ||
		row.attempt_version < 1 ||
		!['created', 'ready'].includes(row.attempt_status)
	) {
		unavailable();
	}
	const orderCreatedAt = dateValue(row.order_created_at);
	const attemptCreatedAt = dateValue(row.attempt_created_at);
	const confirmationExpiresAt = dateValue(row.confirmation_expires_at);
	const order = Object.freeze({
		id: row.order_id,
		customerName: row.customer_name,
		customerEmail: row.customer_email,
		publicReference: row.public_reference,
		confirmationTokenHash: row.confirmation_token_hash,
		confirmationExpiresAt,
		currency: row.currency,
		paymentStatus: row.payment_status,
		fulfillmentStatus: row.fulfillment_status,
		version: row.order_version,
		subtotalCents: safeCents(row.subtotal_cents),
		serviceFeeCents: safeCents(row.service_fee_cents),
		taxCents: safeCents(row.tax_cents),
		totalCents: safeCents(row.total_cents),
		createdAt: orderCreatedAt
	});
	if (order.totalCents !== order.subtotalCents + order.serviceFeeCents + order.taxCents)
		unavailable();
	const attempt = Object.freeze({
		id: row.attempt_id,
		orderId: row.attempt_order_id,
		clientRequestId: row.client_request_id,
		requestFingerprint: row.request_fingerprint,
		stripeIdempotencyKey: boundedString(row.stripe_idempotency_key, 255),
		stripeSessionId: row.stripe_session_id,
		paymentIntentId: row.payment_intent_id,
		stripeExpiresAt: nullableDate(row.stripe_expires_at),
		checkoutReadyAt: nullableDate(row.checkout_ready_at),
		terminalAt: nullableDate(row.terminal_at),
		status: row.attempt_status,
		version: row.attempt_version,
		createdAt: attemptCreatedAt
	});
	if (
		(attempt.status === 'created' &&
			(attempt.stripeSessionId !== null ||
				attempt.paymentIntentId !== null ||
				attempt.stripeExpiresAt !== null ||
				attempt.checkoutReadyAt !== null ||
				attempt.terminalAt !== null)) ||
		(attempt.status === 'ready' &&
			(typeof attempt.stripeSessionId !== 'string' ||
				!STRIPE_SESSION_PATTERN.test(attempt.stripeSessionId) ||
				attempt.stripeExpiresAt === null ||
				attempt.checkoutReadyAt === null ||
				attempt.terminalAt !== null ||
				!(
					attempt.paymentIntentId === null ||
					(typeof attempt.paymentIntentId === 'string' &&
						PAYMENT_INTENT_PATTERN.test(attempt.paymentIntentId))
				)))
	) {
		unavailable();
	}
	return { order, attempt };
}

/** @param {{ subtotalCents: number, serviceFeeCents: number }} order @param {readonly any[]} lines */
function validateLineTotals(order, lines) {
	const subtotal = lines
		.filter(({ kind }) => kind === 'book')
		.reduce((total, line) => total + line.lineAmountCents, 0);
	const fees = lines
		.filter(({ kind }) => kind === 'service_fee')
		.reduce((total, line) => total + line.lineAmountCents, 0);
	if (
		!Number.isSafeInteger(subtotal) ||
		!Number.isSafeInteger(fees) ||
		subtotal !== order.subtotalCents ||
		fees !== order.serviceFeeCents
	) {
		unavailable();
	}
}

/**
 * Reserves one checkout attempt on the caller's transaction. No provider network call occurs in
 * this boundary; callers must let the transaction commit before contacting Stripe.
 *
 * @param {unknown} transaction
 * @param {{
 *   canonicalRequest: unknown,
 *   requestFingerprint: unknown,
 *   capabilityKey: unknown,
 *   now?: Date,
 *   repository: unknown,
 *   quoteCheckout?: typeof quoteCheckoutCoursesInTransaction,
 *   identifierFactory?: typeof createCheckoutIdentifiers
 * }} options
 */
export async function reserveCheckoutAttemptInTransaction(
	transaction,
	{
		canonicalRequest,
		requestFingerprint,
		capabilityKey,
		now = new Date(),
		repository,
		quoteCheckout = quoteCheckoutCoursesInTransaction,
		identifierFactory = createCheckoutIdentifiers
	}
) {
	const tx = validateTransaction(transaction);
	const request = validateCanonicalRequest(canonicalRequest);
	const fingerprint = validateFingerprint(requestFingerprint);
	validateClock(now);
	if (typeof quoteCheckout !== 'function' || typeof identifierFactory !== 'function') unavailable();

	await tx.execute(
		sql`SELECT pg_advisory_xact_lock(hashtextextended(${'book-checkout-request:v1:' + request.clientRequestId}, 0))`
	);
	await tx.execute(
		sql`SELECT pg_advisory_xact_lock(hashtextextended(${'book-checkout-fingerprint:v1:' + fingerprint}, 0))`
	);
	const existingRows = rows(
		await tx.execute(sql`SELECT
			ca.id AS attempt_id, ca.order_id AS attempt_order_id, ca.client_request_id,
			ca.request_fingerprint, ca.stripe_idempotency_key, ca.stripe_session_id,
			ca.payment_intent_id, ca.stripe_expires_at, ca.checkout_ready_at, ca.terminal_at,
			ca.status AS attempt_status, ca.version AS attempt_version,
			ca.created_at AS attempt_created_at,
			o.id AS order_id, o.customer_name, o.customer_email, o.public_reference,
			o.confirmation_token_hash, o.confirmation_expires_at, o.currency,
			o.payment_status, o.fulfillment_status, o.version AS order_version,
			o.subtotal_cents, o.service_fee_cents, o.tax_cents, o.total_cents,
			o.created_at AS order_created_at
		FROM checkout_attempts ca
		JOIN orders o ON o.id = ca.order_id
		WHERE ca.client_request_id = ${request.clientRequestId}
		FOR UPDATE OF ca, o`)
	);
	if (existingRows.length > 1) unavailable();
	if (existingRows.length === 1) {
		const snapshot = persistedSnapshot(existingRows[0], request, fingerprint);
		const lineRows = rows(
			await tx.execute(sql`SELECT kind, label, isbn, bookstore_id, bookstore_name,
				book_id, teacher_id, teacher_name, course_id, course_code, course_title,
				quantity, unit_amount_cents, line_amount_cents
			FROM order_lines
			WHERE order_id = ${snapshot.order.id}
			ORDER BY CASE WHEN kind = 'book' THEN 0 ELSE 1 END,
				course_id NULLS LAST, book_id NULLS LAST, bookstore_id, id`)
		);
		const lines = persistedLines(lineRows);
		validateLineTotals(snapshot.order, lines);
		let confirmationCapability;
		try {
			confirmationCapability = createConfirmationCapability({
				capabilityKey,
				orderId: snapshot.order.id,
				attemptId: snapshot.attempt.id
			});
			if (
				!verifyConfirmationCapabilityHash(
					confirmationCapability,
					snapshot.order.confirmationTokenHash
				)
			) {
				unavailable();
			}
		} catch (error) {
			if (error instanceof CheckoutPersistenceError) throw error;
			unavailable();
		}
		return Object.freeze({
			outcome: 'recovered',
			...snapshot,
			lines,
			confirmationCapability
		});
	}

	const activeRows = rows(
		await tx.execute(sql`SELECT id AS attempt_id
		FROM checkout_attempts
		WHERE request_fingerprint = ${fingerprint} AND status IN ('created', 'ready')
		LIMIT 1
		FOR UPDATE`)
	);
	if (activeRows.length > 0) conflict();

	const quote = await quoteCheckout(tx, request, repository);
	if (!isObject(quote) || /** @type {any} */ (quote).currency !== 'cad') unavailable();
	const quoteData = /** @type {any} */ (quote);
	const lines = validateLines(quoteData.lines);
	const orderAmounts = {
		subtotalCents: safeCents(quoteData.subtotalCents),
		serviceFeeCents: safeCents(quoteData.serviceFeeCents),
		taxCents: safeCents(quoteData.taxCents),
		totalCents: safeCents(quoteData.totalCents)
	};
	if (
		orderAmounts.totalCents !==
		orderAmounts.subtotalCents + orderAmounts.serviceFeeCents + orderAmounts.taxCents
	) {
		unavailable();
	}
	validateLineTotals(orderAmounts, lines);

	let generated;
	try {
		generated = identifierFactory({ capabilityKey, now });
	} catch {
		unavailable();
	}
	if (
		!isObject(generated) ||
		!UUID_V4_PATTERN.test(generated.orderId) ||
		!UUID_V4_PATTERN.test(generated.attemptId) ||
		!PUBLIC_REFERENCE_PATTERN.test(generated.publicReference) ||
		typeof generated.stripeIdempotencyKey !== 'string' ||
		generated.stripeIdempotencyKey !== `mpc-book-checkout-v1:${generated.attemptId}` ||
		typeof generated.confirmationCapability !== 'string' ||
		!HASH_PATTERN.test(generated.confirmationTokenHash) ||
		!verifyConfirmationCapabilityHash(
			generated.confirmationCapability,
			generated.confirmationTokenHash
		) ||
		!(generated.confirmationExpiresAt instanceof Date) ||
		!Number.isFinite(generated.confirmationExpiresAt.getTime()) ||
		generated.confirmationExpiresAt.getTime() <= now.getTime()
	) {
		unavailable();
	}

	await tx.execute(sql`INSERT INTO orders
		(id, customer_name, customer_email, public_reference, confirmation_token_hash,
		 confirmation_expires_at, currency, payment_status, fulfillment_status, version,
		 subtotal_cents, service_fee_cents, tax_cents, total_cents, created_at, updated_at)
	VALUES
		(${generated.orderId}, ${request.customerName}, ${request.customerEmail},
		 ${generated.publicReference}, ${generated.confirmationTokenHash},
		 ${generated.confirmationExpiresAt}, 'cad', 'pending', 'unstarted', 1,
		 ${orderAmounts.subtotalCents}, ${orderAmounts.serviceFeeCents}, ${orderAmounts.taxCents},
		 ${orderAmounts.totalCents}, ${now}, ${now})`);
	for (const line of lines) {
		await tx.execute(sql`INSERT INTO order_lines
			(order_id, kind, label, isbn, bookstore_id, bookstore_name, book_id, teacher_id,
			 teacher_name, course_id, course_code, course_title, quantity, unit_amount_cents,
			 line_amount_cents, created_at)
		VALUES
			(${generated.orderId}, ${line.kind}, ${line.label}, ${line.isbn}, ${line.bookstoreId},
			 ${line.bookstoreName}, ${line.bookId}, ${line.teacherId}, ${line.teacherName},
			 ${line.courseId}, ${line.courseCode}, ${line.courseTitle}, ${line.quantity},
			 ${line.unitAmountCents}, ${line.lineAmountCents}, ${now})`);
	}
	await tx.execute(sql`INSERT INTO checkout_attempts
		(id, order_id, client_request_id, request_fingerprint, stripe_idempotency_key,
		 status, version, created_at, updated_at)
	VALUES
		(${generated.attemptId}, ${generated.orderId}, ${request.clientRequestId}, ${fingerprint},
		 ${generated.stripeIdempotencyKey}, 'created', 1, ${now}, ${now})`);
	const auditState = JSON.stringify({
		paymentStatus: 'pending',
		fulfillmentStatus: 'unstarted',
		attemptStatus: 'created',
		totalCents: orderAmounts.totalCents
	});
	await tx.execute(sql`INSERT INTO audit_log
		(order_id, resource_type, resource_id, actor_kind, action, next_state, request_id, created_at)
	VALUES
		(${generated.orderId}, 'order', ${generated.orderId}, 'customer', 'order_created',
		 ${auditState}::jsonb, ${request.clientRequestId}, ${now})`);

	const order = Object.freeze({
		id: generated.orderId,
		customerName: request.customerName,
		customerEmail: request.customerEmail,
		publicReference: generated.publicReference,
		confirmationTokenHash: generated.confirmationTokenHash,
		confirmationExpiresAt: generated.confirmationExpiresAt,
		currency: 'cad',
		paymentStatus: 'pending',
		fulfillmentStatus: 'unstarted',
		version: 1,
		...orderAmounts,
		createdAt: now
	});
	const attempt = Object.freeze({
		id: generated.attemptId,
		orderId: generated.orderId,
		clientRequestId: request.clientRequestId,
		requestFingerprint: fingerprint,
		stripeIdempotencyKey: generated.stripeIdempotencyKey,
		stripeSessionId: null,
		paymentIntentId: null,
		stripeExpiresAt: null,
		checkoutReadyAt: null,
		terminalAt: null,
		status: 'created',
		version: 1,
		createdAt: now
	});
	return Object.freeze({
		outcome: 'created',
		order,
		attempt,
		lines,
		confirmationCapability: generated.confirmationCapability
	});
}

/**
 * Persists a validated provider Session. Callers must not return the provider URL or capability
 * cookie until this transaction commits.
 *
 * @param {unknown} transaction
 * @param {{
 *   orderId: unknown,
 *   attemptId: unknown,
 *   requestFingerprint: unknown,
 *   providerSession: unknown,
 *   now?: Date
 * }} options
 */
export async function persistCheckoutSessionInTransaction(
	transaction,
	{ orderId, attemptId, requestFingerprint, providerSession, now = new Date() }
) {
	const tx = validateTransaction(transaction);
	const fingerprint = validateFingerprint(requestFingerprint);
	validateClock(now);
	const session = /** @type {any} */ (providerSession);
	if (
		typeof orderId !== 'string' ||
		!UUID_V4_PATTERN.test(orderId) ||
		typeof attemptId !== 'string' ||
		!UUID_V4_PATTERN.test(attemptId) ||
		!isObject(providerSession) ||
		typeof session.id !== 'string' ||
		!STRIPE_SESSION_PATTERN.test(session.id) ||
		!(
			session.paymentIntentId === null ||
			(typeof session.paymentIntentId === 'string' &&
				PAYMENT_INTENT_PATTERN.test(session.paymentIntentId))
		) ||
		!(session.expiresAt instanceof Date) ||
		!Number.isFinite(session.expiresAt.getTime()) ||
		session.expiresAt.getTime() <= now.getTime()
	) {
		unavailable();
	}
	const existingRows = rows(
		await tx.execute(sql`SELECT
			ca.id AS attempt_id, ca.order_id AS attempt_order_id, ca.client_request_id,
			ca.request_fingerprint, ca.stripe_idempotency_key, ca.stripe_session_id,
			ca.payment_intent_id, ca.stripe_expires_at, ca.checkout_ready_at, ca.terminal_at,
			ca.status AS attempt_status, ca.version AS attempt_version,
			ca.created_at AS attempt_created_at,
			o.id AS order_id, o.customer_name, o.customer_email, o.public_reference,
			o.confirmation_token_hash, o.confirmation_expires_at, o.currency,
			o.payment_status, o.fulfillment_status, o.version AS order_version,
			o.subtotal_cents, o.service_fee_cents, o.tax_cents, o.total_cents,
			o.created_at AS order_created_at
		FROM checkout_attempts ca
		JOIN orders o ON o.id = ca.order_id
		WHERE ca.id = ${attemptId} AND ca.order_id = ${orderId}
		FOR UPDATE OF ca, o`)
	);
	if (existingRows.length !== 1) unavailable();
	const row = /** @type {any} */ (existingRows[0]);
	if (row.request_fingerprint !== fingerprint) unavailable();
	if (['completed', 'expired', 'failed'].includes(row.attempt_status)) conflict();
	if (row.attempt_status === 'ready') {
		const readyAt = dateValue(row.checkout_ready_at);
		const persistedExpiry = dateValue(row.stripe_expires_at);
		if (
			row.stripe_session_id !== session.id ||
			persistedExpiry.getTime() !== session.expiresAt.getTime()
		) {
			unavailable();
		}
		if (row.payment_intent_id === session.paymentIntentId) {
			return Object.freeze({ outcome: 'already_ready', readyAt });
		}
		if (row.payment_intent_id !== null || session.paymentIntentId === null) unavailable();
		const updatedRows = rows(
			await tx.execute(sql`UPDATE checkout_attempts
				SET payment_intent_id = ${session.paymentIntentId},
				version = version + 1, updated_at = ${now}
			WHERE id = ${attemptId} AND order_id = ${orderId} AND status = 'ready'
					AND stripe_session_id = ${session.id} AND payment_intent_id IS NULL
			RETURNING id AS attempt_id`)
		);
		if (
			updatedRows.length !== 1 ||
			/** @type {Record<string, unknown>} */ (updatedRows[0]).attempt_id !== attemptId
		) {
			unavailable();
		}
		const auditState = JSON.stringify({
			attemptStatus: 'ready',
			paymentIntentId: session.paymentIntentId
		});
		await tx.execute(sql`INSERT INTO audit_log
			(order_id, resource_type, resource_id, actor_kind, action, next_state, request_id, created_at)
		VALUES
			(${orderId}, 'order', ${orderId}, 'customer', 'checkout_payment_intent_attached',
			 ${auditState}::jsonb, ${row.client_request_id}, ${now})`);
		return Object.freeze({ outcome: 'payment_intent_attached', readyAt });
	}
	if (
		row.attempt_status !== 'created' ||
		row.stripe_session_id !== null ||
		row.payment_intent_id !== null ||
		row.stripe_expires_at !== null ||
		row.checkout_ready_at !== null ||
		row.terminal_at !== null
	) {
		unavailable();
	}
	const updatedRows = rows(
		await tx.execute(sql`UPDATE checkout_attempts
		SET stripe_session_id = ${session.id},
			payment_intent_id = ${session.paymentIntentId},
			stripe_expires_at = ${session.expiresAt},
			checkout_ready_at = ${now}, status = 'ready', version = version + 1,
			updated_at = ${now}
		WHERE id = ${attemptId} AND order_id = ${orderId} AND status = 'created'
			AND stripe_session_id IS NULL AND payment_intent_id IS NULL
			AND stripe_expires_at IS NULL AND checkout_ready_at IS NULL AND terminal_at IS NULL
		RETURNING id AS attempt_id`)
	);
	if (
		updatedRows.length !== 1 ||
		/** @type {Record<string, unknown>} */ (updatedRows[0]).attempt_id !== attemptId
	) {
		unavailable();
	}
	const auditState = JSON.stringify({
		attemptStatus: 'ready',
		stripeSessionId: session.id,
		stripeExpiresAt: session.expiresAt.toISOString()
	});
	await tx.execute(sql`INSERT INTO audit_log
		(order_id, resource_type, resource_id, actor_kind, action, next_state, request_id, created_at)
	VALUES
		(${orderId}, 'order', ${orderId}, 'customer', 'checkout_session_ready',
		 ${auditState}::jsonb, ${row.client_request_id}, ${now})`);
	return Object.freeze({ outcome: 'ready', readyAt: now });
}

/**
 * Atomically retires a reservation only when the caller has proved Stripe was never contacted.
 * Ambiguous transport errors and invalid provider responses must never enter this reducer.
 *
 * @param {unknown} transaction
 * @param {{
 *   orderId: unknown,
 *   attemptId: unknown,
 *   requestFingerprint: unknown,
 *   now?: Date
 * }} options
 */
export async function failCheckoutAttemptInTransaction(
	transaction,
	{ orderId, attemptId, requestFingerprint, now = new Date() }
) {
	const tx = validateTransaction(transaction);
	const fingerprint = validateFingerprint(requestFingerprint);
	validateClock(now);
	if (
		typeof orderId !== 'string' ||
		!UUID_V4_PATTERN.test(orderId) ||
		typeof attemptId !== 'string' ||
		!UUID_V4_PATTERN.test(attemptId)
	) {
		unavailable();
	}

	const existingRows = rows(
		await tx.execute(sql`SELECT
			ca.id AS attempt_id, ca.order_id AS attempt_order_id, ca.client_request_id,
			ca.request_fingerprint, ca.stripe_session_id, ca.payment_intent_id,
			ca.stripe_expires_at, ca.checkout_ready_at, ca.terminal_at,
			ca.status AS attempt_status,
			o.id AS order_id, o.payment_status, o.fulfillment_status
		FROM checkout_attempts ca
		JOIN orders o ON o.id = ca.order_id
		WHERE ca.id = ${attemptId} AND ca.order_id = ${orderId}
		FOR UPDATE OF ca, o`)
	);
	if (existingRows.length !== 1) unavailable();
	const row = /** @type {any} */ (existingRows[0]);
	if (['completed', 'expired', 'failed'].includes(row.attempt_status)) conflict();
	if (
		row.attempt_id !== attemptId ||
		row.attempt_order_id !== orderId ||
		row.order_id !== orderId ||
		row.request_fingerprint !== fingerprint ||
		typeof row.client_request_id !== 'string' ||
		!REQUEST_ID_PATTERN.test(row.client_request_id) ||
		row.attempt_status !== 'created' ||
		row.stripe_session_id !== null ||
		row.payment_intent_id !== null ||
		row.stripe_expires_at !== null ||
		row.checkout_ready_at !== null ||
		row.terminal_at !== null ||
		row.payment_status !== 'pending' ||
		row.fulfillment_status !== 'unstarted'
	) {
		unavailable();
	}

	const piiPurgeAfter = new Date(now.getTime() + FAILED_ORDER_PII_RETENTION_MS);
	const attemptRows = rows(
		await tx.execute(sql`UPDATE checkout_attempts
		SET status = 'failed', terminal_at = ${now}, version = version + 1, updated_at = ${now}
		WHERE id = ${attemptId} AND order_id = ${orderId} AND status = 'created'
			AND stripe_session_id IS NULL AND payment_intent_id IS NULL
			AND stripe_expires_at IS NULL AND checkout_ready_at IS NULL AND terminal_at IS NULL
		RETURNING id AS attempt_id`)
	);
	if (
		attemptRows.length !== 1 ||
		/** @type {Record<string, unknown>} */ (attemptRows[0]).attempt_id !== attemptId
	) {
		unavailable();
	}
	const orderRows = rows(
		await tx.execute(sql`UPDATE orders
		SET payment_status = 'failed', pii_purge_after = ${piiPurgeAfter},
			version = version + 1, updated_at = ${now}
		WHERE id = ${orderId} AND payment_status = 'pending' AND fulfillment_status = 'unstarted'
		RETURNING id AS order_id`)
	);
	if (
		orderRows.length !== 1 ||
		/** @type {Record<string, unknown>} */ (orderRows[0]).order_id !== orderId
	) {
		unavailable();
	}
	const auditState = JSON.stringify({
		paymentStatus: 'failed',
		fulfillmentStatus: 'unstarted',
		attemptStatus: 'failed'
	});
	await tx.execute(sql`INSERT INTO audit_log
		(order_id, resource_type, resource_id, actor_kind, action, next_state, request_id, created_at)
	VALUES
		(${orderId}, 'order', ${orderId}, 'system', 'checkout_creation_failed',
		 ${auditState}::jsonb, ${row.client_request_id}, ${now})`);
	return Object.freeze({ outcome: 'failed', terminalAt: now, piiPurgeAfter });
}
