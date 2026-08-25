// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/config/environment.js', () => ({
	readRuntimeEnvironment: vi.fn()
}));
vi.mock('$lib/server/maritools/bootstrap.js', () => ({
	ensureMariToolsSchema: vi.fn()
}));
vi.mock('$lib/server/maritools/repository.js', () => ({
	createMariToolsRepository: vi.fn()
}));

import { readRuntimeEnvironment } from '$lib/server/config/environment.js';
import { ensureMariToolsSchema } from '$lib/server/maritools/bootstrap.js';
import { createMariToolsRepository } from '$lib/server/maritools/repository.js';
import { _createMariToolsMigrateEndpoint } from './+server.js';

const RUNTIME = Object.freeze({
	databaseUrl: 'postgresql://runtime:password@db.example.com/club',
	cronSecret: 'cron-secret-with-at-least-32-characters'
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
			readEnvironment: () => RUNTIME
		});
		const response = await endpoint({ request: request(undefined) });
		expect(response.status).toBe(401);
		expect(ensureMariToolsSchema).not.toHaveBeenCalled();
	});

	it('applies schema and seeds for an exact Bearer secret', async () => {
		const ensureSchema = vi.fn(async () => undefined);
		const seedFall2026 = vi.fn(async () => ({ term: { id: 'fall-2026' } }));
		const listTerms = vi.fn(async () => [{ id: 'fall-2026' }]);
		const endpoint = _createMariToolsMigrateEndpoint({
			readEnvironment: () => RUNTIME,
			ensureMariToolsSchema: ensureSchema,
			createMariToolsRepository: () => ({ seedFall2026, listTerms })
		});

		const response = await endpoint({
			request: request(`Bearer ${RUNTIME.cronSecret}`)
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({
			ok: true,
			termCount: 1,
			seededTermId: 'fall-2026'
		});
		expect(ensureSchema).toHaveBeenCalledWith(RUNTIME.databaseUrl);
		expect(seedFall2026).toHaveBeenCalledTimes(1);
		expect(listTerms).toHaveBeenCalledTimes(1);
		expect(readRuntimeEnvironment).not.toHaveBeenCalled();
		expect(createMariToolsRepository).not.toHaveBeenCalled();
	});
});
