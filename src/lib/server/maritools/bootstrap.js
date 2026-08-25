import { building } from '$app/environment';
import { sql } from 'drizzle-orm';
import migrationSql from '../../../../drizzle/0008_maritools_persistence.sql?raw';
import { readRuntimeEnvironment } from '../config/environment.js';
import { withDatabaseTransaction } from '../db/transaction.js';
import { createMariToolsRepository } from './repository.js';

/** @type {Promise<void> | null} */
let bootstrapPromise = null;

/**
 * @param {string} databaseUrl
 * @param {{
 *   runTransaction?: typeof withDatabaseTransaction
 * }} [dependencies]
 */
export async function ensureMariToolsSchema(databaseUrl, dependencies = {}) {
	const runTransaction = dependencies.runTransaction ?? withDatabaseTransaction;
	await runTransaction(
		async (transaction) => {
			const existing = await transaction.execute(
				sql`SELECT to_regclass('public.mt_academic_terms') AS table_name`
			);
			const rows = Array.isArray(existing)
				? existing
				: Array.isArray(existing?.rows)
					? existing.rows
					: [];
			const existingName = rows[0]?.table_name ?? rows[0]?.to_regclass ?? null;
			if (existingName) return;

			const statements = String(migrationSql)
				.split(/-->\s*statement-breakpoint/gu)
				.map((part) => part.trim())
				.filter(Boolean);
			for (const statement of statements) {
				await transaction.execute(sql.raw(statement));
			}
		},
		{ databaseUrl }
	);
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
