import { sql } from 'drizzle-orm';
import { normalizeApprovedHttpsUrl } from '../catalogue/repository.js';
import { withDatabaseTransaction } from '../db/transaction.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PUBLIC_REFERENCE_PATTERN = /^MPC-[A-HJ-NP-Z2-9]{12}$/u;
const EMAIL_PATTERN =
	/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/iu;
const PAYMENT_FILTERS = new Set([
	'actionable',
	'all',
	'pending',
	'paid',
	'partially_refunded',
	'refunded',
	'expired',
	'failed',
	'cancelled'
]);
const PAYMENT_STATES = new Set([
	'pending',
	'paid',
	'partially_refunded',
	'refunded',
	'expired',
	'failed',
	'cancelled'
]);
const FULFILLMENT_STATES = ['unstarted', 'purchasing', 'received', 'ready_for_pickup', 'picked_up'];
const FULFILLMENT_FILTERS = new Set(['all', ...FULFILLMENT_STATES]);
const PAGE_SIZE = 25;
const MAX_PAGE = 10000;
const MAX_LIST_ROWS = 25;
const MAX_DETAIL_LINES = 100;
const MAX_HISTORY_ROWS = 100;
const MAX_EXPORT_ROWS = 1000;
const MAX_EXPORT_QUANTITY = 9999;
const TERMINAL_PII_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const STAFF_EMAIL = 'team@marihacks.com';
const ATTEMPT_STATES = new Set(['created', 'ready', 'completed', 'expired', 'failed']);
const HISTORY_ACTIONS = new Set([
	'order_created',
	'checkout_session_ready',
	'checkout_payment_intent_attached',
	'checkout_creation_failed',
	'stripe_completed_applied',
	'stripe_completed_stale',
	'stripe_completed_rejected',
	'stripe_expired_applied',
	'stripe_expired_stale',
	'stripe_expired_rejected',
	'stripe_refunded_applied',
	'stripe_refunded_stale',
	'stripe_refunded_rejected',
	'staff_fulfillment_purchasing',
	'staff_fulfillment_received',
	'staff_fulfillment_ready_for_pickup',
	'staff_fulfillment_picked_up',
	'staff_order_cancelled'
]);

export class StaffOrderValidationError extends Error {
	constructor() {
		super('Staff order request is invalid');
		this.name = 'StaffOrderValidationError';
		this.code = 'STAFF_ORDER_INVALID';
	}
}

export class StaffOrderConflictError extends Error {
	constructor() {
		super('Staff order state changed');
		this.name = 'StaffOrderConflictError';
		this.code = 'STAFF_ORDER_CONFLICT';
	}
}

export class StaffOrderNotFoundError extends Error {
	constructor() {
		super('Staff order was not found');
		this.name = 'StaffOrderNotFoundError';
		this.code = 'STAFF_ORDER_NOT_FOUND';
	}
}

export class StaffOrderUnavailableError extends Error {
	constructor() {
		super('Staff orders are unavailable');
		this.name = 'StaffOrderUnavailableError';
		this.code = 'STAFF_ORDER_UNAVAILABLE';
	}
}

/** @returns {never} */
function invalid() {
	throw new StaffOrderValidationError();
}

/** @returns {never} */
function conflict() {
	throw new StaffOrderConflictError();
}

/** @returns {never} */
function notFound() {
	throw new StaffOrderNotFoundError();
}

/** @returns {never} */
function unavailable() {
	throw new StaffOrderUnavailableError();
}

/** @param {unknown} value */
function normalizedEmail(value) {
	if (typeof value !== 'string' || value.length === 0 || value.length > 254) invalid();
	const email = value.trim().toLowerCase();
	const [localPart] = email.split('@');
	if (
		!EMAIL_PATTERN.test(email) ||
		localPart.startsWith('.') ||
		localPart.endsWith('.') ||
		localPart.includes('..') ||
		/[\p{Cc}\s]/u.test(email)
	) {
		invalid();
	}
	return email;
}

/** @param {unknown} value */
function storedEmail(value) {
	try {
		return normalizedEmail(value);
	} catch {
		unavailable();
	}
}

/** @param {unknown} input */
export function normalizeStaffOrderListQuery(input) {
	if (input === null || typeof input !== 'object' || Array.isArray(input)) invalid();
	const value = /** @type {Record<string, unknown>} */ (input);
	const payment = value.payment === '' ? 'actionable' : value.payment;
	const fulfillment = value.fulfillment === '' ? 'all' : value.fulfillment;
	const page = value.page === '' ? 1 : Number(value.page);
	if (
		typeof payment !== 'string' ||
		!PAYMENT_FILTERS.has(payment) ||
		typeof fulfillment !== 'string' ||
		!FULFILLMENT_FILTERS.has(fulfillment) ||
		!Number.isSafeInteger(page) ||
		page < 1 ||
		page > MAX_PAGE
	) {
		invalid();
	}
	return Object.freeze({ payment, fulfillment, page, pageSize: PAGE_SIZE });
}

/** @param {unknown} value */
export function normalizeStaffOrderSearch(value) {
	if (typeof value !== 'string' || value.length === 0 || value.length > 254) invalid();
	const trimmed = value.trim();
	if (PUBLIC_REFERENCE_PATTERN.test(trimmed)) {
		return Object.freeze({ kind: 'reference', value: trimmed });
	}
	return Object.freeze({ kind: 'email', value: normalizedEmail(trimmed) });
}

/** @param {unknown} value */
export function normalizeStaffOrderId(value) {
	if (typeof value !== 'string' || !UUID_PATTERN.test(value)) invalid();
	return value;
}

/** @param {unknown} value */
export function maskStaffOrderEmail(value) {
	const email = normalizedEmail(value);
	const at = email.lastIndexOf('@');
	const local = email.slice(0, at);
	const domain = email.slice(at);
	if (local.length === 1) return `*${domain}`;
	if (local.length === 2) return `${local[0]}*${domain}`;
	return `${local[0]}${'*'.repeat(local.length - 2)}${local.at(-1)}${domain}`;
}

/** @param {unknown} paymentStatus @param {unknown} fulfillmentStatus */
export function nextFulfillmentStatus(paymentStatus, fulfillmentStatus) {
	if (
		typeof paymentStatus !== 'string' ||
		!PAYMENT_STATES.has(paymentStatus) ||
		typeof fulfillmentStatus !== 'string' ||
		!FULFILLMENT_STATES.includes(fulfillmentStatus)
	) {
		invalid();
	}
	if (paymentStatus !== 'paid') conflict();
	const index = FULFILLMENT_STATES.indexOf(fulfillmentStatus);
	return index >= FULFILLMENT_STATES.indexOf('ready_for_pickup')
		? null
		: FULFILLMENT_STATES[index + 1];
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
	return /** @type {any[]} */ (/** @type {{ rows: unknown[] }} */ (value).rows);
}

/** @param {unknown} value */
function transaction(value) {
	if (
		value === null ||
		typeof value !== 'object' ||
		typeof (/** @type {{ execute?: unknown }} */ (value).execute) !== 'function'
	) {
		unavailable();
	}
	return /** @type {{ execute: (query: unknown) => Promise<unknown> }} */ (value);
}

/** @param {unknown} value @param {number} maximum */
function storedText(value, maximum) {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > maximum ||
		value.includes('\0')
	) {
		unavailable();
	}
	return value;
}

/** @param {unknown} value */
function storedDate(value) {
	if (value instanceof Date && Number.isFinite(value.getTime())) return value;
	if (
		typeof value !== 'string' ||
		!/^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,6})?[+-][0-9]{2}(?::?[0-9]{2})?$/u.test(
			value
		)
	) {
		unavailable();
	}
	const parsed = new Date(value);
	if (!Number.isFinite(parsed.getTime())) unavailable();
	return parsed;
}

/** @param {unknown} value */
function positiveVersion(value) {
	if (!Number.isSafeInteger(value) || /** @type {number} */ (value) < 1) invalid();
	return /** @type {number} */ (value);
}

/** @param {unknown} value */
function nonnegativeCents(value) {
	if (
		!Number.isSafeInteger(value) ||
		/** @type {number} */ (value) < 0 ||
		/** @type {number} */ (value) > 99999999
	) {
		unavailable();
	}
	return /** @type {number} */ (value);
}

/** @param {unknown} value */
function countValue(value) {
	const count = typeof value === 'string' && /^\d+$/u.test(value) ? Number(value) : value;
	if (!Number.isSafeInteger(count) || /** @type {number} */ (count) < 0) unavailable();
	return /** @type {number} */ (count);
}

/** @param {unknown} rawNow */
function clock(rawNow) {
	return storedDate(rawNow);
}

/** @param {Date} createdAt @param {Date} now */
function ageSeconds(createdAt, now) {
	const age = Math.floor((now.getTime() - createdAt.getTime()) / 1000);
	if (!Number.isSafeInteger(age) || age < 0) unavailable();
	return age;
}

/** @param {unknown} actor */
function staffActor(actor) {
	if (
		actor === null ||
		typeof actor !== 'object' ||
		Array.isArray(actor) ||
		typeof (/** @type {any} */ (actor).userId) !== 'string' ||
		/** @type {any} */ (actor).userId.length === 0 ||
		/** @type {any} */ (actor).userId.length > 255 ||
		/** @type {any} */ (actor).email !== STAFF_EMAIL ||
		typeof (/** @type {any} */ (actor).requestId) !== 'string' ||
		!UUID_PATTERN.test(/** @type {any} */ (actor).requestId)
	) {
		invalid();
	}
	return /** @type {{ userId: string, email: string, requestId: string }} */ (actor);
}

/** @param {any} row */
function persistedOrder(row) {
	if (
		row === null ||
		typeof row !== 'object' ||
		!UUID_PATTERN.test(row.order_id) ||
		!PUBLIC_REFERENCE_PATTERN.test(row.public_reference) ||
		row.currency !== 'cad' ||
		!PAYMENT_STATES.has(row.payment_status) ||
		!FULFILLMENT_STATES.includes(row.fulfillment_status) ||
		!Number.isSafeInteger(row.version) ||
		row.version < 1 ||
		!Number.isSafeInteger(row.refunded_amount_cents) ||
		row.refunded_amount_cents < 0
	) {
		unavailable();
	}
	const subtotalCents = nonnegativeCents(row.subtotal_cents);
	const serviceFeeCents = nonnegativeCents(row.service_fee_cents);
	const taxCents = nonnegativeCents(row.tax_cents);
	const totalCents = nonnegativeCents(row.total_cents);
	const refundedAmountCents = nonnegativeCents(row.refunded_amount_cents);
	if (
		totalCents !== subtotalCents + serviceFeeCents + taxCents ||
		refundedAmountCents > totalCents
	) {
		unavailable();
	}
	const createdAt = storedDate(row.created_at);
	const updatedAt = storedDate(row.updated_at);
	if (updatedAt.getTime() < createdAt.getTime()) unavailable();
	return {
		id: row.order_id,
		customerName: storedText(row.customer_name, 160),
		customerEmail: storedEmail(row.customer_email),
		publicReference: row.public_reference,
		currency: 'cad',
		paymentStatus: row.payment_status,
		fulfillmentStatus: row.fulfillment_status,
		version: row.version,
		subtotalCents,
		serviceFeeCents,
		taxCents,
		totalCents,
		refundedAmountCents,
		createdAt,
		updatedAt,
		piiPurgeAfter: row.pii_purge_after === null ? null : storedDate(row.pii_purge_after)
	};
}

/** @param {any} row */
function persistedLedgerOrder(row) {
	if (
		row === null ||
		typeof row !== 'object' ||
		!UUID_PATTERN.test(row.order_id) ||
		!PUBLIC_REFERENCE_PATTERN.test(row.public_reference) ||
		!PAYMENT_STATES.has(row.payment_status) ||
		!FULFILLMENT_STATES.includes(row.fulfillment_status) ||
		!Number.isSafeInteger(row.version) ||
		row.version < 1
	) {
		unavailable();
	}
	return {
		id: row.order_id,
		customerEmail: storedEmail(row.customer_email),
		publicReference: row.public_reference,
		paymentStatus: row.payment_status,
		fulfillmentStatus: row.fulfillment_status,
		version: row.version,
		totalCents: nonnegativeCents(row.total_cents),
		createdAt: storedDate(row.created_at)
	};
}

/** @param {any} row @param {Date} now */
function ledgerDto(row, now) {
	const order = persistedLedgerOrder(row);
	return Object.freeze({
		id: order.id,
		publicReference: order.publicReference,
		maskedEmail: maskStaffOrderEmail(order.customerEmail),
		paymentStatus: order.paymentStatus,
		fulfillmentStatus: order.fulfillmentStatus,
		totalCents: order.totalCents,
		version: order.version,
		createdAt: order.createdAt.toISOString(),
		ageSeconds: ageSeconds(order.createdAt, now)
	});
}

/** @param {any} row */
function attemptState(row) {
	if (
		!UUID_PATTERN.test(row.attempt_id) ||
		!ATTEMPT_STATES.has(row.attempt_status) ||
		!Number.isSafeInteger(row.attempt_version) ||
		row.attempt_version < 1 ||
		!(row.stripe_session_id === null || typeof row.stripe_session_id === 'string') ||
		!(row.payment_intent_id === null || typeof row.payment_intent_id === 'string') ||
		!(row.stripe_charge_id === null || typeof row.stripe_charge_id === 'string')
	) {
		unavailable();
	}
	return {
		id: row.attempt_id,
		status: row.attempt_status,
		version: row.attempt_version,
		sessionId: row.stripe_session_id === null ? null : storedText(row.stripe_session_id, 255),
		paymentIntentId: row.payment_intent_id === null ? null : storedText(row.payment_intent_id, 255),
		chargeId: row.stripe_charge_id === null ? null : storedText(row.stripe_charge_id, 255),
		stripeExpiresAt: row.stripe_expires_at === null ? null : storedDate(row.stripe_expires_at),
		checkoutReadyAt: row.checkout_ready_at === null ? null : storedDate(row.checkout_ready_at),
		terminalAt: row.terminal_at === null ? null : storedDate(row.terminal_at)
	};
}

/** @param {any} row */
function cancellationAttemptState(row) {
	if (
		!UUID_PATTERN.test(row.attempt_id) ||
		!ATTEMPT_STATES.has(row.attempt_status) ||
		!Number.isSafeInteger(row.attempt_version) ||
		row.attempt_version < 1 ||
		!(row.stripe_session_id === null || typeof row.stripe_session_id === 'string') ||
		!(row.payment_intent_id === null || typeof row.payment_intent_id === 'string')
	) {
		unavailable();
	}
	return {
		id: row.attempt_id,
		status: row.attempt_status,
		version: row.attempt_version,
		sessionId: row.stripe_session_id === null ? null : storedText(row.stripe_session_id, 255),
		paymentIntentId: row.payment_intent_id === null ? null : storedText(row.payment_intent_id, 255),
		stripeExpiresAt: row.stripe_expires_at === null ? null : storedDate(row.stripe_expires_at),
		checkoutReadyAt: row.checkout_ready_at === null ? null : storedDate(row.checkout_ready_at),
		terminalAt: row.terminal_at === null ? null : storedDate(row.terminal_at)
	};
}

/** @param {any} rawRow */
function cancellationRecord(rawRow) {
	if (
		rawRow === null ||
		typeof rawRow !== 'object' ||
		!UUID_PATTERN.test(rawRow.order_id) ||
		!PAYMENT_STATES.has(rawRow.payment_status) ||
		!FULFILLMENT_STATES.includes(rawRow.fulfillment_status) ||
		!Number.isSafeInteger(rawRow.version) ||
		rawRow.version < 1
	) {
		unavailable();
	}
	const order = {
		id: rawRow.order_id,
		customerEmail: storedEmail(rawRow.customer_email),
		paymentStatus: rawRow.payment_status,
		fulfillmentStatus: rawRow.fulfillment_status,
		version: rawRow.version,
		totalCents: nonnegativeCents(rawRow.total_cents)
	};
	const attempt = cancellationAttemptState(rawRow);
	if (
		!['ready', 'expired'].includes(attempt.status) ||
		attempt.sessionId === null ||
		attempt.stripeExpiresAt === null ||
		attempt.checkoutReadyAt === null ||
		(attempt.status === 'ready' && attempt.terminalAt !== null) ||
		(attempt.status === 'expired' && attempt.terminalAt === null)
	) {
		conflict();
	}
	return { order, attempt };
}

/** @param {string} payment @param {string} fulfillment */
function orderFilterFragment(payment, fulfillment) {
	const clauses = [];
	if (payment === 'actionable') {
		clauses.push(sql`payment_status = 'paid'`, sql`fulfillment_status <> 'picked_up'`);
	} else if (payment !== 'all') {
		clauses.push(sql`payment_status = ${payment}`);
	}
	if (fulfillment !== 'all') clauses.push(sql`fulfillment_status = ${fulfillment}`);
	return clauses.length === 0
		? sql`TRUE`
		: sql.join(
				clauses.map((clause) => sql`(${clause})`),
				sql` AND `
			);
}

/** @param {unknown} rawTransaction @param {{ payment: string, fulfillment: string, page: number, pageSize: number }} filters @param {{ kind: string, value: string } | null} search @param {Date} now */
async function listOrdersInTransaction(rawTransaction, filters, search, now) {
	const tx = transaction(rawTransaction);
	const baseFilter = orderFilterFragment(filters.payment, filters.fulfillment);
	const searchFilter =
		search === null
			? sql`TRUE`
			: search.kind === 'email'
				? sql`lower(customer_email) = ${search.value}`
				: sql`public_reference = ${search.value}`;
	const countRows = rows(
		await tx.execute(sql`SELECT count(*)::text AS total_count
			FROM orders
			WHERE ${baseFilter} AND ${searchFilter}`)
	);
	if (countRows.length !== 1) unavailable();
	const totalCount = countValue(countRows[0]?.total_count);
	const offset = (filters.page - 1) * filters.pageSize;
	const orderRows = rows(
		await tx.execute(sql`SELECT
			id AS order_id, customer_email, public_reference, payment_status,
			fulfillment_status, version, total_cents, created_at
		FROM orders
		WHERE ${baseFilter} AND ${searchFilter}
		ORDER BY created_at DESC, id DESC
		LIMIT ${filters.pageSize} OFFSET ${offset}`)
	);
	if (orderRows.length > MAX_LIST_ROWS) unavailable();
	return {
		orders: orderRows.map((row) => ledgerDto(row, now)),
		totalCount,
		page: filters.page,
		pageSize: filters.pageSize,
		hasPrevious: filters.page > 1,
		hasNext: offset + orderRows.length < totalCount,
		filters: { payment: filters.payment, fulfillment: filters.fulfillment }
	};
}

/** @param {unknown} value */
function approvedHostSet(value) {
	if (
		!Array.isArray(value) ||
		value.length === 0 ||
		value.length > 32 ||
		new Set(value).size !== value.length
	) {
		unavailable();
	}
	const hosts = new Set(value);
	for (const host of value) {
		try {
			normalizeApprovedHttpsUrl(`https://${host}/`, hosts);
		} catch {
			unavailable();
		}
	}
	return hosts;
}

/** @param {any} row @param {ReadonlySet<string>} hosts */
function lineDto(row, hosts) {
	if (
		!UUID_PATTERN.test(row.line_id) ||
		!['book', 'service_fee'].includes(row.kind) ||
		!UUID_PATTERN.test(row.bookstore_id) ||
		!Number.isSafeInteger(row.quantity) ||
		row.quantity < 1
	) {
		unavailable();
	}
	const unitAmountCents = nonnegativeCents(row.unit_amount_cents);
	const lineAmountCents = nonnegativeCents(row.line_amount_cents);
	if (lineAmountCents !== unitAmountCents * row.quantity) unavailable();
	const book = row.kind === 'book';
	if (
		book !== UUID_PATTERN.test(row.book_id ?? '') ||
		book !== (typeof row.teacher_name === 'string') ||
		book !== (typeof row.course_code === 'string') ||
		book !== (typeof row.course_title === 'string')
	) {
		unavailable();
	}
	let currentRetailerUrl = null;
	if (book) {
		try {
			currentRetailerUrl = normalizeApprovedHttpsUrl(row.current_retailer_url, hosts);
		} catch {
			unavailable();
		}
	}
	return {
		id: row.line_id,
		kind: row.kind,
		label: storedText(row.label, 240),
		isbn: row.isbn === null ? null : storedText(row.isbn, 32),
		teacherName: book ? storedText(row.teacher_name, 160) : null,
		courseCode: book ? storedText(row.course_code, 64) : null,
		courseTitle: book ? storedText(row.course_title, 200) : null,
		quantity: row.quantity,
		unitAmountCents,
		lineAmountCents,
		currentRetailerUrl,
		bookstoreId: row.bookstore_id,
		bookstoreName: storedText(row.bookstore_name, 160)
	};
}

/** @param {unknown} value @param {string} field */
function safeAuditState(value, field) {
	if (value === null) return null;
	if (typeof value !== 'object' || Array.isArray(value)) unavailable();
	const state = /** @type {Record<string, unknown>} */ (value);
	const candidate = state[field];
	if (field === 'paymentStatus') {
		return typeof candidate === 'string' && PAYMENT_STATES.has(candidate) ? candidate : null;
	}
	return typeof candidate === 'string' && FULFILLMENT_STATES.includes(candidate) ? candidate : null;
}

/** @param {any} row */
function historyDto(row) {
	if (
		!UUID_PATTERN.test(row.audit_id) ||
		!['customer', 'staff', 'stripe', 'system', 'maintenance'].includes(row.actor_kind) ||
		!HISTORY_ACTIONS.has(row.action)
	) {
		return null;
	}
	return {
		id: row.audit_id,
		actorKind: row.actor_kind,
		action: row.action,
		previousPaymentStatus: safeAuditState(row.previous_state, 'paymentStatus'),
		nextPaymentStatus: safeAuditState(row.next_state, 'paymentStatus'),
		previousFulfillmentStatus: safeAuditState(row.previous_state, 'fulfillmentStatus'),
		nextFulfillmentStatus: safeAuditState(row.next_state, 'fulfillmentStatus'),
		createdAt: storedDate(row.created_at).toISOString()
	};
}

/** @param {unknown} rawTransaction @param {string} orderId @param {ReadonlySet<string>} hosts @param {Date} now */
async function loadDetailInTransaction(rawTransaction, orderId, hosts, now) {
	const tx = transaction(rawTransaction);
	const orderRows = rows(
		await tx.execute(sql`SELECT
			o.id AS order_id, o.customer_name, o.customer_email, o.public_reference, o.currency,
			o.payment_status, o.fulfillment_status, o.version, o.subtotal_cents,
			o.service_fee_cents, o.tax_cents, o.total_cents, o.refunded_amount_cents,
			o.created_at, o.updated_at, o.pii_purge_after,
			ca.id AS attempt_id, ca.status AS attempt_status, ca.version AS attempt_version,
			ca.stripe_session_id, ca.payment_intent_id, ca.stripe_charge_id,
			ca.stripe_expires_at, ca.checkout_ready_at, ca.terminal_at
		FROM orders o
		JOIN checkout_attempts ca ON ca.order_id = o.id
		WHERE o.id = ${orderId}
		LIMIT 2`)
	);
	if (orderRows.length === 0) notFound();
	if (orderRows.length !== 1) unavailable();
	const row = orderRows[0];
	const order = persistedOrder(row);
	const attempt = attemptState(row);
	const lineRows = rows(
		await tx.execute(sql`SELECT
			ol.id AS line_id, ol.kind, ol.label, ol.isbn, ol.bookstore_id, ol.bookstore_name,
			ol.book_id, ol.teacher_name, ol.course_code, ol.course_title, ol.quantity,
			ol.unit_amount_cents, ol.line_amount_cents, b.retailer_url AS current_retailer_url
		FROM order_lines ol
		LEFT JOIN books b ON b.id = ol.book_id
		WHERE ol.order_id = ${orderId}
		ORDER BY ol.bookstore_name, ol.bookstore_id,
			CASE WHEN ol.kind = 'book' THEN 0 ELSE 1 END, ol.label, ol.id
		LIMIT ${MAX_DETAIL_LINES + 1}`)
	);
	if (lineRows.length === 0 || lineRows.length > MAX_DETAIL_LINES) unavailable();
	const lines = lineRows.map((line) => lineDto(line, hosts));
	const bookTotal = lines
		.filter(({ kind }) => kind === 'book')
		.reduce((total, line) => total + line.lineAmountCents, 0);
	const feeTotal = lines
		.filter(({ kind }) => kind === 'service_fee')
		.reduce((total, line) => total + line.lineAmountCents, 0);
	if (bookTotal !== order.subtotalCents || feeTotal !== order.serviceFeeCents) unavailable();

	const auditRows = rows(
		await tx.execute(sql`SELECT
			id AS audit_id, actor_kind, action, previous_state, next_state, created_at
		FROM audit_log
		WHERE order_id = ${orderId}
		ORDER BY created_at DESC, id DESC
		LIMIT ${MAX_HISTORY_ROWS + 1}`)
	);
	if (auditRows.length > MAX_HISTORY_ROWS) unavailable();
	const history = auditRows.map(historyDto).filter(Boolean);
	/** @type {Array<{ id: string, name: string, lines: Array<Record<string, unknown>> }>} */
	const groups = [];
	for (const line of lines) {
		let group = groups.at(-1);
		if (!group || group.id !== line.bookstoreId) {
			group = { id: line.bookstoreId, name: line.bookstoreName, lines: [] };
			groups.push(group);
		}
		const { bookstoreId, bookstoreName, ...publicLine } = line;
		if (bookstoreId !== group.id || bookstoreName !== group.name) unavailable();
		group.lines.push(publicLine);
	}
	let nextState = null;
	if (order.paymentStatus === 'paid')
		nextState = nextFulfillmentStatus('paid', order.fulfillmentStatus);
	return {
		id: order.id,
		publicReference: order.publicReference,
		customer: { name: order.customerName, email: order.customerEmail },
		currency: order.currency,
		paymentStatus: order.paymentStatus,
		fulfillmentStatus: order.fulfillmentStatus,
		version: order.version,
		subtotalCents: order.subtotalCents,
		serviceFeeCents: order.serviceFeeCents,
		taxCents: order.taxCents,
		totalCents: order.totalCents,
		refundedAmountCents: order.refundedAmountCents,
		createdAt: order.createdAt.toISOString(),
		updatedAt: order.updatedAt.toISOString(),
		ageSeconds: ageSeconds(order.createdAt, now),
		provider: {
			checkoutSessionId: attempt.sessionId,
			paymentIntentId: attempt.paymentIntentId,
			chargeId: attempt.chargeId
		},
		bookstores: groups,
		history,
		nextFulfillmentStatus: nextState,
		canCancel:
			order.paymentStatus === 'pending' &&
			order.fulfillmentStatus === 'unstarted' &&
			['ready', 'expired'].includes(attempt.status) &&
			attempt.sessionId !== null
	};
}

/** @param {unknown} error */
function knownError(error) {
	return (
		error instanceof StaffOrderValidationError ||
		error instanceof StaffOrderConflictError ||
		error instanceof StaffOrderNotFoundError ||
		error instanceof StaffOrderUnavailableError
	);
}

/** @template T @param {() => Promise<T>} operation */
async function sanitized(operation) {
	try {
		return await operation();
	} catch (error) {
		if (knownError(error)) throw error;
		unavailable();
	}
}

/** @param {unknown} rawTransaction @param {{ orderId: unknown, expectedVersion: unknown, actor: unknown, now?: Date }} input */
export async function advanceFulfillmentInTransaction(rawTransaction, input) {
	const tx = transaction(rawTransaction);
	if (input === null || typeof input !== 'object' || Array.isArray(input)) invalid();
	const orderId = normalizeStaffOrderId(input.orderId);
	const expectedVersion = positiveVersion(input.expectedVersion);
	const actor = staffActor(input.actor);
	const now = clock(input.now ?? new Date());
	const locked = rows(
		await tx.execute(sql`SELECT
			id AS order_id, customer_name, customer_email, public_reference, currency,
			payment_status, fulfillment_status, version, subtotal_cents, service_fee_cents,
			tax_cents, total_cents, refunded_amount_cents, created_at, updated_at, pii_purge_after
		FROM orders
		WHERE id = ${orderId}
		FOR UPDATE`)
	);
	if (locked.length === 0) notFound();
	if (locked.length !== 1) unavailable();
	const order = persistedOrder(locked[0]);
	if (order.version !== expectedVersion) conflict();
	const nextState = nextFulfillmentStatus(order.paymentStatus, order.fulfillmentStatus);
	if (nextState === null) conflict();
	const piiPurgeAfter = order.piiPurgeAfter;
	const updated = rows(
		await tx.execute(sql`UPDATE orders
					SET fulfillment_status = ${nextState}, version = version + 1, updated_at = ${now}
					WHERE id = ${orderId} AND payment_status = 'paid'
						AND fulfillment_status = ${order.fulfillmentStatus} AND version = ${expectedVersion}
					RETURNING id AS order_id`)
	);
	if (updated.length !== 1 || updated[0]?.order_id !== orderId) unavailable();
	const previousState = JSON.stringify({
		paymentStatus: order.paymentStatus,
		fulfillmentStatus: order.fulfillmentStatus
	});
	const nextAuditState = JSON.stringify({
		paymentStatus: order.paymentStatus,
		fulfillmentStatus: nextState
	});
	const auditRows = rows(
		await tx.execute(sql`INSERT INTO audit_log
			(order_id, resource_type, resource_id, actor_kind, staff_user_id, staff_identity,
			 action, previous_state, next_state, request_id, created_at)
		VALUES
			(${orderId}, 'order', ${orderId}, 'staff', ${actor.userId}, ${actor.email},
			 ${`staff_fulfillment_${nextState}`}, ${previousState}::jsonb,
			 ${nextAuditState}::jsonb, ${actor.requestId}, ${now})
		RETURNING id AS audit_id`)
	);
	if (auditRows.length !== 1 || !UUID_PATTERN.test(auditRows[0]?.audit_id)) unavailable();
	return Object.freeze({
		id: orderId,
		paymentStatus: 'paid',
		fulfillmentStatus: nextState,
		version: expectedVersion + 1,
		piiPurgeAfter
	});
}

/** @param {unknown} rawTransaction @param {{ orderId: unknown, expectedVersion: unknown }} input */
export async function loadCancellationSeedInTransaction(rawTransaction, input) {
	const tx = transaction(rawTransaction);
	if (input === null || typeof input !== 'object' || Array.isArray(input)) invalid();
	const orderId = normalizeStaffOrderId(input.orderId);
	const expectedVersion = positiveVersion(input.expectedVersion);
	const seedRows = rows(
		await tx.execute(sql`SELECT
			o.id AS order_id, o.customer_email, o.payment_status, o.fulfillment_status,
			o.version, o.total_cents,
			ca.id AS attempt_id, ca.status AS attempt_status, ca.version AS attempt_version,
			ca.stripe_session_id, ca.payment_intent_id,
			ca.stripe_expires_at, ca.checkout_ready_at, ca.terminal_at
		FROM orders o
		JOIN checkout_attempts ca ON ca.order_id = o.id
		WHERE o.id = ${orderId}
		LIMIT 2`)
	);
	if (seedRows.length === 0) notFound();
	if (seedRows.length !== 1) unavailable();
	const { order, attempt } = cancellationRecord(seedRows[0]);
	if (
		order.version !== expectedVersion ||
		order.paymentStatus !== 'pending' ||
		order.fulfillmentStatus !== 'unstarted'
	) {
		conflict();
	}
	return Object.freeze({
		orderId,
		attemptId: attempt.id,
		expectedVersion,
		attemptVersion: attempt.version,
		sessionId: attempt.sessionId,
		paymentIntentId: attempt.paymentIntentId,
		totalCents: order.totalCents,
		customerEmail: order.customerEmail,
		attemptStatus: attempt.status
	});
}

/** @param {unknown} value */
function cancellationEvidence(value) {
	if (
		value === null ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		!UUID_PATTERN.test(/** @type {any} */ (value).orderId) ||
		!UUID_PATTERN.test(/** @type {any} */ (value).attemptId) ||
		typeof (/** @type {any} */ (value).sessionId) !== 'string' ||
		/** @type {any} */ (value).sessionId.length > 255 ||
		!Number.isSafeInteger(/** @type {any} */ (value).totalCents) ||
		/** @type {any} */ (value).totalCents < 1 ||
		!(
			/** @type {any} */ (value).paymentIntentId === null ||
			typeof (/** @type {any} */ (value).paymentIntentId) === 'string'
		) ||
		/** @type {any} */ (value).providerStatus !== 'expired'
	) {
		invalid();
	}
	return {
		.../** @type {any} */ (value),
		customerEmail: normalizedEmail(/** @type {any} */ (value).customerEmail)
	};
}

/** @param {unknown} rawTransaction @param {{ orderId: unknown, expectedVersion: unknown, evidence: unknown, actor: unknown, now?: Date }} input */
export async function cancelStaffOrderInTransaction(rawTransaction, input) {
	const tx = transaction(rawTransaction);
	if (input === null || typeof input !== 'object' || Array.isArray(input)) invalid();
	const orderId = normalizeStaffOrderId(input.orderId);
	const expectedVersion = positiveVersion(input.expectedVersion);
	const evidence = cancellationEvidence(input.evidence);
	const actor = staffActor(input.actor);
	const now = clock(input.now ?? new Date());
	const lockedRows = rows(
		await tx.execute(sql`SELECT
			o.id AS order_id, o.customer_email, o.payment_status, o.fulfillment_status,
			o.version, o.total_cents,
			ca.id AS attempt_id, ca.status AS attempt_status, ca.version AS attempt_version,
			ca.stripe_session_id, ca.payment_intent_id,
			ca.stripe_expires_at, ca.checkout_ready_at, ca.terminal_at
		FROM orders o
		JOIN checkout_attempts ca ON ca.order_id = o.id
		WHERE o.id = ${orderId}
		FOR UPDATE OF o, ca`)
	);
	if (lockedRows.length === 0) notFound();
	if (lockedRows.length !== 1) unavailable();
	let record;
	try {
		record = cancellationRecord(lockedRows[0]);
	} catch (error) {
		if (error instanceof StaffOrderConflictError) conflict();
		throw error;
	}
	const { order, attempt } = record;
	if (
		order.id !== orderId ||
		order.version !== expectedVersion ||
		order.paymentStatus !== 'pending' ||
		order.fulfillmentStatus !== 'unstarted' ||
		evidence.orderId !== orderId ||
		evidence.attemptId !== attempt.id ||
		evidence.sessionId !== attempt.sessionId ||
		evidence.paymentIntentId !== attempt.paymentIntentId ||
		evidence.totalCents !== order.totalCents ||
		evidence.customerEmail !== order.customerEmail
	) {
		conflict();
	}
	if (attempt.status === 'ready') {
		const attemptRows = rows(
			await tx.execute(sql`UPDATE checkout_attempts
				SET status = 'expired', terminal_at = ${now}, version = version + 1, updated_at = ${now}
				WHERE id = ${attempt.id} AND order_id = ${orderId} AND status = 'ready'
					AND version = ${attempt.version} AND stripe_session_id = ${attempt.sessionId}
				RETURNING id AS attempt_id`)
		);
		if (attemptRows.length !== 1 || attemptRows[0]?.attempt_id !== attempt.id) unavailable();
	}
	const piiPurgeAfter = new Date(now.getTime() + TERMINAL_PII_RETENTION_MS);
	const orderRows = rows(
		await tx.execute(sql`UPDATE orders
			SET payment_status = 'cancelled', pii_purge_after = ${piiPurgeAfter},
				version = version + 1, updated_at = ${now}
			WHERE id = ${orderId} AND payment_status = 'pending'
				AND fulfillment_status = 'unstarted' AND version = ${expectedVersion}
			RETURNING id AS order_id`)
	);
	if (orderRows.length !== 1 || orderRows[0]?.order_id !== orderId) unavailable();
	const previousState = JSON.stringify({
		paymentStatus: 'pending',
		fulfillmentStatus: 'unstarted',
		attemptStatus: attempt.status
	});
	const nextState = JSON.stringify({
		paymentStatus: 'cancelled',
		fulfillmentStatus: 'unstarted',
		attemptStatus: 'expired'
	});
	const auditAction = 'staff_order_cancelled';
	const auditRows = rows(
		await tx.execute(sql`INSERT INTO audit_log
			(order_id, resource_type, resource_id, actor_kind, staff_user_id, staff_identity,
			 action, previous_state, next_state, request_id, created_at)
		VALUES
			(${orderId}, 'order', ${orderId}, 'staff', ${actor.userId}, ${actor.email},
				 ${auditAction}, ${previousState}::jsonb, ${nextState}::jsonb,
			 ${actor.requestId}, ${now})
		RETURNING id AS audit_id`)
	);
	if (auditRows.length !== 1 || !UUID_PATTERN.test(auditRows[0]?.audit_id)) unavailable();
	return Object.freeze({
		id: orderId,
		paymentStatus: 'cancelled',
		fulfillmentStatus: 'unstarted',
		version: expectedVersion + 1,
		piiPurgeAfter
	});
}

/** @param {unknown} rawTransaction */
export async function listBookstorePurchaseRowsInTransaction(rawTransaction) {
	const tx = transaction(rawTransaction);
	const purchaseRows = rows(
		await tx.execute(sql`SELECT
			ol.bookstore_name, ol.label AS title, ol.isbn, sum(ol.quantity)::text AS quantity
		FROM order_lines ol
		JOIN orders o ON o.id = ol.order_id
		WHERE o.payment_status = 'paid' AND o.fulfillment_status = 'unstarted'
			AND ol.kind = 'book'
		GROUP BY ol.bookstore_id, ol.bookstore_name, ol.book_id, ol.label, ol.isbn
		ORDER BY ol.bookstore_name, ol.label, ol.isbn NULLS LAST, ol.book_id
		LIMIT ${MAX_EXPORT_ROWS + 1}`)
	);
	if (purchaseRows.length > MAX_EXPORT_ROWS) unavailable();
	let aggregateQuantity = 0;
	return purchaseRows.map((row) => {
		const quantity = countValue(row.quantity);
		aggregateQuantity += quantity;
		if (quantity < 1 || aggregateQuantity > MAX_EXPORT_QUANTITY) unavailable();
		return Object.freeze({
			bookstore: storedText(row.bookstore_name, 160),
			title: storedText(row.title, 240),
			isbn: row.isbn === null ? null : storedText(row.isbn, 32),
			quantity
		});
	});
}

/**
 * @param {{ databaseUrl: string, approvedHostnames: string[], runTransaction?: typeof withDatabaseTransaction, getNow?: () => Date }} configuration
 */
export function createStaffOrderRepository({
	databaseUrl,
	approvedHostnames,
	runTransaction = withDatabaseTransaction,
	getNow = () => new Date()
}) {
	if (
		typeof databaseUrl !== 'string' ||
		databaseUrl.length === 0 ||
		databaseUrl !== databaseUrl.trim() ||
		typeof runTransaction !== 'function' ||
		typeof getNow !== 'function'
	) {
		unavailable();
	}
	const hosts = approvedHostSet(approvedHostnames);
	/** @template T @param {(transaction: unknown) => Promise<T>} operation @returns {Promise<T>} */
	const transact = (operation) => runTransaction(operation, { databaseUrl });
	return Object.freeze({
		/** @param {unknown} query */
		async listStaffOrders(query) {
			const filters = normalizeStaffOrderListQuery(query);
			return sanitized(async () => {
				const now = clock(getNow());
				return transact((tx) => listOrdersInTransaction(tx, filters, null, now));
			});
		},

		/** @param {unknown} search @param {unknown} page */
		async searchStaffOrders(search, page) {
			const normalizedSearch = normalizeStaffOrderSearch(search);
			const filters = normalizeStaffOrderListQuery({ payment: 'all', fulfillment: 'all', page });
			return sanitized(async () => {
				const now = clock(getNow());
				const listing = await transact((tx) =>
					listOrdersInTransaction(tx, filters, normalizedSearch, now)
				);
				return {
					...listing,
					query: normalizedSearch.value,
					queryKind: normalizedSearch.kind
				};
			});
		},

		/** @param {unknown} id */
		async getStaffOrderDetail(id) {
			const orderId = normalizeStaffOrderId(id);
			return sanitized(async () => {
				const now = clock(getNow());
				return transact((tx) => loadDetailInTransaction(tx, orderId, hosts, now));
			});
		},

		/** @param {{ orderId: unknown, expectedVersion: unknown, actor: unknown, now?: Date }} input */
		async advanceFulfillment(input) {
			return sanitized(() => transact((tx) => advanceFulfillmentInTransaction(tx, input)));
		},

		/** @param {{ orderId: unknown, expectedVersion: unknown }} input */
		async loadCancellationSeed(input) {
			return sanitized(() => transact((tx) => loadCancellationSeedInTransaction(tx, input)));
		},

		/** @param {{ orderId: unknown, expectedVersion: unknown, evidence: unknown, actor: unknown, now?: Date }} input */
		async cancelOrder(input) {
			return sanitized(() => transact((tx) => cancelStaffOrderInTransaction(tx, input)));
		},

		async listBookstorePurchaseRows() {
			return sanitized(() => transact(listBookstorePurchaseRowsInTransaction));
		}
	});
}
