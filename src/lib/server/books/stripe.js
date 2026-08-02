import Stripe from 'stripe';

const MAX_LINE_ITEMS = 65;
const MAX_LABEL_LENGTH = 500;
const MAX_UNIT_AMOUNT_CENTS = 99999999;
const MAX_BOOK_COUNT = 99;

/**
 * @typedef {{
 *   kind: 'book' | 'fee' | 'tax',
 *   label: string,
 *   quantity: number,
 *   unitAmountCents: number,
 *   amountCents: number
 * }} CheckoutLine
 */

/**
 * @typedef {{
 *   guest: { email: string },
 *   lineItems: CheckoutLine[]
 * }} CanonicalCheckoutOrder
 */

/**
 * @typedef {{
 *   checkout: {
 *     sessions: {
 *       create: (payload: Record<string, unknown>) => Promise<{ url?: unknown }>,
 *       retrieve?: (sessionId: string, options: Record<string, unknown>) => Promise<unknown>
 *     }
 *   }
 * }} StripeCheckoutClient
 */

export class CheckoutSessionError extends Error {}

/**
 * Creates the official Stripe client on the server after runtime configuration is available.
 *
 * @param {unknown} secretKey
 */
export function createStripeClient(secretKey) {
	if (typeof secretKey !== 'string' || !secretKey.trim()) {
		throw new CheckoutSessionError('Stripe configuration is unavailable');
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
 * @returns {value is CheckoutLine}
 */
function isCheckoutLine(value) {
	return isPlainObject(value);
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
 * @returns {{ lineItems: CheckoutLine[], email: string, bookCount: string }}
 */
function validateCanonicalOrder(value) {
	if (!isPlainObject(value) || !isPlainObject(value.guest) || !Array.isArray(value.lineItems)) {
		throw new CheckoutSessionError('Canonical checkout order is invalid');
	}

	const email = assertBoundedString(value.guest.email, 'guest email');
	const lineItems = value.lineItems;

	if (lineItems.length === 0 || lineItems.length > MAX_LINE_ITEMS) {
		throw new CheckoutSessionError('Canonical checkout line items are invalid');
	}

	let bookCount = 0;

	for (const line of lineItems) {
		if (!isCheckoutLine(line) || !['book', 'fee', 'tax'].includes(line.kind)) {
			throw new CheckoutSessionError('Canonical checkout line item is invalid');
		}

		assertBoundedString(line.label, 'checkout line label');
		const quantity = assertPositiveCents(line.quantity, 'checkout line quantity');
		const unitAmountCents = assertPositiveCents(line.unitAmountCents, 'checkout line amount');
		const amountCents = assertPositiveCents(line.amountCents, 'checkout line amount');

		if (amountCents !== quantity * unitAmountCents) {
			throw new CheckoutSessionError('Canonical checkout line amount is invalid');
		}

		if (line.kind === 'book') {
			bookCount += quantity;
		}
	}

	if (!Number.isSafeInteger(bookCount) || bookCount < 1 || bookCount > MAX_BOOK_COUNT) {
		throw new CheckoutSessionError('Canonical book count is invalid');
	}

	return { lineItems, email, bookCount: String(bookCount) };
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
 * @returns {value is string}
 */
export function isSecureCheckoutRedirectUrl(value) {
	if (typeof value !== 'string' || !value || value.length > 2000) {
		return false;
	}

	try {
		const parsed = new URL(value);
		return (
			parsed.protocol === 'https:' &&
			Boolean(parsed.hostname) &&
			!parsed.username &&
			!parsed.password
		);
	} catch {
		return false;
	}
}

/**
 * @param {CheckoutLine} line
 */
function createStripeLineItem(line) {
	return {
		price_data: {
			currency: 'cad',
			product_data: { name: line.label },
			unit_amount: line.unitAmountCents
		},
		quantity: line.quantity
	};
}

/**
 * Creates one hosted Stripe Checkout Session from a trusted, canonical order.
 *
 * @param {unknown} stripe
 * @param {CanonicalCheckoutOrder} order
 * @param {string} origin
 */
export async function createStripeCheckoutSession(stripe, order, origin) {
	if (!isStripeCheckoutClient(stripe)) {
		throw new CheckoutSessionError('Stripe checkout client is invalid');
	}

	const { lineItems, email, bookCount } = validateCanonicalOrder(order);
	const safeOrigin = normalizeOrigin(origin);
	const metadata = {
		service: 'marianopolis-book-delivery',
		fulfillment: 'manual-dashboard-purchase',
		book_count: bookCount
	};
	const session = await stripe.checkout.sessions.create({
		mode: 'payment',
		customer_email: email,
		line_items: lineItems.map(createStripeLineItem),
		metadata,
		payment_intent_data: {
			receipt_email: email,
			metadata
		},
		success_url: new URL('/books/order-confirmation?session_id={CHECKOUT_SESSION_ID}', safeOrigin)
			.href,
		cancel_url: new URL('/books/checkout', safeOrigin).href
	});

	if (!isSecureCheckoutRedirectUrl(session?.url)) {
		throw new CheckoutSessionError('Stripe session redirect URL is invalid');
	}

	return session.url;
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
