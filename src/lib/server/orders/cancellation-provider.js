const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SESSION_ID_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9_]{1,240}$/u;
const PAYMENT_INTENT_ID_PATTERN = /^pi_[A-Za-z0-9_]{1,240}$/u;
const EMAIL_PATTERN =
	/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/iu;
const MAX_PROVIDER_AMOUNT_CENTS = 99999999;

export class StripeStaffCancellationError extends Error {
	constructor() {
		super('Stripe cancellation evidence is invalid');
		this.name = 'StripeStaffCancellationError';
		this.code = 'STRIPE_STAFF_CANCELLATION_INVALID';
	}
}

/** @returns {never} */
function invalid() {
	throw new StripeStaffCancellationError();
}

/** @param {unknown} value @returns {value is Record<string, any>} */
function isObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** @param {unknown} value @param {RegExp} pattern */
function matches(value, pattern) {
	return typeof value === 'string' && value.length <= 255 && pattern.test(value);
}

/** @param {unknown} value */
function email(value) {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > 254 ||
		value !== value.trim() ||
		!EMAIL_PATTERN.test(value) ||
		/[\p{Cc}\s]/u.test(value)
	) {
		invalid();
	}
	return value.toLowerCase();
}

/** @param {unknown} value */
function cancellationSeed(value) {
	if (
		!isObject(value) ||
		!matches(value.orderId, UUID_V4_PATTERN) ||
		!matches(value.attemptId, UUID_V4_PATTERN) ||
		!matches(value.sessionId, SESSION_ID_PATTERN) ||
		!(
			value.paymentIntentId === null || matches(value.paymentIntentId, PAYMENT_INTENT_ID_PATTERN)
		) ||
		!Number.isSafeInteger(value.totalCents) ||
		value.totalCents < 1 ||
		value.totalCents > MAX_PROVIDER_AMOUNT_CENTS ||
		!['ready', 'expired'].includes(value.attemptStatus)
	) {
		invalid();
	}
	return {
		orderId: value.orderId,
		attemptId: value.attemptId,
		sessionId: value.sessionId,
		paymentIntentId: value.paymentIntentId,
		totalCents: value.totalCents,
		customerEmail: email(value.customerEmail),
		attemptStatus: value.attemptStatus
	};
}

/** @param {unknown} value */
function stripeMode(value) {
	const match = typeof value === 'string' ? /^sk_(test|live)_[A-Za-z0-9]+$/u.exec(value) : null;
	if (!match) invalid();
	return match[1];
}

/** @param {unknown} value */
function stripeClient(value) {
	if (
		!isObject(value) ||
		!isObject(value.checkout) ||
		!isObject(value.checkout.sessions) ||
		typeof value.checkout.sessions.retrieve !== 'function' ||
		typeof value.checkout.sessions.expire !== 'function'
	) {
		invalid();
	}
	return value.checkout.sessions;
}

/** @param {unknown} value @param {ReturnType<typeof cancellationSeed>} expected @param {'test' | 'live'} mode @param {'open' | 'expired'} status */
function validatedSession(value, expected, mode, status) {
	if (!isObject(value) || !isObject(value.metadata)) invalid();
	const metadata = value.metadata;
	const expectedMetadata = {
		service: 'marianopolis-book-delivery',
		schema_version: '1',
		order_id: expected.orderId,
		checkout_attempt_id: expected.attemptId
	};
	const metadataKeys = Object.keys(metadata);
	if (
		metadataKeys.length !== 4 ||
		Object.entries(expectedMetadata).some(
			([key, expectedValue]) => metadata[key] !== expectedValue
		) ||
		value.object !== 'checkout.session' ||
		value.id !== expected.sessionId ||
		!matches(value.id, SESSION_ID_PATTERN) ||
		!value.id.startsWith(`cs_${mode}_`) ||
		value.livemode !== (mode === 'live') ||
		value.mode !== 'payment' ||
		value.status !== status ||
		value.payment_status !== 'unpaid' ||
		value.currency !== 'cad' ||
		value.amount_total !== expected.totalCents ||
		value.client_reference_id !== expected.orderId ||
		!Array.isArray(value.payment_method_types) ||
		value.payment_method_types.length !== 1 ||
		value.payment_method_types[0] !== 'card' ||
		value.payment_intent !== expected.paymentIntentId ||
		email(value.customer_email) !== expected.customerEmail ||
		!Number.isSafeInteger(value.expires_at) ||
		value.expires_at < 1
	) {
		invalid();
	}
}

/**
 * Stripe I/O intentionally happens here without a database callback. The caller can use the
 * returned, fully bound evidence in a second short compare-and-set transaction.
 *
 * @param {unknown} stripe
 * @param {unknown} stripeSecretKey
 * @param {unknown} rawSeed
 */
export async function expireStaffCheckoutSession(stripe, stripeSecretKey, rawSeed) {
	const seed = cancellationSeed(rawSeed);
	const mode = /** @type {'test' | 'live'} */ (stripeMode(stripeSecretKey));
	const sessions = stripeClient(stripe);
	const retrieved = await sessions.retrieve(seed.sessionId);
	if (isObject(retrieved) && retrieved.status === 'expired') {
		validatedSession(retrieved, seed, mode, 'expired');
	} else {
		if (seed.attemptStatus !== 'ready') invalid();
		validatedSession(retrieved, seed, mode, 'open');
		const expired = await sessions.expire(seed.sessionId);
		validatedSession(expired, seed, mode, 'expired');
	}
	return Object.freeze({
		orderId: seed.orderId,
		attemptId: seed.attemptId,
		sessionId: seed.sessionId,
		paymentIntentId: seed.paymentIntentId,
		totalCents: seed.totalCents,
		customerEmail: seed.customerEmail,
		providerStatus: 'expired'
	});
}
