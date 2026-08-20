// @ts-nocheck
import { env } from '$env/dynamic/private';
import { createStripeClient } from '$lib/server/books/stripe';
import {
	createStripeWebhookDescriptor,
	retrieveCheckoutEventEvidence,
	retrieveRefundEventSeed,
	retrieveRefundSessionEvidence,
	StripeWebhookEventError,
	StripeWebhookEvidenceError
} from '$lib/server/books/webhook';
import {
	readNotificationRelayEnvironment,
	readStripeWebhookEnvironment
} from '$lib/server/config/environment';
import { withDatabaseTransaction } from '$lib/server/db/transaction';
import {
	loadRefundTargetInTransaction,
	reduceStripeWebhookInTransaction
} from '$lib/server/orders/webhook';
import {
	createSecurityLogger,
	SECURITY_EVENT_CODES,
	SECURITY_REASON_CODES
} from '$lib/server/security/security-logger';
import { createDiscordSink } from '$lib/server/notify/discord.js';
import { createNotificationRelay } from '$lib/server/notify/relay.js';

const MAX_WEBHOOK_BYTES = 64 * 1024;
const MAX_SIGNATURE_LENGTH = 2048;
const ROUTE = '/api/stripe/webhook';
const INVALID_WEBHOOK = 'Webhook could not be verified.';
const UNAVAILABLE = 'Webhook processing is temporarily unavailable.';
const SUCCESS_DISPOSITIONS = new Set([
	'applied',
	'duplicate',
	'stale',
	'ignored_unsupported_type',
	'rejected'
]);
const securityLogger = createSecurityLogger();

async function drainNotifications() {
	return _drainStripeNotifications();
}

/**
 * @param {() => { databaseUrl: string, appOrigin: string, discordWebhookUrl: string | null }} [readEnvironment]
 * @param {typeof createDiscordSink} [createSink]
 * @param {typeof createNotificationRelay} [createRelay]
 */
export async function _drainStripeNotifications(
	readEnvironment = () => readNotificationRelayEnvironment(env),
	createSink = createDiscordSink,
	createRelay = createNotificationRelay
) {
	try {
		const runtime = readEnvironment();
		const sink = runtime.discordWebhookUrl
			? createSink({ webhookUrl: runtime.discordWebhookUrl, appOrigin: runtime.appOrigin })
			: null;
		await createRelay({ databaseUrl: runtime.databaseUrl, sink }).drain({
			limit: 2,
			budgetMs: 2000
		});
	} catch {
		// Stripe has committed before optional notification delivery starts.
	}
}

class WebhookRequestError extends Error {
	/** @param {number} status @param {'invalid_signature' | 'malformed_body'} reason */
	constructor(status, reason) {
		super('Webhook request is invalid');
		this.status = status;
		this.reason = reason;
	}
}

/** @param {Record<string, unknown>} body @param {number} status */
function jsonResponse(body, status) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'cache-control': 'no-store',
			'content-type': 'application/json; charset=utf-8'
		}
	});
}

/** @param {unknown} logger @param {'invalid_signature' | 'malformed_body' | 'provider_mismatch' | 'database_unavailable'} reason @param {number} status */
function logFailure(logger, reason, status) {
	try {
		const destination = /** @type {{ log?: Function }} */ (logger);
		if (typeof destination?.log === 'function') {
			destination.log(SECURITY_EVENT_CODES.webhookVerificationFailed, {
				route: ROUTE,
				reason,
				status
			});
		}
	} catch {
		// Logging is deliberately best effort and must not change the HTTP boundary.
	}
}

/** @param {Request} request */
function validateMediaLengthAndSignature(request) {
	const contentType = request.headers.get('content-type');
	if (
		typeof contentType !== 'string' ||
		!/^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/iu.test(contentType)
	) {
		throw new WebhookRequestError(415, SECURITY_REASON_CODES.malformedBody);
	}
	const contentLength = request.headers.get('content-length');
	if (contentLength !== null) {
		if (!/^\d+$/u.test(contentLength)) {
			throw new WebhookRequestError(400, SECURITY_REASON_CODES.malformedBody);
		}
		if (Number(contentLength) > MAX_WEBHOOK_BYTES) {
			throw new WebhookRequestError(413, SECURITY_REASON_CODES.malformedBody);
		}
	}
	const signature = request.headers.get('stripe-signature');
	if (
		typeof signature !== 'string' ||
		signature.length < 1 ||
		signature.length > MAX_SIGNATURE_LENGTH ||
		/[\p{Cc}]/u.test(signature)
	) {
		throw new WebhookRequestError(400, SECURITY_REASON_CODES.invalidSignature);
	}
	return signature;
}

/** @param {Request} request */
async function readBoundedRawBody(request) {
	if (request.body === null) {
		throw new WebhookRequestError(400, SECURITY_REASON_CODES.malformedBody);
	}
	const reader = request.body.getReader();
	/** @type {Uint8Array[]} */
	const chunks = [];
	let byteLength = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!(value instanceof Uint8Array)) {
				throw new WebhookRequestError(400, SECURITY_REASON_CODES.malformedBody);
			}
			byteLength += value.byteLength;
			if (byteLength > MAX_WEBHOOK_BYTES) {
				try {
					await reader.cancel();
				} catch {
					// Rejection is already final; cancellation is resource cleanup only.
				}
				throw new WebhookRequestError(413, SECURITY_REASON_CODES.malformedBody);
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	if (byteLength === 0) {
		throw new WebhookRequestError(400, SECURITY_REASON_CODES.malformedBody);
	}
	const bytes = new Uint8Array(byteLength);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

/** @param {unknown} runtime */
function runtimeValues(runtime) {
	const candidate = /** @type {Record<string, unknown>} */ (runtime);
	if (
		runtime === null ||
		typeof runtime !== 'object' ||
		typeof candidate.databaseUrl !== 'string' ||
		!candidate.databaseUrl ||
		typeof candidate.stripeSecretKey !== 'string' ||
		!candidate.stripeSecretKey ||
		typeof candidate.stripeWebhookSecret !== 'string' ||
		!candidate.stripeWebhookSecret
	) {
		throw new Error('Webhook runtime is unavailable');
	}
	return /** @type {{ databaseUrl: string, stripeSecretKey: string, stripeWebhookSecret: string }} */ (
		runtime
	);
}

/** @param {unknown} value */
function validClock(value) {
	if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
		throw new Error('Webhook clock is unavailable');
	}
	return value;
}

/**
 * Factory retained for strict boundary and crash-path tests. It intentionally has no launch-state
 * or generic rate-limit dependency: verified provider retries must remain independently reachable.
 *
 * @param {Record<string, any>} [dependencies]
 */
export function _createStripeWebhookEndpoint(dependencies = {}) {
	const environmentSource = dependencies.environmentSource ?? env;
	const readEnvironment =
		dependencies.readEnvironment ?? (() => readStripeWebhookEnvironment(environmentSource));
	const createClient = dependencies.createStripeClient ?? createStripeClient;
	const retrieveCheckoutEvidence =
		dependencies.retrieveCheckoutEvidence ?? retrieveCheckoutEventEvidence;
	const retrieveRefundSeed = dependencies.retrieveRefundSeed ?? retrieveRefundEventSeed;
	const loadRefundTarget = dependencies.loadRefundTarget ?? loadRefundTargetInTransaction;
	const retrieveRefundSession = dependencies.retrieveRefundSession ?? retrieveRefundSessionEvidence;
	const reduceEvent = dependencies.reduceEvent ?? reduceStripeWebhookInTransaction;
	const runTransaction = dependencies.runTransaction ?? withDatabaseTransaction;
	const logger = dependencies.logger ?? securityLogger;
	const getNow = dependencies.getNow ?? (() => new Date());
	const drainRelay = dependencies.drainNotifications ?? drainNotifications;

	/** @param {{ request: Request }} event */
	return async function post({ request }) {
		let runtime;
		try {
			runtime = runtimeValues(readEnvironment());
		} catch {
			return jsonResponse({ error: UNAVAILABLE }, 503);
		}

		let signature;
		let rawBody;
		try {
			signature = validateMediaLengthAndSignature(request);
			rawBody = await readBoundedRawBody(request);
		} catch (error) {
			const status = error instanceof WebhookRequestError ? error.status : 400;
			const reason =
				error instanceof WebhookRequestError ? error.reason : SECURITY_REASON_CODES.malformedBody;
			logFailure(logger, reason, status);
			return jsonResponse({ error: INVALID_WEBHOOK }, status);
		}

		let stripe;
		try {
			stripe = createClient(runtime.stripeSecretKey);
			if (
				stripe === null ||
				typeof stripe !== 'object' ||
				stripe.webhooks === null ||
				typeof stripe.webhooks !== 'object' ||
				typeof stripe.webhooks.constructEventAsync !== 'function'
			) {
				throw new Error('Stripe webhook verifier is unavailable');
			}
		} catch {
			return jsonResponse({ error: UNAVAILABLE }, 503);
		}

		let verifiedEvent;
		try {
			verifiedEvent = await stripe.webhooks.constructEventAsync(
				rawBody,
				signature,
				runtime.stripeWebhookSecret
			);
		} catch (error) {
			const isSignatureError =
				error !== null &&
				typeof error === 'object' &&
				/** @type {{ type?: unknown }} */ (error).type === 'StripeSignatureVerificationError';
			if (!(error instanceof SyntaxError) && !isSignatureError) {
				return jsonResponse({ error: UNAVAILABLE }, 503);
			}
			const reason =
				error instanceof SyntaxError
					? SECURITY_REASON_CODES.malformedBody
					: SECURITY_REASON_CODES.invalidSignature;
			logFailure(logger, reason, 400);
			return jsonResponse({ error: INVALID_WEBHOOK }, 400);
		}

		let descriptor;
		let now;
		try {
			descriptor = createStripeWebhookDescriptor(verifiedEvent, runtime.stripeSecretKey);
			now = validClock(getNow());
		} catch (error) {
			if (error instanceof StripeWebhookEventError) {
				logFailure(logger, SECURITY_REASON_CODES.providerMismatch, 400);
				return jsonResponse({ error: INVALID_WEBHOOK }, 400);
			}
			return jsonResponse({ error: UNAVAILABLE }, 503);
		}

		/** @type {unknown} */
		let evidence;
		/** @type {'provider_mismatch' | undefined} */
		let rejection;
		try {
			if (!descriptor.environmentMatches) {
				rejection = SECURITY_REASON_CODES.providerMismatch;
			} else if (descriptor.kind === 'completed' || descriptor.kind === 'expired') {
				evidence = await retrieveCheckoutEvidence(stripe, descriptor);
			} else if (descriptor.kind === 'refunded') {
				const seed = await retrieveRefundSeed(stripe, descriptor);
				const target = await runTransaction(
					(/** @type {unknown} */ transaction) => loadRefundTarget(transaction, seed),
					{ databaseUrl: runtime.databaseUrl }
				);
				if (target === null || typeof target !== 'object' || typeof target.sessionId !== 'string') {
					rejection = SECURITY_REASON_CODES.providerMismatch;
				} else {
					evidence = await retrieveRefundSession(stripe, seed, target.sessionId, descriptor);
				}
			}
		} catch (error) {
			if (error instanceof StripeWebhookEvidenceError) {
				rejection = SECURITY_REASON_CODES.providerMismatch;
			} else {
				logFailure(logger, SECURITY_REASON_CODES.databaseUnavailable, 503);
				return jsonResponse({ error: UNAVAILABLE }, 503);
			}
		}

		try {
			const result = await runTransaction(
				async (/** @type {unknown} */ transaction) => {
					const candidate = await reduceEvent(transaction, {
						descriptor,
						...(evidence === undefined ? {} : { evidence }),
						...(rejection === undefined ? {} : { rejection }),
						now
					});
					if (
						candidate === null ||
						typeof candidate !== 'object' ||
						!SUCCESS_DISPOSITIONS.has(candidate.disposition)
					) {
						throw new Error('Webhook reducer result is invalid');
					}
					return candidate;
				},
				{ databaseUrl: runtime.databaseUrl }
			);
			if (result.disposition === 'applied') {
				try {
					void drainRelay();
				} catch {
					// Discord outage must not fail the Stripe acknowledgement.
				}
			}
			return jsonResponse({ received: true, disposition: result.disposition }, 200);
		} catch {
			logFailure(logger, SECURITY_REASON_CODES.databaseUnavailable, 503);
			return jsonResponse({ error: UNAVAILABLE }, 503);
		}
	};
}

export const POST = _createStripeWebhookEndpoint();
