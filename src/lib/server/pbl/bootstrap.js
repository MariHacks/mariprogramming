import pg from 'pg';
import migrationSql0020 from '../../../../drizzle/0020_pbl_rooms.sql?raw';
import { readMigrationEnvironment, readPblEnvironment } from '../config/environment.js';

/** @type {Promise<void> | null} */
let ensurePromise = null;

/** @param {string} sql */
function splitMigrationStatements(sql) {
	return String(sql)
		.split(/-->\s*statement-breakpoint/gu)
		.map((part) => part.trim())
		.filter(Boolean);
}

/** @param {string} databaseUrl */
export function createPblPool(databaseUrl) {
	return new pg.Pool({ connectionString: databaseUrl, max: 1 });
}

/**
 * @param {string} databaseUrl
 * @param {{ createPool?: typeof createPblPool }} [dependencies]
 */
export async function ensurePblSchema(databaseUrl, dependencies = {}) {
	const createPool = dependencies.createPool ?? createPblPool;
	const pool = createPool(databaseUrl);
	/** @type {import('pg').PoolClient | undefined} */
	let client;
	try {
		client = await pool.connect();
		const existing = await client.query(
			"SELECT to_regclass('public.pbl_rooms')::text AS table_name"
		);
		if (existing.rows[0]?.table_name) return;
		const statements = splitMigrationStatements(migrationSql0020);
		await client.query('BEGIN');
		try {
			for (const statement of statements) {
				await client.query(statement);
			}
			try {
				await client.query(
					'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pbl_rooms, pbl_room_members TO mariprogramming_runtime'
				);
			} catch (error) {
				if (!String(error instanceof Error ? error.message : error).includes('mariprogramming_runtime')) {
					throw error;
				}
			}
			await client.query('COMMIT');
		} catch (error) {
			try {
				await client.query('ROLLBACK');
			} catch {
				/* ignore */
			}
			throw error;
		}
	} finally {
		try {
			client?.release();
		} catch {
			/* ignore */
		}
		try {
			await pool.end();
		} catch {
			/* ignore */
		}
	}
}

/**
 * @param {{
 *   readPbl?: typeof readPblEnvironment,
 *   readMigration?: typeof readMigrationEnvironment,
 *   applySchema?: typeof ensurePblSchema
 * }} [dependencies]
 */
export async function ensurePblSchemaAvailable(dependencies = {}) {
	if (ensurePromise) return ensurePromise;
	ensurePromise = (async () => {
		try {
			let databaseUrl;
			try {
				databaseUrl = (dependencies.readMigration ?? readMigrationEnvironment)().databaseUrl;
			} catch {
				databaseUrl = (dependencies.readPbl ?? readPblEnvironment)().databaseUrl;
			}
			await (dependencies.applySchema ?? ensurePblSchema)(databaseUrl);
		} catch (error) {
			ensurePromise = null;
			throw error;
		}
	})();
	return ensurePromise;
}

export function _resetPblSchemaPromise() {
	ensurePromise = null;
}
