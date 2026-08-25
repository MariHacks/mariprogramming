// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/config/environment.js', () => ({
	readRuntimeEnvironment: vi.fn(),
	readMigrationEnvironment: vi.fn()
}));
vi.mock('$lib/server/maritools/bootstrap.js', () => ({
	ensureMariToolsSchema: vi.fn()
}));
vi.mock('$lib/server/maritools/repository.js', () => ({
	createMariToolsRepository: vi.fn()
}));

import { ensureMariToolsSchema } from '$lib/server/maritools/bootstrap.js';
import { _createMariToolsMigrateEndpoint } from './+server.js';

const RUNTIME = Object.freeze({
	databaseUrl: 'postgresql://runtime:password@db.example.com/club',
	cronSecret: 'cron-secret-with-at-least-32-characters'
});
const MIGRATION = Object.freeze({
	databaseUrl: 'postgresql://migrator:password@db.example.com/club'
});

/** @param {string | undefined} authorization */
function request(authorization) {
	return new Request('https://club.example.com/api/cron/maritools-migrate', {
		method: 'GET',
		headers: authorization === undefined ? {} : { authorization }
	});
}

describe('MariTools migrate cron', () => {
	it('rejects missing bearer auth', async () => {
		const endpoint = _createMariToolsMigrateEndpoint({
			readCronEnvironment: () => RUNTIME,
			readMigrationEnvironment: () => MIGRATION
		});
		const response = await endpoint({ request: request(undefined) });
		expect(response.status).toBe(401);
		expect(ensureMariToolsSchema).not.toHaveBeenCalled();
	});

	it('requires MIGRATION_DATABASE_URL', async () => {
		const endpoint = _createMariToolsMigrateEndpoint({
			readCronEnvironment: () => RUNTIME,
			readMigrationEnvironment: () => {
				throw new Error('missing migration url');
			}
		});
		const response = await endpoint({
			request: request(`Bearer ${RUNTIME.cronSecret}`)
		});
		expect(response.status).toBe(503);
		expect(await response.json()).toMatchObject({
			ok: false,
			error: 'MIGRATION_DATABASE_URL is required for schema apply'
		});
	});

	it('applies schema with the migrator URL and seeds via runtime', async () => {
		const ensureSchema = vi.fn(async () => undefined);
		const seedCommittedTerms = vi.fn(async () => [{ term: { id: 'fall-2026' } }]);
		const listTerms = vi.fn(async () => [{ id: 'fall-2026' }, { id: 'winter-2027' }]);
		const endpoint = _createMariToolsMigrateEndpoint({
			readCronEnvironment: () => RUNTIME,
			readMigrationEnvironment: () => MIGRATION,
			ensureMariToolsSchema: ensureSchema,
			createMariToolsRepository: () => ({ seedCommittedTerms, listTerms })
		});

		const response = await endpoint({
			request: request(`Bearer ${RUNTIME.cronSecret}`)
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({
			ok: true,
			termCount: 2,
			seededTermId: 'fall-2026'
		});
		expect(ensureSchema).toHaveBeenCalledWith(MIGRATION.databaseUrl);
		expect(seedCommittedTerms).toHaveBeenCalledTimes(1);
		expect(listTerms).toHaveBeenCalledTimes(1);
	});
});
