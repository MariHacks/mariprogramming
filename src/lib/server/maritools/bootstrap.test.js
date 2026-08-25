// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

describe('ensureMariToolsSchema', () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.doUnmock('$app/environment');
		vi.doUnmock('../config/environment.js');
		vi.doUnmock('../db/transaction.js');
		vi.doUnmock('./repository.js');
	});

	it('applies the persistence migration when mt tables are missing', async () => {
		const execute = vi
			.fn()
			.mockResolvedValueOnce([{ table_name: null }])
			.mockResolvedValue([]);
		const runTransaction = vi.fn(async (operation) => operation({ execute }));
		vi.doMock('$app/environment', () => ({ building: false }));
		vi.doMock('../config/environment.js', () => ({
			readRuntimeEnvironment: () => ({ databaseUrl: 'postgresql://x' })
		}));
		vi.doMock('../db/transaction.js', () => ({ withDatabaseTransaction: runTransaction }));
		vi.doMock('./repository.js', () => ({
			createMariToolsRepository: () => ({ seedFall2026: vi.fn(async () => ({})) })
		}));
		vi.doMock('../../../../drizzle/0008_maritools_persistence.sql?raw', () => ({
			default: 'CREATE TABLE "mt_academic_terms" ();\n--> statement-breakpoint\nCREATE TABLE "mt_courses" ();'
		}));

		const { ensureMariToolsSchema } = await import('./bootstrap.js');
		await ensureMariToolsSchema('postgresql://x', { runTransaction });
		expect(execute).toHaveBeenCalled();
		expect(execute.mock.calls.length).toBeGreaterThan(1);
	});

	it('skips migration when mt_academic_terms already exists', async () => {
		const execute = vi.fn(async () => [{ table_name: 'mt_academic_terms' }]);
		const runTransaction = vi.fn(async (operation) => operation({ execute }));
		const { ensureMariToolsSchema } = await import('./bootstrap.js');
		await ensureMariToolsSchema('postgresql://x', { runTransaction });
		expect(execute).toHaveBeenCalledTimes(1);
	});
});

describe('ensureMariToolsBootstrap', () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.doUnmock('$app/environment');
		vi.doUnmock('../config/environment.js');
		vi.doUnmock('../db/transaction.js');
		vi.doUnmock('./repository.js');
	});

	it('seeds Fall 2026 once when a database url exists', async () => {
		const seedFall2026 = vi.fn(async () => ({ term: { id: 'fall-2026' } }));
		const execute = vi.fn(async () => [{ table_name: 'mt_academic_terms' }]);
		vi.doMock('$app/environment', () => ({ building: false }));
		vi.doMock('../config/environment.js', () => ({
			readRuntimeEnvironment: () => ({
				databaseUrl: 'postgresql://bootstrap:test@localhost/club'
			})
		}));
		vi.doMock('../db/transaction.js', () => ({
			withDatabaseTransaction: async (operation) => operation({ execute })
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
		vi.doMock('../db/transaction.js', () => ({ withDatabaseTransaction: vi.fn() }));
		vi.doMock('./repository.js', () => ({
			createMariToolsRepository: () => ({ seedFall2026 })
		}));

		const { ensureMariToolsBootstrap } = await import('./bootstrap.js');
		await expect(ensureMariToolsBootstrap()).resolves.toBeUndefined();
		expect(seedFall2026).not.toHaveBeenCalled();
	});

	it('swallows missing configuration', async () => {
		vi.doMock('$app/environment', () => ({ building: false }));
		vi.doMock('../config/environment.js', () => ({
			readRuntimeEnvironment: () => {
				throw new Error('unavailable');
			}
		}));
		vi.doMock('../db/transaction.js', () => ({ withDatabaseTransaction: vi.fn() }));
		vi.doMock('./repository.js', () => ({
			createMariToolsRepository: () => ({ seedFall2026: vi.fn() })
		}));

		const { ensureMariToolsBootstrap } = await import('./bootstrap.js');
		await expect(ensureMariToolsBootstrap()).resolves.toBeUndefined();
	});
});
