import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '../../../../src/lib/server/db/schema.ts';

/** @param {string} databaseUrl */
export function createRequestPool(databaseUrl) {
	return new Pool({ connectionString: databaseUrl, max: 2 });
}

/** @param {import('pg').PoolClient} client */
export function createTransactionDatabase(client) {
	return drizzle(client, { schema });
}

/**
 * @template Result
 * @param {(transaction: unknown) => Promise<Result>} operation
 * @param {{ databaseUrl: string, createPool?: typeof createRequestPool, createDatabase?: typeof createTransactionDatabase }} options
 */
export async function withDatabaseTransaction(
	operation,
	{ databaseUrl, createPool = createRequestPool, createDatabase = createTransactionDatabase }
) {
	const pool = createPool(databaseUrl);
	const client = await pool.connect();
	try {
		return await createDatabase(client).transaction(operation);
	} finally {
		client.release();
		await pool.end();
	}
}
