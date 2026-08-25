import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import {
	readMigrationEnvironment,
	readRuntimeEnvironment
} from '$lib/server/config/environment.js';
import { ensureMariToolsSchema } from '$lib/server/maritools/bootstrap.js';
import { createMariToolsRepository } from '$lib/server/maritools/repository.js';

export const prerender = false;

const PRIVATE_HEADERS = Object.freeze({
	'cache-control': 'no-store',
	'referrer-policy': 'no-referrer',
	'x-robots-tag': 'noindex, nofollow'
});

/**
 * @param {Record<string, any>} [dependencies]
 */
export function _createMariToolsMigrateEndpoint(dependencies = {}) {
	const readCronEnvironment =
		dependencies.readCronEnvironment ?? (() => readRuntimeEnvironment(env));
	const readMigration =
		dependencies.readMigrationEnvironment ?? (() => readMigrationEnvironment(env));
	const applySchema = dependencies.ensureMariToolsSchema ?? ensureMariToolsSchema;
	const createRepository = dependencies.createMariToolsRepository ?? createMariToolsRepository;

	return async function GET({ request }) {
		let runtime;
		try {
			runtime = readCronEnvironment();
		} catch {
			return json({ error: 'Scheduled work is unavailable' }, { status: 503, headers: PRIVATE_HEADERS });
		}

		if (request.headers.get('authorization') !== `Bearer ${runtime.cronSecret}`) {
			return json({ error: 'Unauthorized' }, { status: 401, headers: PRIVATE_HEADERS });
		}

		let migration;
		try {
			migration = readMigration();
		} catch {
			return json(
				{
					ok: false,
					error: 'MIGRATION_DATABASE_URL is required for schema apply'
				},
				{ status: 503, headers: PRIVATE_HEADERS }
			);
		}

		try {
			await applySchema(migration.databaseUrl);
			const seeded = await createRepository({
				databaseUrl: runtime.databaseUrl
			}).seedFall2026();
			const listed = await createRepository({
				databaseUrl: runtime.databaseUrl
			}).listTerms();
			return json(
				{
					ok: true,
					termCount: listed.length,
					seededTermId: seeded?.term?.id ?? null
				},
				{ headers: PRIVATE_HEADERS }
			);
		} catch {
			return json({ ok: false, error: 'Migration failed' }, { status: 500, headers: PRIVATE_HEADERS });
		}
	};
}

export const GET = _createMariToolsMigrateEndpoint();
