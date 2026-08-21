import { readOrderConfirmationAccessEnvironment } from '$lib/server/config/environment.js';
import { readBookDeliveryLaunchState } from '$lib/server/books/launch-state.js';
import { withDatabaseTransaction } from '$lib/server/db/transaction.js';
import {
	confirmationCookieName,
	loadOrderConfirmationInTransaction
} from '$lib/server/orders/confirmation.js';

const PUBLIC_REFERENCE_PATTERN = /^MPC-[A-HJ-NP-Z2-9]{12}$/u;
const CAPABILITY_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const MAX_BODY_BYTES = 128;
const CONFIRMATION_PATH = '/books/order-confirmation';
const PRIVATE_HEADERS = Object.freeze({
	'cache-control': 'private, no-cache, no-store, max-age=0, must-revalidate',
	'referrer-policy': 'no-referrer',
	'x-robots-tag': 'noindex, nofollow'
});

/** @param {number} status */
function response(status) {
	return new Response(null, { status, headers: PRIVATE_HEADERS });
}

/** @param {Record<string, any>} [dependencies] */
export function _createEmailedOrderAccessEndpoint(dependencies = {}) {
	const getLaunchState = dependencies.getLaunchState ?? readBookDeliveryLaunchState;
	const readEnvironment =
		dependencies.readEnvironment ?? (() => readOrderConfirmationAccessEnvironment());
	const runTransaction = dependencies.runTransaction ?? withDatabaseTransaction;
	const loadConfirmation = dependencies.loadConfirmation ?? loadOrderConfirmationInTransaction;
	const getNow = dependencies.getNow ?? (() => new Date());

	return async function POST(
		/** @type {{ request: Request, params?: { orderReference?: string }, cookies: { set: Function } }} */ {
			request,
			params,
			cookies
		}
	) {
		if (getLaunchState() !== 'live') return response(404);
		let runtime;
		try {
			runtime = readEnvironment();
		} catch {
			return response(503);
		}
		if (request.headers.get('origin') !== runtime.appOrigin) return response(403);
		if (request.headers.get('content-type') !== 'application/json') return response(415);
		const declaredLength = request.headers.get('content-length');
		if (
			declaredLength !== null &&
			(!/^\d+$/u.test(declaredLength) || Number(declaredLength) > MAX_BODY_BYTES)
		) {
			return response(Number(declaredLength) > MAX_BODY_BYTES ? 413 : 400);
		}
		const publicReference = params?.orderReference;
		if (typeof publicReference !== 'string' || !PUBLIC_REFERENCE_PATTERN.test(publicReference)) {
			return response(404);
		}
		let rawBody;
		try {
			rawBody = await request.text();
		} catch {
			return response(400);
		}
		if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return response(413);
		let capability;
		try {
			const body = JSON.parse(rawBody);
			if (
				body === null ||
				typeof body !== 'object' ||
				Array.isArray(body) ||
				Object.keys(body).length !== 1 ||
				typeof body.capability !== 'string' ||
				!CAPABILITY_PATTERN.test(body.capability)
			) {
				return response(400);
			}
			capability = body.capability;
		} catch {
			return response(400);
		}

		try {
			const confirmation = await runTransaction(
				(/** @type {unknown} */ transaction) =>
					loadConfirmation(transaction, {
						publicReference,
						capability,
						now: getNow()
					}),
				{ databaseUrl: runtime.databaseUrl }
			);
			if (!confirmation || confirmation.orderReference !== publicReference) return response(404);
			cookies.set(confirmationCookieName(publicReference), capability, {
				path: CONFIRMATION_PATH,
				secure: true,
				httpOnly: true,
				sameSite: 'lax',
				maxAge: 24 * 60 * 60
			});
			return response(204);
		} catch {
			return response(503);
		}
	};
}

export const POST = _createEmailedOrderAccessEndpoint();
