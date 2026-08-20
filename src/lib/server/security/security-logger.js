const SECURITY_EVENTS = new Set([
	'authorization_denied',
	'webhook_verification_failed',
	'rate_limit_denied',
	'rate_limit_unavailable'
]);
const SECURITY_REASONS = new Set([
	'missing_session',
	'expired_session',
	'unverified_identity',
	'email_not_allowed',
	'invalid_signature',
	'malformed_body',
	'provider_mismatch',
	'database_unavailable',
	'limit_exceeded',
	'trusted_address_missing'
]);
const SECURITY_SCOPES = new Set([
	'checkout_email',
	'checkout_client_address',
	'staff_session',
	'staff_action'
]);
const SECURITY_ROUTES = new Set([
	'/api/book-checkout',
	'/api/stripe/webhook',
	'/api/cron/book-delivery',
	'/books/order-confirmation',
	'/staff',
	'/staff/sign-in',
	'/staff/catalogue',
	'/staff/orders/[orderId]',
	'/staff/orders/export'
]);
const SAFE_ERROR_CODES = new Set([
	'RATE_LIMIT_INPUT_INVALID',
	'RATE_LIMIT_UNAVAILABLE',
	'SERVER_CONFIGURATION_INVALID',
	'STAFF_ACCESS_DENIED'
]);
const MAX_ERROR_DEPTH = 3;
const MAX_AGGREGATE_ERRORS = 3;
const MAX_AGGREGATE_ENTRIES_INSPECTED = 16;

export const SECURITY_EVENT_CODES = Object.freeze({
	authorizationDenied: 'authorization_denied',
	webhookVerificationFailed: 'webhook_verification_failed',
	rateLimitDenied: 'rate_limit_denied',
	rateLimitUnavailable: 'rate_limit_unavailable'
});

export const SECURITY_REASON_CODES = Object.freeze({
	missingSession: 'missing_session',
	expiredSession: 'expired_session',
	unverifiedIdentity: 'unverified_identity',
	emailNotAllowed: 'email_not_allowed',
	invalidSignature: 'invalid_signature',
	malformedBody: 'malformed_body',
	providerMismatch: 'provider_mismatch',
	databaseUnavailable: 'database_unavailable',
	limitExceeded: 'limit_exceeded',
	trustedAddressMissing: 'trusted_address_missing'
});

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {object} record @param {string} key */
function ownDataValue(record, key) {
	const descriptor = Object.getOwnPropertyDescriptor(record, key);
	return descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
		? descriptor.value
		: undefined;
}

/** @param {Error} error */
function safeErrorName(error) {
	if (error instanceof globalThis.AggregateError) return 'AggregateError';
	if (error instanceof TypeError) return 'TypeError';
	if (error instanceof RangeError) return 'RangeError';
	return 'Error';
}

/**
 * Array iteration methods perform ordinary property reads and scan the full attacker-controlled
 * length. Inspecting a small fixed number of own data descriptors skips accessors and prototypes.
 *
 * @param {unknown} value
 * @param {number} depth
 * @param {WeakSet<object>} seen
 */
function sanitizeAggregateEntries(value, depth, seen) {
	if (!Array.isArray(value)) return [];
	const lengthDescriptor = /** @type {PropertyDescriptor} */ (
		Object.getOwnPropertyDescriptor(value, 'length')
	);
	const sanitizedEntries = [];
	const entriesToInspect = Math.min(lengthDescriptor.value, MAX_AGGREGATE_ENTRIES_INSPECTED);
	for (let index = 0; index < entriesToInspect; index += 1) {
		const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
		if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) continue;
		const sanitized = sanitizeError(descriptor.value, depth, seen);
		if (sanitized) sanitizedEntries.push(sanitized);
		if (sanitizedEntries.length === MAX_AGGREGATE_ERRORS) break;
	}
	return sanitizedEntries;
}

/**
 * Error messages, stacks, provider fields, and arbitrary causes are never copied. Only bounded
 * error categories and application-owned codes survive recursive serialization.
 *
 * @param {unknown} value
 * @param {number} [depth]
 * @param {WeakSet<object>} [seen]
 * @returns {Record<string, unknown> | null}
 */
function sanitizeError(value, depth = 0, seen = new WeakSet()) {
	if (!(value instanceof Error)) return null;
	const name = safeErrorName(value);
	if (depth > MAX_ERROR_DEPTH || seen.has(value)) return { name, truncated: true };
	seen.add(value);

	/** @type {Record<string, unknown>} */
	const sanitized = { name };
	const code = ownDataValue(value, 'code');
	if (typeof code === 'string' && SAFE_ERROR_CODES.has(code)) sanitized.code = code;

	const cause = sanitizeError(ownDataValue(value, 'cause'), depth + 1, seen);
	if (cause) sanitized.cause = cause;

	if (value instanceof globalThis.AggregateError) {
		const errors = ownDataValue(value, 'errors');
		const safeErrors = sanitizeAggregateEntries(errors, depth + 1, seen);
		if (safeErrors.length > 0) sanitized.errors = safeErrors;
	}

	return sanitized;
}

/** @param {unknown} value */
function safeRoute(value) {
	if (typeof value !== 'string' || value.length === 0 || value.length > 256) return null;
	const route = /** @type {string} */ (value.split(/[?#]/u, 1)[0]);
	return SECURITY_ROUTES.has(route) ? route : null;
}

/** @param {unknown} metadata */
function safeMetadata(metadata) {
	/** @type {Record<string, unknown>} */
	const result = {};
	if (!isRecord(metadata)) return result;

	const route = safeRoute(ownDataValue(metadata, 'route'));
	if (route) result.route = route;
	const reason = ownDataValue(metadata, 'reason');
	if (typeof reason === 'string' && SECURITY_REASONS.has(reason)) result.reason = reason;
	const scope = ownDataValue(metadata, 'scope');
	if (typeof scope === 'string' && SECURITY_SCOPES.has(scope)) result.scope = scope;
	const status = ownDataValue(metadata, 'status');
	if (Number.isSafeInteger(status) && /** @type {number} */ (status) >= 400 && status <= 599) {
		result.status = status;
	}
	const retryAfterSeconds = ownDataValue(metadata, 'retryAfterSeconds');
	if (
		Number.isSafeInteger(retryAfterSeconds) &&
		/** @type {number} */ (retryAfterSeconds) >= 0 &&
		retryAfterSeconds <= 24 * 60 * 60
	) {
		result.retryAfterSeconds = retryAfterSeconds;
	}
	const error = sanitizeError(ownDataValue(metadata, 'error'));
	if (error) result.error = error;
	return result;
}

/** @param {Record<string, unknown>} record */
function defaultWrite(record) {
	console.warn(JSON.stringify(record));
}

/**
 * @param {{ write?: (record: Record<string, unknown>) => void, now?: () => Date }} [options]
 */
export function createSecurityLogger({ write = defaultWrite, now = () => new Date() } = {}) {
	return Object.freeze({
		/** @param {unknown} event @param {unknown} [metadata] */
		log(event, metadata = {}) {
			if (typeof event !== 'string' || !SECURITY_EVENTS.has(event)) return false;
			try {
				const clockValue = now();
				if (!(clockValue instanceof Date)) return false;
				const record = {
					timestamp: Date.prototype.toISOString.call(clockValue),
					event,
					...safeMetadata(metadata)
				};
				write(record);
				return true;
			} catch {
				return false;
			}
		}
	});
}
