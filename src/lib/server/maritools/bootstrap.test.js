// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';

describe('ensureMariToolsSchema', () => {
	afterEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
	});

	it('applies the persistence migration when mt tables are missing', async () => {
		const query = vi
			.fn()
			.mockResolvedValueOnce({ rows: [{ table_name: null }] })
			.mockResolvedValue({ rows: [] });
		const client = { query, release: vi.fn() };
		const pool = { connect: vi.fn(async () => client), end: vi.fn(async () => undefined) };
		vi.doMock('../../../../drizzle/0008_maritools_persistence.sql?raw', () => ({
			default:
				'CREATE TABLE "mt_academic_terms" ();\n--> statement-breakpoint\nCREATE TABLE "mt_courses" ();'
		}));

		const { ensureMariToolsSchema } = await import('./bootstrap.js');
		await ensureMariToolsSchema('postgresql://x', { createPool: () => /** @type {any} */ (pool) });
		// existence check + BEGIN + 2 DDL + grants + COMMIT
		expect(query.mock.calls.length).toBe(6);
		expect(query.mock.calls[1][0]).toBe('BEGIN');
		expect(String(query.mock.calls[4][0])).toContain('mariprogramming_runtime');
		expect(query.mock.calls[5][0]).toBe('COMMIT');
		expect(client.release).toHaveBeenCalled();
		expect(pool.end).toHaveBeenCalled();
	});

	it('skips migration when mt_academic_terms already exists', async () => {
		const query = vi.fn(async () => ({ rows: [{ table_name: 'mt_academic_terms' }] }));
		const client = { query, release: vi.fn() };
		const pool = { connect: vi.fn(async () => client), end: vi.fn(async () => undefined) };
		const { ensureMariToolsSchema } = await import('./bootstrap.js');
		await ensureMariToolsSchema('postgresql://x', { createPool: () => /** @type {any} */ (pool) });
		expect(query).toHaveBeenCalledTimes(1);
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
		vi.doMock('$app/environment', () => ({ building: false }));
		vi.doMock('../config/environment.js', () => ({
			readRuntimeEnvironment: () => ({
				databaseUrl: 'postgresql://bootstrap:test@localhost/club'
			})
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

	it('swallows missing configuration', async () => {
		vi.doMock('$app/environment', () => ({ building: false }));
		vi.doMock('../config/environment.js', () => ({
			readRuntimeEnvironment: () => {
				throw new Error('unavailable');
			}
		}));
		vi.doMock('./repository.js', () => ({
			createMariToolsRepository: () => ({ seedFall2026: vi.fn() })
		}));

		const { ensureMariToolsBootstrap } = await import('./bootstrap.js');
		await expect(ensureMariToolsBootstrap()).resolves.toBeUndefined();
	});
});
