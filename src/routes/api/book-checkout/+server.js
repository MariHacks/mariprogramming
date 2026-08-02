// The project JS include omits SvelteKit's generated ambient declarations; Vite still resolves this server-only module.
// @ts-ignore
import { env } from '$env/dynamic/private';
import { createCheckoutOrder } from '$lib/books/checkout';
import {
	createStripeCheckoutSession,
	createStripeClient,
	isSecureCheckoutRedirectUrl
} from '$lib/server/books/stripe';

const MAX_JSON_REQUEST_BYTES = 16384;
const INVALID_REQUEST = 'Checkout request is invalid.';
const UNAVAILABLE = 'Card checkout is temporarily unavailable.';

/**
 * @param {Record<string, string>} body
 * @param {number} status
 */
function jsonResponse(body, status) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'cache-control': 'no-store',
			'content-type': 'application/json; charset=utf-8'
		}
	});
}

/**
 * @param {Request} request
 */
function hasJsonContentType(request) {
	const contentType = request.headers.get('content-type');
	return contentType?.split(';', 1)[0].trim().toLowerCase() === 'application/json';
}

/**
 * @param {Request} request
 * @param {URL} url
 */
function hasSameOrigin(request, url) {
	const origin = request.headers.get('origin');

	if (origin === null) {
		return true;
	}

	try {
		return new URL(origin).origin === url.origin;
	} catch {
		return false;
	}
}

/**
 * @param {Request} request
 */
async function readBoundedJson(request) {
	if (!hasJsonContentType(request)) {
		throw new Error('Expected JSON');
	}

	const contentLength = request.headers.get('content-length');

	if (
		contentLength !== null &&
		(!/^\d+$/u.test(contentLength) || Number(contentLength) > MAX_JSON_REQUEST_BYTES)
	) {
		throw new Error('Request body is too large');
	}

	const body = await request.text();

	if (new TextEncoder().encode(body).byteLength > MAX_JSON_REQUEST_BYTES) {
		throw new Error('Request body is too large');
	}

	return JSON.parse(body);
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function hasConfiguredSecret(value) {
	return typeof value === 'string' && Boolean(value.trim());
}

/**
 * @typedef {{ request: Request, url: URL }} BookCheckoutEvent
 */

/**
 * @typedef {(event: BookCheckoutEvent) => Promise<Response>} BookCheckoutHandler
 */

/**
 * @typedef {{
 *   createOrder?: (request: unknown) => ReturnType<typeof createCheckoutOrder>,
 *   getSecretKey?: () => unknown,
 *   createStripeClient?: (secretKey: string) => unknown,
 *   createCheckoutSession?: (
 *     stripe: unknown,
 *     order: ReturnType<typeof createCheckoutOrder>,
 *     origin: string
 *   ) => Promise<unknown>
 * }} CheckoutEndpointDependencies
 */

/**
 * Factory retained for isolated server tests. Production uses only its server-only defaults.
 *
 * @param {CheckoutEndpointDependencies} [dependencies]
 */
export function _createBookCheckoutEndpoint(dependencies = {}) {
	const createOrder = dependencies.createOrder ?? createCheckoutOrder;
	const getSecretKey = dependencies.getSecretKey ?? (() => env.STRIPE_SECRET_KEY);
	const createClient = dependencies.createStripeClient ?? createStripeClient;
	const createSession = dependencies.createCheckoutSession ?? createStripeCheckoutSession;

	/** @type {BookCheckoutHandler} */
	const post = async ({ request, url }) => {
		if (!hasSameOrigin(request, url)) {
			return jsonResponse({ error: 'Checkout request origin is not allowed.' }, 403);
		}

		let checkoutRequest;

		try {
			checkoutRequest = await readBoundedJson(request);
		} catch {
			return jsonResponse({ error: INVALID_REQUEST }, 400);
		}

		let order;

		try {
			order = createOrder(checkoutRequest);
		} catch {
			return jsonResponse({ error: INVALID_REQUEST }, 400);
		}

		let secretKey;

		try {
			secretKey = getSecretKey();
		} catch {
			return jsonResponse({ error: UNAVAILABLE }, 503);
		}

		if (!hasConfiguredSecret(secretKey)) {
			return jsonResponse({ error: UNAVAILABLE }, 503);
		}

		try {
			const stripe = createClient(secretKey);
			const sessionUrl = await createSession(stripe, order, url.origin);

			if (!isSecureCheckoutRedirectUrl(sessionUrl)) {
				throw new Error('Provider returned an invalid redirect URL');
			}

			return jsonResponse({ url: sessionUrl }, 200);
		} catch {
			return jsonResponse({ error: UNAVAILABLE }, 502);
		}
	};

	return post;
}

export const POST = _createBookCheckoutEndpoint();
