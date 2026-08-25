// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as environment from '../config/environment.js';
import * as repository from './repository.js';

describe('ensureMariToolsBootstrap', () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
	});

	it('seeds Fall 2026 once when a database url exists', async () => {
		const seedFall2026 = vi.fn(async () => ({ term: { id: 'fall-2026' } }));
		vi.spyOn(environment, 'readRuntimeEnvironment').mockReturnValue({
			databaseUrl: 'postgresql://bootstrap:test@localhost/club'
		});
		vi.spyOn(repository, 'createMariToolsRepository').mockReturnValue({ seedFall2026 });

		const { ensureMariToolsBootstrap } = await import('./bootstrap.js');
		await ensureMariToolsBootstrap();
		await ensureMariToolsBootstrap();

		expect(seedFall2026).toHaveBeenCalledTimes(1);
	});

	it('swallows missing configuration', async () => {
		vi.spyOn(environment, 'readRuntimeEnvironment').mockImplementation(() => {
			throw new Error('unavailable');
		});
		const { ensureMariToolsBootstrap } = await import('./bootstrap.js');
		await expect(ensureMariToolsBootstrap()).resolves.toBeUndefined();
	});
});
