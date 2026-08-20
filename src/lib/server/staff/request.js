import { randomUUID } from 'node:crypto';
import { requireStaff } from '../auth/authorization.js';
import { readStaffCatalogueEnvironment } from '../config/environment.js';
import { withDatabaseTransaction } from '../db/transaction.js';
import {
	RATE_LIMIT_POLICIES,
	consumeRateLimitInTransaction,
	createStaffActionBucketKey,
	createStaffSessionBucketKey
} from '../security/rate-limit.js';
import { createSecurityLogger } from '../security/security-logger.js';

const MAX_FORM_BYTES = 16384;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const FORM_CONTENT_TYPE =
	/^application\/x-www-form-urlencoded(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/iu;
const STAFF_MUTATION_ROUTES = new Set([
	'/staff',
	'/staff/book-work',
	'/staff/book-requests/[requestId]',
	'/staff/catalogue',
	'/staff/orders/[orderId]',
	'/staff/orders/export'
]);

export class StaffActionRequestError extends Error {
	/**
	 * @param {number} status
	 * @param {number} [retryAfterSeconds]
	 * @param {{ recordId: string } | null} [context]
	 */
	constructor(status, retryAfterSeconds = 0, context = null) {
		super('Staff request is invalid');
		this.name = 'StaffActionRequestError';
		this.status = status;
		this.retryAfterSeconds = retryAfterSeconds;
		this.context = context ? Object.freeze({ recordId: context.recordId }) : null;
	}
}

/**
 * @param {number} status
 * @param {number} [retryAfterSeconds]
 * @param {{ recordId: string } | null} [context]
 * @returns {never}
 */
function rejectRequest(status, retryAfterSeconds = 0, context = null) {
	throw new StaffActionRequestError(status, retryAfterSeconds, context);
}

/** @param {unknown} fields */
function normalizeFields(fields) {
	if (
		!Array.isArray(fields) ||
		fields.length === 0 ||
		fields.length > 16 ||
		new Set(fields).size !== fields.length ||
		fields.some((field) => typeof field !== 'string' || !/^[a-z][A-Za-z0-9]{0,63}$/u.test(field))
	) {
		rejectRequest(503);
	}
	return /** @type {string[]} */ (fields);
}

/** @param {Request} request */
function validateFormMedia(request) {
	const contentType = request.headers.get('content-type');
	if (typeof contentType !== 'string' || !FORM_CONTENT_TYPE.test(contentType)) {
		rejectRequest(415);
	}
	const contentLength = request.headers.get('content-length');
	if (contentLength !== null) {
		if (!/^\d+$/u.test(contentLength)) rejectRequest(400);
		if (Number(contentLength) > MAX_FORM_BYTES) rejectRequest(413);
	}
}

/** @param {Request} request */
async function readFormText(request) {
	validateFormMedia(request);
	if (request.body === null) rejectRequest(400);
	const reader = request.body.getReader();
	/** @type {Uint8Array[]} */
	const chunks = [];
	let byteLength = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			if (!(value instanceof Uint8Array)) rejectRequest(400);
			byteLength += value.byteLength;
			if (byteLength > MAX_FORM_BYTES) {
				try {
					await reader.cancel();
				} catch {
					// The body is already rejected. Cancellation is only resource cleanup.
				}
				rejectRequest(413);
			}
			chunks.push(value);
		}
	} catch (error) {
		if (error instanceof StaffActionRequestError) throw error;
		rejectRequest(400);
	} finally {
		try {
			reader.releaseLock();
		} catch {
			// Lock release cannot change a rejection or a successfully consumed body.
		}
	}
	if (byteLength === 0) rejectRequest(400);

	const body = new Uint8Array(byteLength);
	let offset = 0;
	for (const chunk of chunks) {
		body.set(chunk, offset);
		offset += chunk.byteLength;
	}
	try {
		return new TextDecoder('utf-8', { fatal: true }).decode(body);
	} catch {
		return rejectRequest(400);
	}
}

/**
 * Reads a urlencoded form without allowing framework parsing to bypass the byte bound.
 *
 * @param {Request} request
 * @param {unknown} expectedFields
 */
export async function readBoundedStaffForm(request, expectedFields) {
	const fields = normalizeFields(expectedFields);
	const raw = await readFormText(request);
	if (/%(?![0-9a-f]{2})/iu.test(raw)) rejectRequest(400);
	try {
		decodeURIComponent(raw.replaceAll('+', ' '));
	} catch {
		rejectRequest(400);
	}
	const form = new URLSearchParams(raw);
	if ([...form.keys()].some((key) => !fields.includes(key))) rejectRequest(400);

	/** @type {Record<string, string>} */
	const values = {};
	for (const field of fields) {
		const entries = form.getAll(field);
		if (entries.length !== 1) rejectRequest(400);
		values[field] = /** @type {string} */ (entries[0]);
	}
	return values;
}

/**
 * Keeps one opaque record identifier for a bounded error response. No other
 * submitted field is retained when the mutation guard rejects the request.
 *
 * @param {Record<string, string>} form
 * @param {string[]} fields
 * @param {unknown} contextField
 */
function selectRecordContext(form, fields, contextField) {
	if (contextField === undefined) return null;
	if (contextField !== 'id' || !fields.includes(contextField)) rejectRequest(503);
	const recordId = form[contextField];
	return UUID_PATTERN.test(recordId) ? Object.freeze({ recordId }) : null;
}

/** @param {unknown} value */
function normalizeMutationRoute(value) {
	const route = value === undefined ? '/staff/catalogue' : value;
	if (typeof route !== 'string' || !STAFF_MUTATION_ROUTES.has(route)) rejectRequest(503);
	return route;
}

/** @param {unknown} value */
function validRateResult(value) {
	return (
		value !== null &&
		typeof value === 'object' &&
		typeof (/** @type {any} */ (value).allowed) === 'boolean' &&
		Number.isSafeInteger(/** @type {any} */ (value).retryAfterSeconds) &&
		/** @type {any} */ (value).retryAfterSeconds >= 0
	);
}

/**
 * @param {Record<string, any>} [dependencies]
 */
export function _createGuardStaffMutation(dependencies = {}) {
	const authorize = dependencies.requireStaff ?? requireStaff;
	const readEnvironment = dependencies.readEnvironment ?? readStaffCatalogueEnvironment;
	const consume = dependencies.consumeRateLimit ?? consumeRateLimitInTransaction;
	const runTransaction = dependencies.runTransaction ?? withDatabaseTransaction;
	const createSessionBucketKey = dependencies.createSessionBucketKey ?? createStaffSessionBucketKey;
	const createActionBucketKey = dependencies.createActionBucketKey ?? createStaffActionBucketKey;
	const createLogger = dependencies.createLogger ?? createSecurityLogger;
	const getNow = dependencies.getNow ?? (() => new Date());
	const createRequestId = dependencies.createRequestId ?? randomUUID;

	/**
	 * @param {{ request: Request, locals: any, setHeaders?: (headers: Record<string, string>) => void }} event
	 * @param {{ action: string, fields: string[], contextField?: 'id', route?: string }} options
	 */
	return async function guardStaffMutation(
		event,
		{ action, fields, contextField, route: rawRoute }
	) {
		const staff = authorize(event.locals);
		const form = await readBoundedStaffForm(event.request, fields);
		const context = selectRecordContext(form, fields, contextField);
		const route = normalizeMutationRoute(rawRoute);
		let runtime;
		try {
			runtime = readEnvironment();
		} catch {
			return rejectRequest(503, 0, context);
		}

		if (event.request.headers.get('origin') !== runtime?.appOrigin) rejectRequest(403);

		const now = getNow();
		const requestId = createRequestId();
		if (
			!(now instanceof Date) ||
			!Number.isFinite(now.getTime()) ||
			typeof requestId !== 'string' ||
			!UUID_PATTERN.test(requestId)
		) {
			rejectRequest(503, 0, context);
		}

		let rateResults;
		const logger = createLogger();
		try {
			const sessionBucketKey = createSessionBucketKey(staff.sessionId, {
				hmacKey: runtime.rateLimitHmacKey
			});
			const actionBucketKey = createActionBucketKey(
				{ sessionId: staff.sessionId, action },
				{ hmacKey: runtime.rateLimitHmacKey }
			);
			rateResults = await runTransaction(
				async (/** @type {unknown} */ transaction) => [
					await consume(transaction, {
						bucketKey: sessionBucketKey,
						scope: 'staff_session',
						...RATE_LIMIT_POLICIES.staff_session,
						now
					}),
					await consume(transaction, {
						bucketKey: actionBucketKey,
						scope: 'staff_action',
						...RATE_LIMIT_POLICIES.staff_action,
						now
					})
				],
				{ databaseUrl: runtime.databaseUrl }
			);
			if (
				!Array.isArray(rateResults) ||
				rateResults.length !== 2 ||
				rateResults.some((result) => !validRateResult(result))
			) {
				throw new Error('invalid rate result');
			}
		} catch (error) {
			logger.log('rate_limit_unavailable', {
				route,
				reason: 'database_unavailable',
				scope: 'staff_action',
				status: 503,
				error
			});
			return rejectRequest(503, 0, context);
		}

		if (rateResults.some(({ allowed }) => !allowed)) {
			const retryAfterSeconds = Math.max(
				...rateResults.map(({ retryAfterSeconds: seconds }) => seconds)
			);
			event.setHeaders?.({ 'retry-after': String(retryAfterSeconds) });
			logger.log('rate_limit_denied', {
				route,
				reason: 'limit_exceeded',
				scope: 'staff_action',
				status: 429,
				retryAfterSeconds
			});
			return rejectRequest(429, retryAfterSeconds, context);
		}

		return { staff, form, requestId, runtime };
	};
}

export const guardStaffMutation = _createGuardStaffMutation();
