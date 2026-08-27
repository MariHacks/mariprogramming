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

import { readMigrationEnvironment, readRuntimeEnvironment } from '$lib/server/config/environment.js';
import { ensureMariToolsSchema } from '$lib/server/maritools/bootstrap.js';
import { _createMariToolsMigrateEndpoint, firstSeededTermId } from './+server.js';

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

	it('returns a null seeded term when none were inserted', async () => {
		const endpoint = _createMariToolsMigrateEndpoint({
			readCronEnvironment: () => RUNTIME,
			readMigrationEnvironment: () => MIGRATION,
			ensureMariToolsSchema: vi.fn(async () => undefined),
			createMariToolsRepository: () => ({
				seedCommittedTerms: vi.fn(async () => []),
				listTerms: vi.fn(async () => [])
			})
		});
		const response = await endpoint({
			request: request(`Bearer ${RUNTIME.cronSecret}`)
		});
		expect(await response.json()).toMatchObject({ ok: true, termCount: 0, seededTermId: null });
	});

	it('returns 503 when runtime config is missing', async () => {
		const endpoint = _createMariToolsMigrateEndpoint({
			readCronEnvironment: () => {
				throw new Error('missing');
			}
		});
		const response = await endpoint({ request: request(`Bearer ${RUNTIME.cronSecret}`) });
		expect(response.status).toBe(503);
	});

	it('returns 500 when schema apply fails', async () => {
		const endpoint = _createMariToolsMigrateEndpoint({
			readCronEnvironment: () => RUNTIME,
			readMigrationEnvironment: () => MIGRATION,
			ensureMariToolsSchema: vi.fn(async () => {
				throw new Error('apply failed');
			})
		});
		const response = await endpoint({
			request: request(`Bearer ${RUNTIME.cronSecret}`)
		});
		expect(response.status).toBe(500);
		expect(await response.json()).toMatchObject({ ok: false, error: 'Migration failed' });
	});

	it('returns a null seeded term when seeding writes nothing', async () => {
		const endpoint = _createMariToolsMigrateEndpoint({
			readCronEnvironment: () => RUNTIME,
			readMigrationEnvironment: () => MIGRATION,
			ensureMariToolsSchema: vi.fn(async () => undefined),
			createMariToolsRepository: () => ({
				seedCommittedTerms: vi.fn(async () => []),
				listTerms: vi.fn(async () => [])
			})
		});
		const response = await endpoint({
			request: request(`Bearer ${RUNTIME.cronSecret}`)
		});
		expect(await response.json()).toMatchObject({ ok: true, termCount: 0, seededTermId: null });
	});

	it('treats a seed row without a term id as null', async () => {
		const endpoint = _createMariToolsMigrateEndpoint({
			readCronEnvironment: () => RUNTIME,
			readMigrationEnvironment: () => MIGRATION,
			ensureMariToolsSchema: vi.fn(async () => undefined),
			createMariToolsRepository: () => ({
				seedCommittedTerms: vi.fn(async () => [{}]),
				listTerms: vi.fn(async () => [{ id: 'fall-2026' }])
			})
		});
		const response = await endpoint({
			request: request(`Bearer ${RUNTIME.cronSecret}`)
		});
		expect(await response.json()).toMatchObject({ ok: true, seededTermId: null, termCount: 1 });
	});

	it('treats a missing seed payload as a null term id', async () => {
		const endpoint = _createMariToolsMigrateEndpoint({
			readCronEnvironment: () => RUNTIME,
			readMigrationEnvironment: () => MIGRATION,
			ensureMariToolsSchema: vi.fn(async () => undefined),
			createMariToolsRepository: () => ({
				seedCommittedTerms: vi.fn(async () => null),
				listTerms: vi.fn(async () => [])
			})
		});
		const response = await endpoint({
			request: request(`Bearer ${RUNTIME.cronSecret}`)
		});
		expect(await response.json()).toMatchObject({ ok: true, seededTermId: null });
	});

	it('treats a seed term without an id as null', async () => {
		const endpoint = _createMariToolsMigrateEndpoint({
			readCronEnvironment: () => RUNTIME,
			readMigrationEnvironment: () => MIGRATION,
			ensureMariToolsSchema: vi.fn(async () => undefined),
			createMariToolsRepository: () => ({
				seedCommittedTerms: vi.fn(async () => [{ term: {} }]),
				listTerms: vi.fn(async () => [])
			})
		});
		const response = await endpoint({
			request: request(`Bearer ${RUNTIME.cronSecret}`)
		});
		expect(await response.json()).toMatchObject({ ok: true, seededTermId: null });
	});

	it('uses default environment readers when none are injected', async () => {
		vi.mocked(readRuntimeEnvironment).mockImplementation(() => {
			throw new Error('missing');
		});
		const endpoint = _createMariToolsMigrateEndpoint();
		const response = await endpoint({ request: request(undefined) });
		expect(response.status).toBe(503);
	});

	it('uses the default migration reader after cron auth', async () => {
		vi.mocked(readRuntimeEnvironment).mockReturnValue(RUNTIME);
		vi.mocked(readMigrationEnvironment).mockImplementation(() => {
			throw new Error('missing');
		});
		const endpoint = _createMariToolsMigrateEndpoint();
		const response = await endpoint({ request: request(`Bearer ${RUNTIME.cronSecret}`) });
		expect(response.status).toBe(503);
		expect(await response.json()).toMatchObject({
			ok: false,
			error: 'MIGRATION_DATABASE_URL is required for schema apply'
		});
	});

	it('reads the first seeded term id', () => {
		expect(firstSeededTermId(null)).toBeNull();
		expect(firstSeededTermId([])).toBeNull();
		expect(firstSeededTermId([{}])).toBeNull();
		expect(firstSeededTermId([{ term: {} }])).toBeNull();
		expect(firstSeededTermId([{ term: { id: 'fall-2026' } }])).toBe('fall-2026');
		expect(firstSeededTermId([{ term: { id: '' } }])).toBeNull();
		expect(firstSeededTermId([{ term: null }])).toBeNull();
	});
});
