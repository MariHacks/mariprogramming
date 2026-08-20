// The generated SvelteKit declarations are outside this repository's JS include.
// @ts-ignore
import { env } from '$env/dynamic/private';
import { createStripeClient } from '$lib/server/books/stripe.js';
import { readBookDeliveryJobEnvironment } from '$lib/server/config/environment.js';
import { runBookDeliveryJob } from '$lib/server/jobs/book-delivery.js';

const PRIVATE_HEADERS = Object.freeze({
	'cache-control': 'no-store',
	'content-type': 'application/json; charset=utf-8',
	'expires': '0',
	'pragma': 'no-cache',
	'referrer-policy': 'no-referrer',
	'x-robots-tag': 'noindex, nofollow'
});
const MAX_COUNT = 100;

/** @param {Record<string, unknown>} body @param {number} status @param {Record<string, string>} [headers] */
function jsonResponse(body, status, headers = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { ...PRIVATE_HEADERS, ...headers }
	});
}

/** @param {unknown} value */
function runtimeValue(value) {
	if (
		value === null ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		typeof (/** @type {any} */ (value).databaseUrl) !== 'string' ||
		typeof (/** @type {any} */ (value).stripeSecretKey) !== 'string' ||
		!['test', 'live'].includes(/** @type {any} */ (value).stripeMode) ||
		typeof (/** @type {any} */ (value).cronSecret) !== 'string'
	) {
		throw new Error('Scheduled runtime is unavailable');
	}
	return /** @type {any} */ (value);
}

/** @param {unknown} value */
function clock(value) {
	if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
		throw new Error('Scheduled clock is unavailable');
	}
	return value;
}

/** @param {unknown} value */
function reportValue(value) {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Scheduled report is unavailable');
	}
	const report = /** @type {any} */ (value);
	for (const field of [
		'candidates',
		'reconciled',
		'pending',
		'providerFailures',
		'purged',
		'bucketsDeleted'
	]) {
		if (!Number.isSafeInteger(report[field]) || report[field] < 0 || report[field] > MAX_COUNT) {
			throw new Error('Scheduled report is unavailable');
		}
	}
	if (typeof report.retryRequired !== 'boolean') {
		throw new Error('Scheduled report is unavailable');
	}
	return report;
}

/** @param {Record<string, any>} [dependencies] */
export function _createBookDeliveryCronEndpoint(dependencies = {}) {
	const readEnvironment =
		dependencies.readEnvironment ?? (() => readBookDeliveryJobEnvironment(env));
	const createClient = dependencies.createStripeClient ?? createStripeClient;
	const runJob = dependencies.runJob ?? runBookDeliveryJob;
	const getNow = dependencies.getNow ?? (() => new Date());

	/** @param {{ request: Request }} event */
	return async function get({ request }) {
		let runtime;
		try {
			runtime = runtimeValue(readEnvironment());
		} catch {
			return jsonResponse({ error: 'Scheduled work is unavailable' }, 503);
		}

		if (request.headers.get('authorization') !== `Bearer ${runtime.cronSecret}`) {
			return jsonResponse({ error: 'Unauthorized' }, 401, { 'www-authenticate': 'Bearer' });
		}

		try {
			const now = clock(getNow());
			const stripe = createClient(runtime.stripeSecretKey);
			const report = reportValue(
				await runJob({
					databaseUrl: runtime.databaseUrl,
					stripe,
					stripeMode: runtime.stripeMode,
					now
				})
			);
			if (report.retryRequired) {
				return jsonResponse({ error: 'Scheduled work is unavailable' }, 503);
			}
			return jsonResponse(
				{
					ok: true,
					candidates: report.candidates,
					reconciled: report.reconciled,
					pending: report.pending,
					purged: report.purged,
					bucketsDeleted: report.bucketsDeleted
				},
				200
			);
		} catch {
			return jsonResponse({ error: 'Scheduled work is unavailable' }, 503);
		}
	};
}

export const GET = _createBookDeliveryCronEndpoint();

/** @param {{ request: Request }} _event */
export function HEAD(_event) {
	void _event;
	return new Response(null, {
		status: 405,
		headers: { ...PRIVATE_HEADERS, allow: 'GET' }
	});
}
