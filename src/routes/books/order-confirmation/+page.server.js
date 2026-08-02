// The project JS include omits SvelteKit's generated ambient declarations; Vite still resolves this server-only module.
// @ts-ignore
import { env } from '$env/dynamic/private';
import { createStripeClient, retrieveStripeCheckoutSession } from '$lib/server/books/stripe';

const MAX_SESSION_ID_LENGTH = 255;
const MAX_LINE_ITEMS = 65;
const MAX_LINE_TITLE_LENGTH = 240;
const MAX_RECEIPT_EMAIL_LENGTH = 254;
const RETURN_PATH = '/books/cart';

export const prerender = false;

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {unknown} value
 */
function isCheckoutSessionId(value) {
	return (
		typeof value === 'string' &&
		value.length <= MAX_SESSION_ID_LENGTH &&
		/^cs_[A-Za-z0-9_]+$/u.test(value)
	);
}

/**
 * @param {'missing' | 'invalid' | 'unpaid' | 'expired' | 'unavailable'} reason
 */
function recovery(reason) {
	return {
		confirmation: {
			status: 'recovery',
			reason,
			returnPath: RETURN_PATH
		}
	};
}

/**
 * @param {unknown} value
 * @param {number} maximumLength
 */
function normalizeDisplayText(value, maximumLength) {
	if (typeof value !== 'string') return null;

	const normalized = value.trim().replace(/\s+/gu, ' ');
	return normalized && normalized.length <= maximumLength ? normalized : null;
}

/**
 * @param {unknown} value
 */
function normalizeReceiptEmail(value) {
	const email = normalizeDisplayText(value, MAX_RECEIPT_EMAIL_LENGTH);
	return email?.includes('@') ? email : null;
}

/**
 * @param {Record<string, unknown>} session
 */
function projectReceiptEmail(session) {
	const customerDetails = isRecord(session.customer_details) ? session.customer_details : null;

	return (
		normalizeReceiptEmail(customerDetails?.email) ?? normalizeReceiptEmail(session.customer_email)
	);
}

/**
 * @param {Record<string, unknown>} session
 */
function projectLineItems(session) {
	const lineItems = isRecord(session.line_items) ? session.line_items : null;
	if (!Array.isArray(lineItems?.data)) return [];

	return lineItems.data.slice(0, MAX_LINE_ITEMS).flatMap((line) => {
		if (!isRecord(line)) return [];

		const title = normalizeDisplayText(line.description, MAX_LINE_TITLE_LENGTH);
		const quantity = line.quantity;
		if (
			!title ||
			typeof quantity !== 'number' ||
			!Number.isSafeInteger(quantity) ||
			quantity < 1 ||
			quantity > 99
		) {
			return [];
		}

		return [{ title, quantity }];
	});
}

/** @param {{ url: URL }} event */
export async function load({ url }) {
	const sessionId = url.searchParams.get('session_id');

	if (sessionId === null) return recovery('missing');
	if (!isCheckoutSessionId(sessionId)) return recovery('invalid');

	try {
		const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
		const session = await retrieveStripeCheckoutSession(stripe, sessionId);

		if (!isRecord(session) || session.id !== sessionId) return recovery('unavailable');
		if (session.status === 'expired') return recovery('expired');
		if (session.status !== 'complete' || session.payment_status !== 'paid') {
			return recovery('unpaid');
		}

		return {
			confirmation: {
				status: 'paid',
				orderReference: sessionId,
				receiptEmail: projectReceiptEmail(session),
				lineItems: projectLineItems(session)
			}
		};
	} catch {
		return recovery('unavailable');
	}
}
