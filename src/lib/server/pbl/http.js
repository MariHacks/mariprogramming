import { json } from '@sveltejs/kit';
import { withDatabaseTransaction } from '../db/transaction.js';
import { readPblEnvironment } from '../config/environment.js';
import { generateMemberId } from './ids.js';
import { memberCookie, readMemberId } from './cookie.js';
import { ensurePblSchemaAvailable } from './bootstrap.js';
import {
	PblConflictError,
	PblFullError,
	PblInputError,
	PblNotFoundError,
	createDrizzlePblRepository,
	createPblStore,
	getSharedMemoryPblRepository
} from './store.js';

const MAX_JSON_BYTES = 400000;
const UNAVAILABLE = 'The workshop room service is unavailable.';

/** @param {unknown} error */
export function pblErrorResponse(error) {
	if (
		error instanceof PblInputError ||
		error instanceof PblNotFoundError ||
		error instanceof PblFullError
	) {
		return json(
			{ error: error.message },
			{ status: error.status, headers: { 'cache-control': 'no-store' } }
		);
	}
	if (error instanceof PblConflictError) {
		return json(
			{ error: error.message, conflict: true, room: error.room },
			{ status: 409, headers: { 'cache-control': 'no-store' } }
		);
	}
	const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
	const name = error instanceof Error ? error.name : 'Error';
	const message = (error instanceof Error ? error.message : String(error))
		.replace(/postgres(?:ql)?:\/\/\S+/gi, '[db]')
		.replace(/[\w.-]+\.neon\.tech\S*/gi, '[host]')
		.slice(0, 180);
	console.error('pbl_unavailable', name, code, message);
	return json({ error: UNAVAILABLE }, { status: 503, headers: { 'cache-control': 'no-store' } });
}

/** @param {any} body @param {number} [status] @param {Record<string, string>} [headers] */
export function pblJson(body, status = 200, headers = {}) {
	return json(body, {
		status,
		headers: { 'cache-control': 'no-store', ...headers }
	});
}

/** @param {Request} request */
export async function readPblJson(request) {
	const contentType = request.headers.get('content-type') ?? '';
	if (!/^application\/json\b/iu.test(contentType)) {
		throw new PblInputError('Send JSON.');
	}
	const contentLength = request.headers.get('content-length');
	if (
		contentLength !== null &&
		(!/^\d+$/u.test(contentLength) || Number(contentLength) > MAX_JSON_BYTES)
	) {
		throw new PblInputError('Request is too large.', 413);
	}
	const raw = await request.text();
	if (raw.length > MAX_JSON_BYTES) throw new PblInputError('Request is too large.', 413);
	try {
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new PblInputError('Send a JSON object.');
		}
		return parsed;
	} catch (error) {
		if (error instanceof PblInputError) throw error;
		throw new PblInputError('Send JSON.');
	}
}

/**
 * @param {Request} request
 * @param {{ url?: URL }} event
 * @param {{ memberId?: string | null }} [known]
 */

/**
 * Club Google session required to create or join a PBL team.
 * @param {App.Locals | { maritools?: { userId?: string } | null } | null | undefined} locals
 * @returns {{ userId: string }}
 */
export function requirePblSession(locals) {
	const userId = locals?.maritools?.userId;
	if (typeof userId !== 'string' || userId.length === 0) {
		throw new PblInputError(
			'Sign in with your club Google account to create or join a team.',
			401
		);
	}
	return { userId };
}

export function memberFromRequest(request, event, known = {}) {
	const existing = known.memberId ?? readMemberId(request.headers.get('cookie'));
	if (existing) return { memberId: existing, setCookie: null };
	const memberId = generateMemberId();
	const secure = event.url ? event.url.protocol === 'https:' : false;
	return { memberId, setCookie: memberCookie(memberId, { secure }) };
}

/**
 * @param {{
 *   readEnvironment?: typeof readPblEnvironment,
 *   ensureSchema?: typeof ensurePblSchemaAvailable,
 *   withTransaction?: typeof withDatabaseTransaction,
 *   createStore?: typeof createPblStore,
 *   createRepository?: typeof createDrizzlePblRepository
 * }} [dependencies]
 */
export function createPblRuntime(dependencies = {}) {
	const readEnvironment = dependencies.readEnvironment ?? readPblEnvironment;
	const ensureSchema = dependencies.ensureSchema ?? ensurePblSchemaAvailable;
	const withTransaction = dependencies.withTransaction ?? withDatabaseTransaction;
	const createStore = dependencies.createStore ?? createPblStore;
	const createRepository = dependencies.createRepository ?? createDrizzlePblRepository;

	/**
	 * @template T
	 * @param {(store: ReturnType<typeof createPblStore>) => Promise<T>} operation
	 */
	async function withStore(operation) {
		/** @type {string | undefined} */
		let databaseUrl;
		try {
			databaseUrl = readEnvironment().databaseUrl;
		} catch {
			return operation(createStore(getSharedMemoryPblRepository()));
		}
		try {
			await ensureSchema();
		} catch (error) {
			const message = (error instanceof Error ? error.message : String(error))
				.replace(/postgres(?:ql)?:\/\/\S+/gi, '[db]')
				.slice(0, 120);
			console.error('pbl_schema_ensure_failed', message);
		}
		const run = (overrides = {}) =>
			withTransaction(
				async (transaction) => {
					return operation(createStore(createRepository(transaction)));
				},
				{ databaseUrl, ...overrides }
			);
		try {
			return await run();
		} catch (error) {
			const message = (error instanceof Error ? error.message : String(error))
				.replace(/postgres(?:ql)?:\/\/\S+/gi, '[db]')
				.replace(/[\w.-]+\.neon\.tech\S*/gi, '[host]')
				.slice(0, 180);
			console.error('pbl_neon_failed', error instanceof Error ? error.name : 'Error', message);
			const { default: pg } = await import('pg');
			const { drizzle: drizzlePostgres } = await import('drizzle-orm/node-postgres');
			const schema = await import('../db/schema');
			return run({
				createPool: (url) => new pg.Pool({ connectionString: url, max: 1 }),
				createDatabase: (client) => drizzlePostgres(client, { schema })
			});
		}
	}

	return { withStore };
}
