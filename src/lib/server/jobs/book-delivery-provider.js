import { retrieveCheckoutEventEvidence } from '../books/webhook.js';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SESSION_ID_PATTERN = /^cs_(?:test|live)_[A-Za-z0-9_]{1,240}$/u;

export class BookDeliveryProviderError extends Error {
	constructor() {
		super('Book Delivery provider reconciliation is unavailable');
		this.name = 'BookDeliveryProviderError';
		this.code = 'BOOK_DELIVERY_PROVIDER_UNAVAILABLE';
	}
}

/** @returns {never} */
function unavailable() {
	throw new BookDeliveryProviderError();
}

/** @param {unknown} value */
function candidateValue(value) {
	if (
		value === null ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		/** @type {any} */ (value).kind !== 'ready' ||
		!UUID_V4_PATTERN.test(/** @type {any} */ (value).orderId) ||
		!UUID_V4_PATTERN.test(/** @type {any} */ (value).attemptId) ||
		!SESSION_ID_PATTERN.test(/** @type {any} */ (value).sessionId)
	) {
		unavailable();
	}
	return /** @type {any} */ (value);
}

/**
 * A preliminary retrieval determines which strict, already-reviewed provider validator to run.
 * The strict validator retrieves the object again and binds every persisted service fact.
 *
 * @param {unknown} stripe
 * @param {unknown} rawCandidate
 * @param {{ stripeMode: unknown, retrieveCheckoutEvidence?: typeof retrieveCheckoutEventEvidence }} options
 */
export async function retrieveReconciliationEvidence(
	stripe,
	rawCandidate,
	{ stripeMode, retrieveCheckoutEvidence = retrieveCheckoutEventEvidence }
) {
	try {
		const candidate = candidateValue(rawCandidate);
		if (
			!['test', 'live'].includes(/** @type {string} */ (stripeMode)) ||
			stripe === null ||
			typeof stripe !== 'object' ||
			/** @type {any} */ (stripe).checkout === null ||
			typeof (/** @type {any} */ (stripe).checkout) !== 'object' ||
			/** @type {any} */ (stripe).checkout.sessions === null ||
			typeof (/** @type {any} */ (stripe).checkout.sessions) !== 'object' ||
			typeof (/** @type {any} */ (stripe).checkout.sessions.retrieve) !== 'function' ||
			typeof retrieveCheckoutEvidence !== 'function'
		) {
			unavailable();
		}
		const preliminary = await /** @type {any} */ (stripe).checkout.sessions.retrieve(
			candidate.sessionId
		);
		if (
			preliminary === null ||
			typeof preliminary !== 'object' ||
			Array.isArray(preliminary) ||
			/** @type {any} */ (preliminary).id !== candidate.sessionId ||
			/** @type {any} */ (preliminary).livemode !== (stripeMode === 'live')
		) {
			unavailable();
		}
		const status = /** @type {any} */ (preliminary).status;
		const paymentStatus = /** @type {any} */ (preliminary).payment_status;
		if (status === 'open' && paymentStatus === 'unpaid') return null;
		const kind =
			status === 'expired' && paymentStatus === 'unpaid'
				? 'expired'
				: status === 'complete' && paymentStatus === 'paid'
					? 'completed'
					: null;
		if (kind === null) unavailable();
		const mode = /** @type {'test' | 'live'} */ (stripeMode);
		return await retrieveCheckoutEvidence(stripe, {
			id: `evt_reconcile_${candidate.attemptId.replaceAll('-', '')}`,
			type: `checkout.session.${kind === 'completed' ? 'completed' : 'expired'}`,
			mode,
			kind,
			objectId: candidate.sessionId,
			environmentMatches: true
		});
	} catch (error) {
		if (error instanceof BookDeliveryProviderError) throw error;
		unavailable();
	}
}
