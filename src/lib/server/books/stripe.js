import Stripe from 'stripe';

const MAX_LINE_ITEMS = 65;
const MAX_LABEL_LENGTH = 500;
const MAX_UNIT_AMOUNT_CENTS = 99999999;
const PUBLIC_REFERENCE_PATTERN = /^MPC-[A-HJ-NP-Z2-9]{12}$/u;

/**
 * @typedef {{
 *   label: string,
 *   quantity: number,
 *   unitAmountCents: number,
 *   lineAmountCents: number
 * }} CheckoutLine
 */

/**
 * @typedef {{
 *   order: {
 *     id: string,
 *     publicReference: string,
 *     customerEmail: string,
 *     currency: string,
 *     taxCents: number,
 *     totalCents: number
 *   },
 *   attempt: {
 *     id: string,
 *     stripeIdempotencyKey: string,
 *     status: string,
 *     stripeSessionId?: string | null
 *   },
 *   lines: CheckoutLine[]
 * }} PersistedCheckoutSnapshot
 */

/**
 * @typedef {{
 *   checkout: {
 *     sessions: {
 *       create: (payload: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown>,
 *       retrieve?: (sessionId: string, options?: Record<string, unknown>) => Promise<unknown>
 *     }
 *   }
 * }} StripeCheckoutClient
 */

export class CheckoutSessionError extends Error {}
export class CheckoutPreflightError extends CheckoutSessionError {}

/**
 * Creates the official Stripe client on the server after runtime configuration is available.
 *
 * @param {unknown} secretKey
 */
export function createStripeClient(secretKey) {
	if (typeof secretKey !== 'string' || !secretKey.trim()) {
		throw new CheckoutPreflightError('Stripe configuration is unavailable');
	}

	return new Stripe(secretKey.trim());
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {unknown} value
 * @param {string} label
 */
function assertBoundedString(value, label) {
	if (typeof value !== 'string' || !value || value.length > MAX_LABEL_LENGTH) {
		throw new CheckoutSessionError(`Canonical ${label} is invalid`);
	}

	return value;
}

/**
 * @param {unknown} value
 * @param {string} label
 */
function assertPositiveCents(value, label) {
	if (
		typeof value !== 'number' ||
		!Number.isSafeInteger(value) ||
		value < 1 ||
		value > MAX_UNIT_AMOUNT_CENTS
	) {
		throw new CheckoutSessionError(`Canonical ${label} is invalid`);
	}

	return value;
}

/**
 * @param {unknown} value
 * @param {string} label
 */
function assertNonNegativeCents(value, label) {
	if (
		typeof value !== 'number' ||
		!Number.isSafeInteger(value) ||
		value < 0 ||
		value > MAX_UNIT_AMOUNT_CENTS
	) {
		throw new CheckoutSessionError(`Canonical ${label} is invalid`);
	}

	return value;
}

/**
 * @param {unknown} value
 * @returns {value is StripeCheckoutClient}
 */
function isStripeCheckoutClient(value) {
	return (
		isPlainObject(value) &&
		isPlainObject(value.checkout) &&
		isPlainObject(value.checkout.sessions) &&
		typeof value.checkout.sessions.create === 'function'
	);
}

/**
 * @param {unknown} value
 */
function normalizeOrigin(value) {
	if (typeof value !== 'string') {
		throw new CheckoutSessionError('Checkout origin is invalid');
	}

	let parsed;

	try {
		parsed = new URL(value);
	} catch {
		throw new CheckoutSessionError('Checkout origin is invalid');
	}

	if (
		(parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
		!parsed.hostname ||
		parsed.username ||
		parsed.password
	) {
		throw new CheckoutSessionError('Checkout origin is invalid');
	}

	return parsed.origin;
}

/**
 * @param {unknown} value
 * @param {string | null} [approvedCustomHost]
 * @returns {value is string}
 */
export function isSecureCheckoutRedirectUrl(value, approvedCustomHost = null) {
	if (typeof value !== 'string' || !value || value.length > 2000) {
		return false;
	}

	try {
		const parsed = new URL(value);
		return (
			parsed.protocol === 'https:' &&
			(parsed.hostname === 'checkout.stripe.com' ||
				(typeof approvedCustomHost === 'string' && parsed.hostname === approvedCustomHost)) &&
			!parsed.username &&
			!parsed.password &&
			!parsed.port
		);
	} catch {
		return false;
	}
}

/** @param {unknown} actual @param {Record<string, string>} expected */
function hasExactMetadata(actual, expected) {
	if (!isPlainObject(actual)) return false;
	const actualKeys = Object.keys(actual);
	const expectedKeys = Object.keys(expected);
	return (
		actualKeys.length === expectedKeys.length &&
		expectedKeys.every((key) => actual[key] === expected[key])
	);
}

/**
 * @param {PersistedCheckoutSnapshot} snapshot
 * @param {{ appOrigin: string, stripeCheckoutHost: string | null, stripeSecretKey: string, now: Date }} options
 */
function preparePersistedCheckout(snapshot, options) {
	if (
		!isPlainObject(snapshot) ||
		!isPlainObject(snapshot.order) ||
		!isPlainObject(snapshot.attempt) ||
		!Array.isArray(snapshot.lines) ||
		!isPlainObject(options)
	) {
		throw new CheckoutSessionError('Canonical persisted checkout is invalid');
	}

	const persistedOrder = snapshot.order;
	const attempt = snapshot.attempt;
	const appOrigin = normalizeOrigin(options.appOrigin);
	const stripeCheckoutHost = options.stripeCheckoutHost;
	if (!(stripeCheckoutHost === null || typeof stripeCheckoutHost === 'string')) {
		throw new CheckoutSessionError('Canonical Stripe Checkout host is invalid');
	}
	const stripeSecretKey = assertBoundedString(options.stripeSecretKey, 'Stripe key');
	const now = options.now;
	if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
		throw new CheckoutSessionError('Checkout clock is invalid');
	}
	const orderId = assertBoundedString(persistedOrder.id, 'order ID');
	const publicReference = assertBoundedString(
		persistedOrder.publicReference,
		'public order reference'
	);
	if (!PUBLIC_REFERENCE_PATTERN.test(publicReference)) {
		throw new CheckoutSessionError('Canonical public order reference is invalid');
	}
	const attemptId = assertBoundedString(attempt.id, 'attempt ID');
	const email = assertBoundedString(persistedOrder.customerEmail, 'guest email');
	const totalCents = assertPositiveCents(persistedOrder.totalCents, 'order total');
	const taxCents = persistedOrder.taxCents;
	if (persistedOrder.currency !== 'cad' || !Number.isSafeInteger(taxCents) || taxCents < 0) {
		throw new CheckoutSessionError('Canonical persisted order is invalid');
	}
	const idempotencyKey = assertBoundedString(attempt.stripeIdempotencyKey, 'idempotency key');
	const normalizedLines = snapshot.lines.map((line) => {
		if (!isPlainObject(line)) {
			throw new CheckoutSessionError('Canonical persisted line is invalid');
		}
		const label = assertBoundedString(line.label, 'checkout line label');
		const quantity = assertPositiveCents(line.quantity, 'checkout line quantity');
		const unitAmountCents = assertNonNegativeCents(line.unitAmountCents, 'checkout line amount');
		if (line.lineAmountCents !== quantity * unitAmountCents) {
			throw new CheckoutSessionError('Canonical persisted line amount is invalid');
		}
		return { label, quantity, unitAmountCents };
	});
	if (normalizedLines.length === 0 || normalizedLines.length > MAX_LINE_ITEMS) {
		throw new CheckoutSessionError('Canonical persisted lines are invalid');
	}
	const lineTotalCents = normalizedLines.reduce(
		(total, line) => total + line.quantity * line.unitAmountCents,
		0
	);
	if (lineTotalCents + taxCents !== totalCents) {
		throw new CheckoutSessionError('Canonical persisted order total is invalid');
	}
	const metadata = {
		service: 'marianopolis-book-delivery',
		schema_version: '1',
		order_id: orderId,
		checkout_attempt_id: attemptId
	};
	const successUrl = new URL(
		`/books/order-confirmation/${encodeURIComponent(publicReference)}`,
		appOrigin
	).href;
	const cancelUrl = new URL('/books/checkout', appOrigin).href;
	const lineItems = normalizedLines.map((line) => ({
		price_data: {
			currency: 'cad',
			product_data: { name: line.label },
			unit_amount: line.unitAmountCents
		},
		quantity: line.quantity
	}));
	if (taxCents > 0) {
		lineItems.push({
			price_data: {
				currency: 'cad',
				product_data: { name: 'Tax' },
				unit_amount: taxCents
			},
			quantity: 1
		});
	}
	return {
		attempt,
		orderId,
		email,
		totalCents,
		idempotencyKey,
		metadata,
		successUrl,
		cancelUrl,
		lineItems,
		expectedLiveMode: stripeSecretKey.startsWith('sk_live_'),
		stripeCheckoutHost,
		now
	};
}

/** @param {unknown} session @param {ReturnType<typeof preparePersistedCheckout>} expected @param {string | null} expectedSessionId */
function validateProviderSession(session, expected, expectedSessionId = null) {
	if (!isPlainObject(session)) {
		throw new CheckoutSessionError('Stripe Checkout provider result is invalid');
	}
	const paymentIntentId = session.payment_intent;
	const created = session.created;
	const expiresAt = session.expires_at;
	if (
		session.object !== 'checkout.session' ||
		typeof session.id !== 'string' ||
		session.id.length > 255 ||
		!new RegExp(`^cs_${expected.expectedLiveMode ? 'live' : 'test'}_[A-Za-z0-9_]+$`, 'u').test(
			session.id
		) ||
		(expectedSessionId !== null && session.id !== expectedSessionId) ||
		session.livemode !== expected.expectedLiveMode ||
		session.mode !== 'payment' ||
		session.ui_mode !== 'hosted_page' ||
		session.status !== 'open' ||
		session.payment_status !== 'unpaid' ||
		session.currency !== 'cad' ||
		session.amount_total !== expected.totalCents ||
		session.client_reference_id !== expected.orderId ||
		!hasExactMetadata(session.metadata, expected.metadata) ||
		session.customer_email !== expected.email ||
		!Array.isArray(session.payment_method_types) ||
		session.payment_method_types.length !== 1 ||
		session.payment_method_types[0] !== 'card' ||
		session.success_url !== expected.successUrl ||
		session.cancel_url !== expected.cancelUrl ||
		typeof created !== 'number' ||
		!Number.isSafeInteger(created) ||
		created < 1 ||
		typeof expiresAt !== 'number' ||
		!Number.isSafeInteger(expiresAt) ||
		expiresAt <= expected.now.getTime() / 1000 ||
		expiresAt - created < 30 * 60 ||
		expiresAt - created > 24 * 60 * 60 ||
		!(
			paymentIntentId === null ||
			(typeof paymentIntentId === 'string' && /^pi_[A-Za-z0-9_]+$/u.test(paymentIntentId))
		) ||
		!isSecureCheckoutRedirectUrl(session.url, expected.stripeCheckoutHost)
	) {
		throw new CheckoutSessionError('Stripe Checkout provider result is invalid');
	}
	return {
		id: session.id,
		url: session.url,
		paymentIntentId,
		expiresAt: new Date(expiresAt * 1000)
	};
}

/**
 * Creates one hosted Stripe Checkout Session from immutable persisted order snapshots.
 *
 * @param {unknown} stripe
 * @param {PersistedCheckoutSnapshot} snapshot
 * @param {{ appOrigin: string, stripeCheckoutHost: string | null, stripeSecretKey: string, now: Date }} options
 */
export async function createStripeCheckoutSession(stripe, snapshot, options) {
	if (!isStripeCheckoutClient(stripe)) {
		throw new CheckoutPreflightError('Stripe checkout client is invalid');
	}
	let expected;
	try {
		expected = preparePersistedCheckout(snapshot, options);
	} catch (error) {
		if (error instanceof CheckoutSessionError) {
			throw new CheckoutPreflightError('Canonical persisted checkout is invalid');
		}
		throw error;
	}
	if (expected.attempt.status !== 'created') {
		throw new CheckoutPreflightError('Canonical persisted checkout attempt is invalid');
	}
	const session = await stripe.checkout.sessions.create(
		{
			mode: 'payment',
			payment_method_types: ['card'],
			client_reference_id: expected.orderId,
			customer_email: expected.email,
			line_items: expected.lineItems,
			metadata: expected.metadata,
			payment_intent_data: { receipt_email: expected.email, metadata: expected.metadata },
			success_url: expected.successUrl,
			cancel_url: expected.cancelUrl
		},
		{ idempotencyKey: expected.idempotencyKey }
	);
	return validateProviderSession(session, expected);
}

/**
 * Retrieves the exact Session already persisted for a ready attempt and revalidates every binding.
 *
 * @param {unknown} stripe
 * @param {PersistedCheckoutSnapshot} snapshot
 * @param {{ appOrigin: string, stripeCheckoutHost: string | null, stripeSecretKey: string, now: Date }} options
 */
export async function retrieveReadyStripeCheckoutSession(stripe, snapshot, options) {
	if (!isStripeCheckoutClient(stripe) || typeof stripe.checkout.sessions.retrieve !== 'function') {
		throw new CheckoutSessionError('Stripe checkout client is invalid');
	}
	const expected = preparePersistedCheckout(snapshot, options);
	if (expected.attempt.status !== 'ready') {
		throw new CheckoutSessionError('Canonical persisted checkout attempt is invalid');
	}
	const sessionId = assertCheckoutSessionId(expected.attempt.stripeSessionId);
	const session = await stripe.checkout.sessions.retrieve(sessionId);
	return validateProviderSession(session, expected, sessionId);
}

/**
 * @param {unknown} value
 */
function assertCheckoutSessionId(value) {
	if (typeof value !== 'string' || !/^cs_[A-Za-z0-9_]+$/u.test(value) || value.length > 255) {
		throw new CheckoutSessionError('Stripe checkout session ID is invalid');
	}

	return value;
}

/**
 * Retrieves the expanded Session needed by a later server-only confirmation loader.
 * Browser code must never construct a Stripe client or call this server module.
 *
 * @param {unknown} stripe
 * @param {unknown} sessionId
 */
export async function retrieveStripeCheckoutSession(stripe, sessionId) {
	if (!isStripeCheckoutClient(stripe) || typeof stripe.checkout.sessions.retrieve !== 'function') {
		throw new CheckoutSessionError('Stripe checkout client is invalid');
	}

	return stripe.checkout.sessions.retrieve(assertCheckoutSessionId(sessionId), {
		expand: ['line_items']
	});
}
