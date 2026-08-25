import { building } from '$app/environment';
import migrationSql from '../../../../drizzle/0008_maritools_persistence.sql?raw';
import { readRuntimeEnvironment } from '../config/environment.js';
import { createRequestPool } from '../db/transaction.js';
import { createMariToolsRepository } from './repository.js';

/** @type {Promise<void> | null} */
let bootstrapPromise = null;

/**
 * @param {string} databaseUrl
 * @param {{
 *   createPool?: typeof createRequestPool
 * }} [dependencies]
 */
export async function ensureMariToolsSchema(databaseUrl, dependencies = {}) {
	const createPool = dependencies.createPool ?? createRequestPool;
	const pool = createPool(databaseUrl);
	/** @type {{ query: (text: string) => Promise<{ rows: Array<Record<string, unknown>> }>, release: () => void } | undefined} */
	let client;
	try {
		client = /** @type {any} */ (await pool.connect());
		const existing = await client.query(
			"SELECT to_regclass('public.mt_academic_terms')::text AS table_name"
		);
		if (existing.rows[0]?.table_name) return;

		const statements = String(migrationSql)
			.split(/-->\s*statement-breakpoint/gu)
			.map((part) => part.trim())
			.filter(Boolean);
		for (const statement of statements) {
			await client.query(statement);
		}
	} finally {
		try {
			client?.release();
		} catch {
			/* ignore release errors during bootstrap */
		}
		try {
			await pool.end();
		} catch {
			/* ignore pool end errors during bootstrap */
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
		} catch {
			/* missing env or DB — tools pages handle unavailability */
		}
	})();
	return bootstrapPromise;
}
