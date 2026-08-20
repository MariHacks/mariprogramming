import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePostgres } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import WebSocket from 'ws';
import * as schema from './schema';

/** @param {string} databaseUrl @returns {any} */
export function createRequestPool(databaseUrl) {
	if (process.env.LIVE_E2E_MODE === 'isolated-local') {
		return new pg.Pool({ connectionString: databaseUrl });
	}
	neonConfig.webSocketConstructor = WebSocket;
	return new NeonPool({ connectionString: databaseUrl });
}

/** @param {any} client */
export function createTransactionDatabase(client) {
	return process.env.LIVE_E2E_MODE === 'isolated-local'
		? drizzlePostgres(client, { schema })
		: drizzleNeon(client, { schema });
}

/**
 * Runs one complete operation on one transaction connection. Callers pass the runtime URL
 * returned by `readRuntimeEnvironment`; controlled migrations use `drizzle.config.js` and the
 * separate `MIGRATION_DATABASE_URL` instead.
 *
 * @template Result
 * @param {(transaction: unknown) => Promise<Result>} operation
 * @param {{
 *   databaseUrl: string,
 *   createPool?: (databaseUrl: string) => { connect: () => Promise<{ release: () => void }>, end: () => Promise<void> },
 *   createDatabase?: Function
 * }} options
 * @returns {Promise<Result>}
 */
export async function withDatabaseTransaction(
	operation,
	{ databaseUrl, createPool = createRequestPool, createDatabase = createTransactionDatabase }
) {
	const pool = createPool(databaseUrl);
	/** @type {{ release: () => void } | undefined} */
	let client;
	/** @type {unknown} */
	let primaryError;
	let failed = false;
	/** @type {Result | undefined} */
	let result;
	/** @type {unknown[]} */
	const cleanupErrors = [];

	try {
		client = await pool.connect();
		const database =
			/** @type {{ transaction: (operation: (transaction: unknown) => Promise<Result>) => Promise<Result> }} */ (
				createDatabase(client)
			);
		result = await database.transaction(operation);
	} catch (error) {
		failed = true;
		primaryError = error;
	} finally {
		try {
			client?.release();
		} catch (error) {
			cleanupErrors.push(error);
		}

		try {
			await pool.end();
		} catch (error) {
			cleanupErrors.push(error);
		}
	}

	if (failed) {
		if (cleanupErrors.length > 0) {
			throw new globalThis.AggregateError(
				[primaryError, ...cleanupErrors],
				'Database transaction and cleanup failed',
				{ cause: primaryError }
			);
		}
		throw primaryError;
	}

	if (cleanupErrors.length === 1) throw cleanupErrors[0];
	if (cleanupErrors.length > 1) {
		throw new globalThis.AggregateError(cleanupErrors, 'Database cleanup failed');
	}

	return /** @type {Result} */ (result);
}
