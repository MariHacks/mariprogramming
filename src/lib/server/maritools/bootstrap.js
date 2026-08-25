import { building } from '$app/environment';
import pg from 'pg';
import migrationSql from '../../../../drizzle/0008_maritools_persistence.sql?raw';
import { readRuntimeEnvironment } from '../config/environment.js';
import { createMariToolsRepository } from './repository.js';

/** @type {Promise<void> | null} */
let bootstrapPromise = null;

/**
 * @param {string} databaseUrl
 * @param {{
 *   createPool?: (databaseUrl: string) => InstanceType<typeof pg.Pool>
 * }} [dependencies]
 */
export async function ensureMariToolsSchema(databaseUrl, dependencies = {}) {
	const createPool =
		dependencies.createPool ?? ((url) => new pg.Pool({ connectionString: url, max: 1 }));
	const pool = createPool(databaseUrl);
	/** @type {pg.PoolClient | undefined} */
	let client;
	try {
		client = await pool.connect();
		const existing = await client.query(
			"SELECT to_regclass('public.mt_academic_terms')::text AS table_name"
		);
		if (existing.rows[0]?.table_name) return;

		const statements = String(migrationSql)
			.split(/-->\s*statement-breakpoint/gu)
			.map((part) => part.trim())
			.filter(Boolean);
		if (statements.length === 0) {
			throw new Error('MariTools persistence SQL is empty');
		}
		for (const statement of statements) {
			await client.query(statement);
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

/** Seeds committed academic terms into Postgres once per process. */
export async function ensureMariToolsBootstrap() {
	if (building) return;
	if (bootstrapPromise) return bootstrapPromise;
	bootstrapPromise = (async () => {
		try {
			const { databaseUrl } = readRuntimeEnvironment();
			if (!databaseUrl) return;
			await ensureMariToolsSchema(databaseUrl);
			const repository = createMariToolsRepository({ databaseUrl });
			await repository.seedFall2026();
		} catch (error) {
			bootstrapPromise = null;
			console.error(
				'[maritools-bootstrap]',
				error instanceof Error ? error.message : 'unknown error'
			);
		}
	})();
	return bootstrapPromise;
}
