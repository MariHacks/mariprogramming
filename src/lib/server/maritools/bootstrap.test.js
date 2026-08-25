// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

describe('ensureMariToolsBootstrap', () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.doUnmock('$app/environment');
		vi.doUnmock('../config/environment.js');
		vi.doUnmock('./repository.js');
	});

	it('seeds Fall 2026 once when a database url exists', async () => {
		const seedFall2026 = vi.fn(async () => ({ term: { id: 'fall-2026' } }));
		vi.doMock('$app/environment', () => ({ building: false }));
		vi.doMock('../config/environment.js', () => ({
			readRuntimeEnvironment: () => ({ databaseUrl: 'postgresql://bootstrap:test@localhost/club' })
		}));
		vi.doMock('./repository.js', () => ({
			createMariToolsRepository: () => ({ seedFall2026 })
		}));

		const { ensureMariToolsBootstrap } = await import('./bootstrap.js');
		await ensureMariToolsBootstrap();
		await ensureMariToolsBootstrap();
		expect(seedFall2026).toHaveBeenCalledTimes(1);
	});

	it('skips seeding while the app is building', async () => {
		const seedFall2026 = vi.fn(async () => ({}));
		vi.doMock('$app/environment', () => ({ building: true }));
		vi.doMock('../config/environment.js', () => ({
			readRuntimeEnvironment: () => ({ databaseUrl: 'postgresql://bootstrap:test@localhost/club' })
		}));
		vi.doMock('./repository.js', () => ({
			createMariToolsRepository: () => ({ seedFall2026 })
		}));

		const { ensureMariToolsBootstrap } = await import('./bootstrap.js');
		await expect(ensureMariToolsBootstrap()).resolves.toBeUndefined();
		expect(seedFall2026).not.toHaveBeenCalled();
	});

	it('skips seeding when the database url is empty', async () => {
		const createMariToolsRepository = vi.fn();
		vi.doMock('$app/environment', () => ({ building: false }));
		vi.doMock('../config/environment.js', () => ({
			readRuntimeEnvironment: () => ({ databaseUrl: '' })
		}));
		vi.doMock('./repository.js', () => ({ createMariToolsRepository }));

		const { ensureMariToolsBootstrap } = await import('./bootstrap.js');
		await ensureMariToolsBootstrap();
		expect(createMariToolsRepository).not.toHaveBeenCalled();
	});

	it('swallows missing configuration', async () => {
		vi.doMock('$app/environment', () => ({ building: false }));
		vi.doMock('../config/environment.js', () => ({
			readRuntimeEnvironment: () => {
				throw new Error('unavailable');
			}
		}));
		vi.doMock('./repository.js', () => ({
			createMariToolsRepository: () => ({
				seedFall2026: vi.fn()
			})
		}));

		const { ensureMariToolsBootstrap } = await import('./bootstrap.js');
		await expect(ensureMariToolsBootstrap()).resolves.toBeUndefined();
	});
});
