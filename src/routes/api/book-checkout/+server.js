// The generated SvelteKit declarations are outside this repository's JS include.
// @ts-ignore
import { env } from '$env/dynamic/private';
import {
	createStripeCheckoutSession,
	createStripeClient,
	CheckoutPreflightError,
	isSecureCheckoutRedirectUrl,
	retrieveReadyStripeCheckoutSession
} from '$lib/server/books/stripe';
import { readBookDeliveryLaunchState } from '$lib/server/books/launch-state';
import { CatalogueInputError } from '$lib/server/catalogue/repository';
import { createRuntimeCatalogueRepository } from '$lib/server/catalogue/runtime';
import { readRuntimeEnvironment } from '$lib/server/config/environment';
import { withDatabaseTransaction } from '$lib/server/db/transaction';
import {
	CheckoutConflictError,
	failCheckoutAttemptInTransaction,
	persistCheckoutSessionInTransaction,
	reserveCheckoutAttemptInTransaction
} from '$lib/server/orders/persistence';
import { confirmationCookieName } from '$lib/server/orders/confirmation';
import { fingerprintCheckoutRequest, normalizeCheckoutRequest } from '$lib/server/orders/request';
import {
	RATE_LIMIT_POLICIES,
	consumeRateLimitInTransaction,
	createCheckoutClientAddressBucketKey,
	createCheckoutEmailBucketKey
} from '$lib/server/security/rate-limit';

const MAX_JSON_REQUEST_BYTES = 16384;
const MAX_PROVIDER_REPLAY_AGE_MS = 23 * 60 * 60 * 1000;
const CONFIRMATION_PATH = '/books/order-confirmation';
const INVALID_REQUEST = 'Checkout request is invalid.';
const ORIGIN_DENIED = 'Checkout request origin is not allowed.';
const UNAVAILABLE = 'Checkout is temporarily unavailable.';
const LIMITED = 'Too many checkout attempts. Try again later.';

class RequestBodyError extends Error {
	/** @param {number} status */
	constructor(status) {
		super('Checkout request body is invalid');
		this.status = status;
	}
}

/** @param {Record<string, string>} body @param {number} status @param {Record<string, string>} [headers] */
function jsonResponse(body, status, headers = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'cache-control': 'no-store',
			'content-type': 'application/json; charset=utf-8',
			...headers
		}
	});
}

/** @param {Request} request */
function validateMediaAndLength(request) {
	const contentType = request.headers.get('content-type');
	if (
		typeof contentType !== 'string' ||
		!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/iu.test(contentType)
	) {
		throw new RequestBodyError(415);
	}
	const contentLength = request.headers.get('content-length');
	if (contentLength !== null) {
		if (!/^\d+$/u.test(contentLength)) throw new RequestBodyError(400);
		if (Number(contentLength) > MAX_JSON_REQUEST_BYTES) throw new RequestBodyError(413);
	}
}

/** @param {Request} request */
async function readBoundedJson(request) {
	validateMediaAndLength(request);
	if (request.body === null) throw new RequestBodyError(400);
	const reader = request.body.getReader();
	const chunks = [];
	let byteLength = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!(value instanceof Uint8Array)) throw new RequestBodyError(400);
			byteLength += value.byteLength;
			if (byteLength > MAX_JSON_REQUEST_BYTES) {
				try {
					await reader.cancel();
				} catch {
					// The request is already rejected; cancellation is only resource cleanup.
				}
				throw new RequestBodyError(413);
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	if (byteLength === 0) throw new RequestBodyError(400);
	const bytes = new Uint8Array(byteLength);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	try {
		return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
	} catch {
		throw new RequestBodyError(400);
	}
}

/** @param {unknown} value */
function exactApplicationOrigin(value) {
	if (typeof value !== 'string') return null;
	try {
		const parsed = new URL(value);
		return parsed.origin === value && parsed.pathname === '/' && !parsed.search && !parsed.hash
			? value
			: null;
	} catch {
		return null;
	}
}

/** @param {unknown} value */
function validAllowedResult(value) {
	return (
		value !== null &&
		typeof value === 'object' &&
		typeof (/** @type {any} */ (value).allowed) === 'boolean' &&
		Number.isSafeInteger(/** @type {any} */ (value).retryAfterSeconds) &&
		/** @type {any} */ (value).retryAfterSeconds >= 0
	);
}

/**
 * @typedef {{ request: Request, url: URL, cookies: { set: Function } }} BookCheckoutEvent
 * @typedef {(event: BookCheckoutEvent) => Promise<Response>} BookCheckoutHandler
 */

/**
 * Factory retained for isolated crash-boundary tests. Production defaults are all server-only and
 * every injected boundary remains behind the launch and input gates.
 *
 * @param {Record<string, any>} [dependencies]
 */
export function _createBookCheckoutEndpoint(dependencies = {}) {
	const getLaunchState = dependencies.getLaunchState ?? readBookDeliveryLaunchState;
	const readEnvironment = dependencies.readEnvironment ?? (() => readRuntimeEnvironment(env));
	const createEmailBucketKey = dependencies.createEmailBucketKey ?? createCheckoutEmailBucketKey;
	const createAddressBucketKey =
		dependencies.createAddressBucketKey ?? createCheckoutClientAddressBucketKey;
	const consumeRateLimit = dependencies.consumeRateLimit ?? consumeRateLimitInTransaction;
	const createRepository =
		dependencies.createRepository ?? (() => createRuntimeCatalogueRepository(env));
	const reserveAttempt = dependencies.reserveAttempt ?? reserveCheckoutAttemptInTransaction;
	const createClient = dependencies.createStripeClient ?? createStripeClient;
	const createSession = dependencies.createCheckoutSession ?? createStripeCheckoutSession;
	const retrieveSession =
		dependencies.retrieveCheckoutSession ?? retrieveReadyStripeCheckoutSession;
	const persistSession = dependencies.persistSession ?? persistCheckoutSessionInTransaction;
	const failAttempt = dependencies.failAttempt ?? failCheckoutAttemptInTransaction;
	const runTransaction = dependencies.runTransaction ?? withDatabaseTransaction;
	const getNow = dependencies.getNow ?? (() => new Date());

	/** @type {BookCheckoutHandler} */
	return async function post({ request, cookies }) {
		if (getLaunchState() !== 'live') return jsonResponse({ error: UNAVAILABLE }, 503);

		let runtime;
		try {
			runtime = readEnvironment();
		} catch {
			return jsonResponse({ error: UNAVAILABLE }, 503);
		}
		const appOrigin = exactApplicationOrigin(runtime?.appOrigin);
		if (!appOrigin) return jsonResponse({ error: UNAVAILABLE }, 503);
		if (request.headers.get('origin') !== appOrigin) {
			return jsonResponse({ error: ORIGIN_DENIED }, 403);
		}

		let requestBody;
		try {
			requestBody = await readBoundedJson(request);
		} catch (error) {
			const status = error instanceof RequestBodyError ? error.status : 400;
			return jsonResponse({ error: INVALID_REQUEST }, status);
		}

		let canonicalRequest;
		let requestFingerprint;
		let now;
		try {
			canonicalRequest = normalizeCheckoutRequest(requestBody);
			requestFingerprint = fingerprintCheckoutRequest(canonicalRequest, {
				integrityKey: runtime.bookCheckoutCapabilityKey
			});
			now = getNow();
			if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error();
		} catch {
			return jsonResponse({ error: INVALID_REQUEST }, 400);
		}

		let limitResults;
		try {
			const emailBucketKey = createEmailBucketKey(canonicalRequest.customerEmail, {
				hmacKey: runtime.rateLimitHmacKey
			});
			const addressBucketKey = createAddressBucketKey(request.headers, {
				hmacKey: runtime.rateLimitHmacKey,
				environment: env
			});
			limitResults = await runTransaction(
				async (/** @type {unknown} */ transaction) => {
					const email = await consumeRateLimit(transaction, {
						bucketKey: emailBucketKey,
						scope: 'checkout_email',
						...RATE_LIMIT_POLICIES.checkout_email,
						now
					});
					const address = await consumeRateLimit(transaction, {
						bucketKey: addressBucketKey,
						scope: 'checkout_client_address',
						...RATE_LIMIT_POLICIES.checkout_client_address,
						now
					});
					return [email, address];
				},
				{ databaseUrl: runtime.databaseUrl }
			);
			if (
				!Array.isArray(limitResults) ||
				limitResults.length !== 2 ||
				limitResults.some((result) => !validAllowedResult(result))
			) {
				throw new Error();
			}
		} catch {
			return jsonResponse({ error: UNAVAILABLE }, 503);
		}
		if (limitResults.some(({ allowed }) => !allowed)) {
			const retryAfter = Math.max(
				...limitResults.map(({ retryAfterSeconds }) => retryAfterSeconds)
			);
			return jsonResponse({ error: LIMITED }, 429, { 'retry-after': String(retryAfter) });
		}

		let reserved;
		try {
			const repository = createRepository();
			reserved = await runTransaction(
				(/** @type {unknown} */ transaction) =>
					reserveAttempt(transaction, {
						canonicalRequest,
						requestFingerprint,
						capabilityKey: runtime.bookCheckoutCapabilityKey,
						now,
						repository
					}),
				{ databaseUrl: runtime.databaseUrl }
			);
		} catch (error) {
			if (error instanceof CheckoutConflictError) {
				return jsonResponse({ error: 'Checkout request conflicts with an earlier attempt.' }, 409);
			}
			if (error instanceof CatalogueInputError) {
				return jsonResponse({ error: INVALID_REQUEST }, 400);
			}
			return jsonResponse({ error: UNAVAILABLE }, 503);
		}

		const attemptStatus = reserved?.attempt?.status;
		const attemptCreatedAt = reserved?.attempt?.createdAt;
		if (!['created', 'ready'].includes(attemptStatus)) {
			return jsonResponse({ error: UNAVAILABLE }, 503);
		}
		if (attemptStatus === 'created') {
			if (
				!(attemptCreatedAt instanceof Date) ||
				!Number.isFinite(attemptCreatedAt.getTime()) ||
				now.getTime() - attemptCreatedAt.getTime() < 0 ||
				now.getTime() - attemptCreatedAt.getTime() > MAX_PROVIDER_REPLAY_AGE_MS
			) {
				return jsonResponse({ error: UNAVAILABLE }, 503);
			}
		}

		let providerSession;
		try {
			const stripe = createClient(runtime.stripeSecretKey);
			const providerOptions = {
				appOrigin,
				stripeCheckoutHost: runtime.stripeCheckoutHost,
				stripeSecretKey: runtime.stripeSecretKey,
				now
			};
			providerSession =
				attemptStatus === 'created'
					? await createSession(stripe, reserved, providerOptions)
					: await retrieveSession(stripe, reserved, providerOptions);
			if (
				providerSession === null ||
				typeof providerSession !== 'object' ||
				!isSecureCheckoutRedirectUrl(providerSession.url, runtime.stripeCheckoutHost)
			) {
				throw new Error();
			}
		} catch (error) {
			if (attemptStatus === 'created' && error instanceof CheckoutPreflightError) {
				try {
					await runTransaction(
						(/** @type {unknown} */ transaction) =>
							failAttempt(transaction, {
								orderId: reserved.order.id,
								attemptId: reserved.attempt.id,
								requestFingerprint: reserved.attempt.requestFingerprint,
								now
							}),
						{ databaseUrl: runtime.databaseUrl }
					);
				} catch {
					// Failure retirement is atomic and fail-closed; never disclose provider state here.
				}
			}
			return jsonResponse({ error: UNAVAILABLE }, 503);
		}

		try {
			await runTransaction(
				(/** @type {unknown} */ transaction) =>
					persistSession(transaction, {
						orderId: reserved.order.id,
						attemptId: reserved.attempt.id,
						requestFingerprint: reserved.attempt.requestFingerprint,
						providerSession,
						now
					}),
				{ databaseUrl: runtime.databaseUrl }
			);
			const expiresAt = reserved.order.confirmationExpiresAt;
			const maxAge = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
			if (
				typeof cookies?.set !== 'function' ||
				typeof reserved.confirmationCapability !== 'string' ||
				!(expiresAt instanceof Date) ||
				!Number.isSafeInteger(maxAge) ||
				maxAge < 1
			) {
				throw new Error();
			}
			cookies.set(
				confirmationCookieName(reserved.order.publicReference),
				reserved.confirmationCapability,
				{
					path: CONFIRMATION_PATH,
					secure: true,
					httpOnly: true,
					sameSite: 'lax',
					maxAge,
					expires: expiresAt
				}
			);
		} catch {
			return jsonResponse({ error: UNAVAILABLE }, 503);
		}

		return jsonResponse({ url: providerSession.url }, 200);
	};
}

export const POST = _createBookCheckoutEndpoint();
