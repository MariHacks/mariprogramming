import migrationSql0020 from '../../../../drizzle/0020_pbl_rooms.sql?raw';
import migrationSql0021 from '../../../../drizzle/0021_pbl_room_driver.sql?raw';
import migrationSql0022 from '../../../../drizzle/0022_pbl_yjs_state.sql?raw';
import { readMigrationEnvironment, readPblEnvironment } from '../config/environment.js';
import { createRequestPool } from '../db/transaction.js';

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
	return createRequestPool(databaseUrl);
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
		if (existing.rows[0]?.table_name) {
			const driver = await client.query(
				`SELECT column_name FROM information_schema.columns
				 WHERE table_schema = 'public' AND table_name = 'pbl_rooms' AND column_name = 'driver_member_id'`
			);
			const yjs = await client.query(
				`SELECT column_name FROM information_schema.columns
				 WHERE table_schema = 'public' AND table_name = 'pbl_rooms' AND column_name = 'yjs_state'`
			);
			/** @type {string[]} */
			const statements = [];
			if (!driver.rows[0]?.column_name)
				statements.push(...splitMigrationStatements(migrationSql0021));
			if (!yjs.rows[0]?.column_name) statements.push(...splitMigrationStatements(migrationSql0022));
			if (statements.length === 0) return;
			await client.query('BEGIN');
			try {
				for (const statement of statements) {
					await client.query(statement);
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
			return;
		}
		const statements = [
			...splitMigrationStatements(migrationSql0020),
			...splitMigrationStatements(migrationSql0021),
			...splitMigrationStatements(migrationSql0022)
		];
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
				if (
					!String(error instanceof Error ? error.message : error).includes(
						'mariprogramming_runtime'
					)
				) {
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
