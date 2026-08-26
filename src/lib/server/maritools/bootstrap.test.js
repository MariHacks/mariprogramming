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
			.mockResolvedValueOnce({ rows: [{ table_name: null }] })
			.mockResolvedValueOnce({ rows: [{ table_name: null }] })
			.mockResolvedValue({ rows: [] });
		const client = { query, release: vi.fn() };
		const pool = { connect: vi.fn(async () => client), end: vi.fn(async () => undefined) };
		vi.doMock('../../../../drizzle/0008_maritools_persistence.sql?raw', () => ({
			default:
				'CREATE TABLE "mt_academic_terms" ();\n--> statement-breakpoint\nCREATE TABLE "mt_courses" ();'
		}));
		vi.doMock('../../../../drizzle/0009_google_calendar_grants.sql?raw', () => ({
			default: 'CREATE TABLE "mt_google_calendar_grants" ();'
		}));
		vi.doMock('../../../../drizzle/0010_free_time_boards.sql?raw', () => ({
			default: 'CREATE TABLE "mt_free_time_boards" ();'
		}));

		const { ensureMariToolsSchema } = await import('./bootstrap.js');
		await ensureMariToolsSchema('postgresql://x', { createPool: () => /** @type {any} */ (pool) });
		expect(query.mock.calls.length).toBeGreaterThan(6);
		expect(query.mock.calls.some((call) => call[0] === 'BEGIN')).toBe(true);
		expect(query.mock.calls.some((call) => String(call[0]).includes('mariprogramming_runtime'))).toBe(
			true
		);
		expect(query.mock.calls.some((call) => call[0] === 'COMMIT')).toBe(true);
		expect(client.release).toHaveBeenCalled();
		expect(pool.end).toHaveBeenCalled();
	});

	it('applies incremental migrations when only newer tables are missing', async () => {
		const query = vi.fn(async (sql) => {
			const text = String(sql);
			if (text.includes("to_regclass('public.mt_academic_terms')")) {
				return { rows: [{ table_name: 'mt_academic_terms' }] };
			}
			if (text.includes("to_regclass('public.mt_google_calendar_grants')")) {
				return { rows: [{ table_name: null }] };
			}
			if (text.includes("to_regclass('public.mt_free_time_boards')")) {
				return { rows: [{ table_name: 'mt_free_time_boards' }] };
			}
			return { rows: [] };
		});
		const client = { query, release: vi.fn() };
		const pool = { connect: vi.fn(async () => client), end: vi.fn(async () => undefined) };
		vi.doMock('../../../../drizzle/0008_maritools_persistence.sql?raw', () => ({
			default: 'CREATE TABLE "mt_academic_terms" ();'
		}));
		vi.doMock('../../../../drizzle/0009_google_calendar_grants.sql?raw', () => ({
			default:
				'CREATE TABLE "mt_google_calendar_grants" ();\n--> statement-breakpoint\nCREATE INDEX "mt_google_calendar_grants_user_idx" ON "mt_google_calendar_grants" ("user_id");'
		}));
		vi.doMock('../../../../drizzle/0010_free_time_boards.sql?raw', () => ({
			default: 'CREATE TABLE "mt_free_time_boards" ();'
		}));

		const { ensureMariToolsSchema } = await import('./bootstrap.js');
		await ensureMariToolsSchema('postgresql://x', { createPool: () => /** @type {any} */ (pool) });
		expect(query.mock.calls.some((call) => String(call[0]).includes('CREATE TABLE "mt_google_calendar_grants"'))).toBe(
			true
		);
		expect(
			query.mock.calls.some(
				(call) =>
					String(call[0]).includes('GRANT') && String(call[0]).includes('mt_google_calendar_grants')
			)
		).toBe(true);
		expect(
			query.mock.calls.some((call) => String(call[0]).includes('CREATE TABLE "mt_free_time_boards"'))
		).toBe(false);
	});

	it('skips migration when mt_academic_terms already exists', async () => {
		const query = vi
			.fn()
			.mockResolvedValueOnce({ rows: [{ table_name: 'mt_academic_terms' }] })
			.mockResolvedValueOnce({ rows: [{ table_name: 'mt_google_calendar_grants' }] })
			.mockResolvedValueOnce({ rows: [{ table_name: 'mt_free_time_boards' }] });
		const client = { query, release: vi.fn() };
		const pool = { connect: vi.fn(async () => client), end: vi.fn(async () => undefined) };
		const { ensureMariToolsSchema } = await import('./bootstrap.js');
		await ensureMariToolsSchema('postgresql://x', { createPool: () => /** @type {any} */ (pool) });
		expect(query).toHaveBeenCalledTimes(3);
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
		const seedCommittedTerms = vi.fn(async () => [{ term: { id: 'fall-2026' } }]);
		vi.doMock('$app/environment', () => ({ building: false }));
		vi.doMock('../config/environment.js', () => ({
			readRuntimeEnvironment: () => ({
				databaseUrl: 'postgresql://bootstrap:test@localhost/club'
			})
		}));
		vi.doMock('./repository.js', () => ({
			createMariToolsRepository: () => ({ seedCommittedTerms })
		}));

		const { ensureMariToolsBootstrap } = await import('./bootstrap.js');
		await ensureMariToolsBootstrap();
		await ensureMariToolsBootstrap();
		expect(seedCommittedTerms).toHaveBeenCalledTimes(1);
	});

	it('skips seeding while the app is building', async () => {
		const seedCommittedTerms = vi.fn(async () => ({}));
		vi.doMock('$app/environment', () => ({ building: true }));
		vi.doMock('../config/environment.js', () => ({
			readRuntimeEnvironment: () => ({ databaseUrl: 'postgresql://bootstrap:test@localhost/club' })
		}));
		vi.doMock('./repository.js', () => ({
			createMariToolsRepository: () => ({ seedCommittedTerms })
		}));

		const { ensureMariToolsBootstrap } = await import('./bootstrap.js');
		await expect(ensureMariToolsBootstrap()).resolves.toBeUndefined();
		expect(seedCommittedTerms).not.toHaveBeenCalled();
	});

	it('swallows missing configuration', async () => {
		vi.doMock('$app/environment', () => ({ building: false }));
		vi.doMock('../config/environment.js', () => ({
			readRuntimeEnvironment: () => {
				throw new Error('unavailable');
			}
		}));
		vi.doMock('./repository.js', () => ({
			createMariToolsRepository: () => ({ seedCommittedTerms: vi.fn() })
		}));

		const { ensureMariToolsBootstrap } = await import('./bootstrap.js');
		await expect(ensureMariToolsBootstrap()).resolves.toBeUndefined();
	});
});
