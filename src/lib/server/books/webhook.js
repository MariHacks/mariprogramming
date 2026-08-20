const HANDLED_TYPES = Object.freeze({
	'checkout.session.completed': 'completed',
	'checkout.session.expired': 'expired',
	'charge.refunded': 'refunded'
});
const EVENT_ID_PATTERN = /^evt_[A-Za-z0-9_]{1,251}$/u;
const EVENT_TYPE_PATTERN = /^[a-z0-9_.]{1,64}$/u;
const SESSION_ID_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9_]{1,240}$/u;
const PAYMENT_INTENT_ID_PATTERN = /^pi_[A-Za-z0-9_]{1,240}$/u;
const CHARGE_ID_PATTERN = /^ch_[A-Za-z0-9_]{1,240}$/u;
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const MAX_PROVIDER_AMOUNT_CENTS = 99999999;

export class StripeWebhookEventError extends Error {
	constructor() {
		super('Verified Stripe event is invalid');
		this.name = 'StripeWebhookEventError';
		this.code = 'STRIPE_WEBHOOK_EVENT_INVALID';
	}
}

export class StripeWebhookEvidenceError extends Error {
	constructor() {
		super('Stripe webhook provider evidence is invalid');
		this.name = 'StripeWebhookEvidenceError';
		this.code = 'STRIPE_WEBHOOK_EVIDENCE_INVALID';
	}
}

/** @returns {never} */
function invalidEvent() {
	throw new StripeWebhookEventError();
}

/** @returns {never} */
function invalidEvidence() {
	throw new StripeWebhookEvidenceError();
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
function positiveCents(value) {
	return (
		Number.isSafeInteger(value) &&
		/** @type {number} */ (value) > 0 &&
		/** @type {number} */ (value) <= MAX_PROVIDER_AMOUNT_CENTS
	);
}

/** @param {unknown} value */
function boundedEmail(value) {
	return (
		typeof value === 'string' &&
		value.length > 0 &&
		value.length <= 320 &&
		value === value.trim() &&
		!/[\p{Cc}\s]/u.test(value)
	);
}

/** @param {Record<string, any>} value @param {Record<string, string>} expected */
function exactMetadata(value, expected) {
	const keys = Object.keys(value);
	const expectedKeys = Object.keys(expected);
	return (
		keys.length === expectedKeys.length && expectedKeys.every((key) => value[key] === expected[key])
	);
}

/** @param {string} orderId @param {string} attemptId */
function expectedMetadata(orderId, attemptId) {
	return {
		service: 'marianopolis-book-delivery',
		schema_version: '1',
		order_id: orderId,
		checkout_attempt_id: attemptId
	};
}

/** @param {unknown} value */
function metadataIdentifiers(value) {
	if (!isObject(value)) invalidEvidence();
	const orderId = value.order_id;
	const attemptId = value.checkout_attempt_id;
	if (
		!matchesId(orderId, UUID_V4_PATTERN) ||
		!matchesId(attemptId, UUID_V4_PATTERN) ||
		!exactMetadata(
			value,
			expectedMetadata(/** @type {string} */ (orderId), /** @type {string} */ (attemptId))
		)
	) {
		invalidEvidence();
	}
	return { orderId: /** @type {string} */ (orderId), attemptId: /** @type {string} */ (attemptId) };
}

/** @param {unknown} value @param {string} stripeSecretKey */
export function createStripeWebhookDescriptor(value, stripeSecretKey) {
	if (
		!isObject(value) ||
		value.object !== 'event' ||
		!matchesId(value.id, EVENT_ID_PATTERN) ||
		typeof value.type !== 'string' ||
		!EVENT_TYPE_PATTERN.test(value.type) ||
		typeof value.livemode !== 'boolean'
	) {
		invalidEvent();
	}
	const keyMatch =
		typeof stripeSecretKey === 'string'
			? /^sk_(test|live)_[A-Za-z0-9]+$/u.exec(stripeSecretKey)
			: null;
	if (!keyMatch) invalidEvent();
	const kind = /** @type {string} */ (
		HANDLED_TYPES[/** @type {keyof typeof HANDLED_TYPES} */ (value.type)] ?? 'unsupported'
	);
	let objectId = null;
	if (kind !== 'unsupported') {
		if (!isObject(value.data) || !isObject(value.data.object)) invalidEvent();
		objectId = value.data.object.id;
		const pattern = kind === 'refunded' ? CHARGE_ID_PATTERN : SESSION_ID_PATTERN;
		if (!matchesId(objectId, pattern)) invalidEvent();
	}
	const mode = value.livemode ? 'live' : 'test';
	return Object.freeze({
		id: /** @type {string} */ (value.id),
		type: value.type,
		mode,
		kind,
		objectId: /** @type {string | null} */ (objectId),
		environmentMatches: keyMatch[1] === mode
	});
}

/** @param {unknown} value */
function checkoutClient(value) {
	return (
		isObject(value) &&
		isObject(value.checkout) &&
		isObject(value.checkout.sessions) &&
		typeof value.checkout.sessions.retrieve === 'function'
	);
}

/** @param {unknown} value */
function paymentIntentClient(value) {
	return (
		isObject(value) &&
		isObject(value.paymentIntents) &&
		typeof value.paymentIntents.retrieve === 'function'
	);
}

/** @param {unknown} value */
function chargeClient(value) {
	return isObject(value) && isObject(value.charges) && typeof value.charges.retrieve === 'function';
}

/**
 * @param {unknown} rawSession
 * @param {{ mode: 'test' | 'live', kind: string, objectId: string | null }} descriptor
 * @param {'completed' | 'expired'} kind
 * @param {string | null} [expectedPaymentIntentId]
 */
function validateSession(rawSession, descriptor, kind, expectedPaymentIntentId = null) {
	if (!isObject(rawSession)) invalidEvidence();
	const identifiers = metadataIdentifiers(rawSession.metadata);
	const expectedStatus = kind === 'completed' ? 'complete' : 'expired';
	const expectedPaymentStatus = kind === 'completed' ? 'paid' : 'unpaid';
	const expectedSessionPrefix = descriptor.mode === 'live' ? 'cs_live_' : 'cs_test_';
	const paymentIntentId = rawSession.payment_intent;
	const email = rawSession.customer_email;
	if (
		rawSession.object !== 'checkout.session' ||
		rawSession.id !== descriptor.objectId ||
		!matchesId(rawSession.id, SESSION_ID_PATTERN) ||
		!rawSession.id.startsWith(expectedSessionPrefix) ||
		rawSession.livemode !== (descriptor.mode === 'live') ||
		rawSession.mode !== 'payment' ||
		rawSession.status !== expectedStatus ||
		rawSession.payment_status !== expectedPaymentStatus ||
		rawSession.currency !== 'cad' ||
		!positiveCents(rawSession.amount_total) ||
		rawSession.client_reference_id !== identifiers.orderId ||
		!Array.isArray(rawSession.payment_method_types) ||
		rawSession.payment_method_types.length !== 1 ||
		rawSession.payment_method_types[0] !== 'card' ||
		!Number.isSafeInteger(rawSession.expires_at) ||
		rawSession.expires_at < 1 ||
		!(email === null || boundedEmail(email)) ||
		(kind === 'completed' && !matchesId(paymentIntentId, PAYMENT_INTENT_ID_PATTERN)) ||
		(kind === 'expired' &&
			!(paymentIntentId === null || matchesId(paymentIntentId, PAYMENT_INTENT_ID_PATTERN))) ||
		(expectedPaymentIntentId !== null && paymentIntentId !== expectedPaymentIntentId)
	) {
		invalidEvidence();
	}
	return {
		...identifiers,
		sessionId: /** @type {string} */ (rawSession.id),
		paymentIntentId: /** @type {string | null} */ (paymentIntentId),
		totalCents: /** @type {number} */ (rawSession.amount_total),
		sessionEmail: /** @type {string | null} */ (email),
		expiresAt: new Date(/** @type {number} */ (rawSession.expires_at) * 1000)
	};
}

/**
 * @param {unknown} rawIntent
 * @param {{ mode: 'test' | 'live' }} descriptor
 * @param {{ orderId: string, attemptId: string, paymentIntentId: string | null, totalCents: number }} session
 * @param {string | null} [expectedChargeId]
 */
function validatePaymentIntent(rawIntent, descriptor, session, expectedChargeId = null) {
	if (!isObject(rawIntent)) invalidEvidence();
	const identifiers = metadataIdentifiers(rawIntent.metadata);
	const latestCharge = rawIntent.latest_charge;
	if (
		rawIntent.object !== 'payment_intent' ||
		rawIntent.id !== session.paymentIntentId ||
		!matchesId(rawIntent.id, PAYMENT_INTENT_ID_PATTERN) ||
		rawIntent.livemode !== (descriptor.mode === 'live') ||
		rawIntent.status !== 'succeeded' ||
		rawIntent.currency !== 'cad' ||
		rawIntent.amount !== session.totalCents ||
		rawIntent.amount_received !== session.totalCents ||
		identifiers.orderId !== session.orderId ||
		identifiers.attemptId !== session.attemptId ||
		!matchesId(latestCharge, CHARGE_ID_PATTERN) ||
		(expectedChargeId !== null && latestCharge !== expectedChargeId) ||
		!Array.isArray(rawIntent.payment_method_types) ||
		rawIntent.payment_method_types.length !== 1 ||
		rawIntent.payment_method_types[0] !== 'card' ||
		!boundedEmail(rawIntent.receipt_email)
	) {
		invalidEvidence();
	}
	return {
		chargeId: /** @type {string} */ (latestCharge),
		receiptEmail: /** @type {string} */ (rawIntent.receipt_email)
	};
}

/**
 * Retrieves the provider objects for completed and expired Checkout events. No database callback
 * is accepted here, which keeps all provider I/O outside transaction lifetimes.
 *
 * @param {unknown} stripe
 * @param {ReturnType<typeof createStripeWebhookDescriptor>} descriptor
 */
export async function retrieveCheckoutEventEvidence(stripe, descriptor) {
	if (
		!checkoutClient(stripe) ||
		!isObject(descriptor) ||
		!descriptor.environmentMatches ||
		!['completed', 'expired'].includes(descriptor.kind) ||
		!matchesId(descriptor.objectId, SESSION_ID_PATTERN)
	) {
		invalidEvidence();
	}
	const provider = /** @type {any} */ (stripe);
	const rawSession = await provider.checkout.sessions.retrieve(descriptor.objectId);
	const session = validateSession(
		rawSession,
		/** @type {any} */ (descriptor),
		/** @type {'completed' | 'expired'} */ (descriptor.kind)
	);
	if (descriptor.kind === 'expired') {
		return Object.freeze({
			kind: 'expired',
			orderId: session.orderId,
			attemptId: session.attemptId,
			sessionId: session.sessionId,
			paymentIntentId: session.paymentIntentId,
			chargeId: null,
			totalCents: session.totalCents,
			refundedAmountCents: 0,
			receiptEmail: session.sessionEmail,
			expiresAt: session.expiresAt
		});
	}
	const rawIntent = await provider.paymentIntents.retrieve(session.paymentIntentId);
	const intent = validatePaymentIntent(rawIntent, /** @type {any} */ (descriptor), session);
	if (session.sessionEmail !== intent.receiptEmail) invalidEvidence();
	return Object.freeze({
		kind: 'completed',
		orderId: session.orderId,
		attemptId: session.attemptId,
		sessionId: session.sessionId,
		paymentIntentId: session.paymentIntentId,
		chargeId: intent.chargeId,
		totalCents: session.totalCents,
		refundedAmountCents: 0,
		receiptEmail: intent.receiptEmail,
		expiresAt: session.expiresAt
	});
}

/**
 * @param {unknown} stripe
 * @param {ReturnType<typeof createStripeWebhookDescriptor>} descriptor
 */
export async function retrieveRefundEventSeed(stripe, descriptor) {
	if (
		!chargeClient(stripe) ||
		!paymentIntentClient(stripe) ||
		!isObject(descriptor) ||
		!descriptor.environmentMatches ||
		descriptor.kind !== 'refunded' ||
		!matchesId(descriptor.objectId, CHARGE_ID_PATTERN)
	) {
		invalidEvidence();
	}
	const provider = /** @type {any} */ (stripe);
	const rawCharge = await provider.charges.retrieve(descriptor.objectId);
	if (!isObject(rawCharge)) invalidEvidence();
	const amount = rawCharge.amount;
	const refundedAmount = rawCharge.amount_refunded;
	const paymentIntentId = rawCharge.payment_intent;
	if (
		rawCharge.object !== 'charge' ||
		rawCharge.id !== descriptor.objectId ||
		!matchesId(rawCharge.id, CHARGE_ID_PATTERN) ||
		rawCharge.livemode !== (descriptor.mode === 'live') ||
		rawCharge.paid !== true ||
		rawCharge.currency !== 'cad' ||
		!positiveCents(amount) ||
		!positiveCents(refundedAmount) ||
		refundedAmount > amount ||
		rawCharge.refunded !== (refundedAmount === amount) ||
		!matchesId(paymentIntentId, PAYMENT_INTENT_ID_PATTERN)
	) {
		invalidEvidence();
	}
	const intentSession = {
		orderId: '',
		attemptId: '',
		paymentIntentId: /** @type {string} */ (paymentIntentId),
		totalCents: /** @type {number} */ (amount)
	};
	const rawIntent = await provider.paymentIntents.retrieve(paymentIntentId);
	if (!isObject(rawIntent)) invalidEvidence();
	const identifiers = metadataIdentifiers(rawIntent.metadata);
	intentSession.orderId = identifiers.orderId;
	intentSession.attemptId = identifiers.attemptId;
	const intent = validatePaymentIntent(
		rawIntent,
		/** @type {any} */ (descriptor),
		intentSession,
		/** @type {string} */ (rawCharge.id)
	);
	return Object.freeze({
		kind: 'refunded',
		orderId: identifiers.orderId,
		attemptId: identifiers.attemptId,
		paymentIntentId: /** @type {string} */ (paymentIntentId),
		chargeId: /** @type {string} */ (rawCharge.id),
		totalCents: /** @type {number} */ (amount),
		refundedAmountCents: /** @type {number} */ (refundedAmount),
		receiptEmail: intent.receiptEmail
	});
}

/**
 * Retrieves the stored Checkout Session only after a short preflight read has returned its ID.
 * The final reducer must lock and revalidate the same row before applying this evidence.
 *
 * @param {unknown} stripe
 * @param {Awaited<ReturnType<typeof retrieveRefundEventSeed>>} seed
 * @param {unknown} sessionId
 * @param {unknown} rawDescriptor
 */
export async function retrieveRefundSessionEvidence(stripe, seed, sessionId, rawDescriptor) {
	if (
		!checkoutClient(stripe) ||
		!isObject(seed) ||
		seed.kind !== 'refunded' ||
		!matchesId(sessionId, SESSION_ID_PATTERN) ||
		!matchesId(seed.paymentIntentId, PAYMENT_INTENT_ID_PATTERN) ||
		!matchesId(seed.chargeId, CHARGE_ID_PATTERN) ||
		!isObject(rawDescriptor) ||
		rawDescriptor.kind !== 'refunded' ||
		rawDescriptor.environmentMatches !== true ||
		!['test', 'live'].includes(/** @type {string} */ (rawDescriptor.mode)) ||
		rawDescriptor.objectId !== seed.chargeId
	) {
		invalidEvidence();
	}
	const descriptor = {
		mode: /** @type {'test' | 'live'} */ (rawDescriptor.mode),
		kind: 'completed',
		objectId: /** @type {string} */ (sessionId)
	};
	const provider = /** @type {any} */ (stripe);
	const rawSession = await provider.checkout.sessions.retrieve(sessionId);
	const session = validateSession(rawSession, descriptor, 'completed', seed.paymentIntentId);
	if (
		session.orderId !== seed.orderId ||
		session.attemptId !== seed.attemptId ||
		session.totalCents !== seed.totalCents ||
		session.sessionEmail !== seed.receiptEmail
	) {
		invalidEvidence();
	}
	return Object.freeze({
		...seed,
		sessionId: session.sessionId,
		expiresAt: session.expiresAt
	});
}
