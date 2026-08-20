import { readOrderConfirmationEnvironment } from '$lib/server/config/environment';
import { withDatabaseTransaction } from '$lib/server/db/transaction';
import {
	confirmationCookieName,
	loadOrderConfirmationInTransaction
} from '$lib/server/orders/confirmation';

const PUBLIC_REFERENCE_PATTERN = /^MPC-[A-HJ-NP-Z2-9]{12}$/u;
const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const CONFIRMATION_STATES = new Set([
	'processing',
	'paid',
	'partially_refunded',
	'refunded',
	'expired',
	'failed',
	'cancelled'
]);
const PRIVATE_HEADERS = Object.freeze({
	'cache-control': 'private, no-cache, no-store, max-age=0, must-revalidate',
	expires: '0',
	pragma: 'no-cache',
	'referrer-policy': 'no-referrer',
	'x-robots-tag': 'noindex, nofollow'
});

export const prerender = false;

function unavailable() {
	return { confirmation: { status: 'unavailable', returnPath: '/books/cart' } };
}

/** @param {unknown} value @param {string} reference */
function isConfirmation(value, reference) {
	return (
		value !== null &&
		typeof value === 'object' &&
		!Array.isArray(value) &&
		CONFIRMATION_STATES.has(/** @type {any} */ (value).state) &&
		/** @type {any} */ (value).orderReference === reference
	);
}

/**
 * @param {Record<string, any>} [dependencies]
 */
export function _createOrderConfirmationLoader(dependencies = {}) {
	const readEnvironment =
		dependencies.readEnvironment ?? (() => readOrderConfirmationEnvironment());
	const runTransaction = dependencies.runTransaction ?? withDatabaseTransaction;
	const loadConfirmation = dependencies.loadConfirmation ?? loadOrderConfirmationInTransaction;
	const getNow = dependencies.getNow ?? (() => new Date());

	return async function orderConfirmationLoad(
		/** @type {{ params?: { orderReference?: string }, cookies?: { get: (name: string) => string | undefined }, parent: () => Promise<unknown>, setHeaders: (headers: Record<string, string>) => void }} */ {
			params,
			cookies,
			parent,
			setHeaders
		}
	) {
		await parent();
		setHeaders(PRIVATE_HEADERS);
		const publicReference = params?.orderReference;
		if (typeof publicReference !== 'string' || !PUBLIC_REFERENCE_PATTERN.test(publicReference)) {
			return unavailable();
		}
		let capability;
		try {
			capability = cookies?.get(confirmationCookieName(publicReference));
		} catch {
			return unavailable();
		}
		if (typeof capability !== 'string' || !CAPABILITY_PATTERN.test(capability)) {
			return unavailable();
		}

		try {
			const runtime = readEnvironment();
			const confirmation = await runTransaction(
				(/** @type {unknown} */ transaction) =>
					loadConfirmation(transaction, {
						publicReference,
						capability,
						now: getNow()
					}),
				{ databaseUrl: runtime.databaseUrl }
			);
			return isConfirmation(confirmation, publicReference) ? { confirmation } : unavailable();
		} catch {
			return unavailable();
		}
	};
}

export const load = _createOrderConfirmationLoader();
