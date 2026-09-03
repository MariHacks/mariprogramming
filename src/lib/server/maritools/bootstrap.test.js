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
		vi.doMock('../../../../drizzle/0011_moderation_mutes_bans.sql?raw', () => ({
			default: 'ALTER TABLE "mt_student_profiles" ADD COLUMN IF NOT EXISTS "muted_until" timestamp with time zone;'
		}));
		vi.doMock('../../../../drizzle/0012_moderation_ban_until.sql?raw', () => ({
			default: 'ALTER TABLE "mt_student_profiles" ADD COLUMN IF NOT EXISTS "banned_until" timestamp with time zone;'
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
			if (text.includes("to_regclass('public.mt_saved_schedules')")) {
				return { rows: [{ table_name: null }] };
			}
			if (text.includes('information_schema.columns')) {
				return { rows: [{ ok: 1 }] };
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
		vi.doMock('../../../../drizzle/0011_moderation_mutes_bans.sql?raw', () => ({
			default: 'ALTER TABLE "mt_student_profiles" ADD COLUMN IF NOT EXISTS "muted_until" timestamp with time zone;'
		}));
		vi.doMock('../../../../drizzle/0012_moderation_ban_until.sql?raw', () => ({
			default: 'ALTER TABLE "mt_student_profiles" ADD COLUMN IF NOT EXISTS "banned_until" timestamp with time zone;'
		}));
		vi.doMock('../../../../drizzle/0013_saved_schedules.sql?raw', () => ({
			default: 'CREATE TABLE "mt_saved_schedules" ();'
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
		expect(
			query.mock.calls.some((call) => String(call[0]).includes('CREATE TABLE "mt_saved_schedules"'))
		).toBe(true);
	});

	it('skips migration when mt_academic_terms already exists', async () => {
		const query = vi
			.fn()
			.mockResolvedValueOnce({ rows: [{ table_name: 'mt_academic_terms' }] })
			.mockResolvedValueOnce({ rows: [{ table_name: 'mt_google_calendar_grants' }] })
			.mockResolvedValueOnce({ rows: [{ table_name: 'mt_free_time_boards' }] })
			.mockResolvedValueOnce({ rows: [{ ok: 1 }] })
			.mockResolvedValueOnce({ rows: [{ ok: 1 }] })
			.mockResolvedValueOnce({ rows: [{ table_name: 'mt_saved_schedules' }] })
			.mockResolvedValueOnce({ rows: [{ ok: 1 }] })
			.mockResolvedValueOnce({ rows: [{ table_name: 'mt_programming_club_memberships' }] })
			.mockResolvedValueOnce({ rows: [{ ok: 1 }] })
			.mockResolvedValueOnce({ rows: [{ ok: 1 }] });
		const client = { query, release: vi.fn() };
		const pool = { connect: vi.fn(async () => client), end: vi.fn(async () => undefined) };
		const { ensureMariToolsSchema } = await import('./bootstrap.js');
		await ensureMariToolsSchema('postgresql://x', { createPool: () => /** @type {any} */ (pool) });
		expect(query).toHaveBeenCalledTimes(10);
	});

	it('builds a default pg pool', async () => {
		const { createDefaultMariToolsPool, ensureMariToolsSchema } = await import('./bootstrap.js');
		const pool = createDefaultMariToolsPool('postgresql://example');
		expect(pool).toBeTruthy();
		await pool.end();
		await expect(ensureMariToolsSchema('')).rejects.toThrow();
	});

	it('rolls back a failed incremental apply', async () => {
		const query = vi.fn(async (sql) => {
			const text = String(sql);
			if (text.includes("to_regclass('public.mt_academic_terms')")) {
				return { rows: [{ table_name: null }] };
			}
			if (text === 'BEGIN' || text === 'ROLLBACK') return { rows: [] };
			throw new Error('apply');
		});
		const client = { query, release: vi.fn() };
		const pool = { connect: vi.fn(async () => client), end: vi.fn(async () => undefined) };
		vi.doMock('../../../../drizzle/0008_maritools_persistence.sql?raw', () => ({
			default: 'CREATE TABLE "mt_academic_terms" ();'
		}));
		vi.doMock('../../../../drizzle/0009_google_calendar_grants.sql?raw', () => ({
			default: 'CREATE TABLE "mt_google_calendar_grants" ();'
		}));
		vi.doMock('../../../../drizzle/0010_free_time_boards.sql?raw', () => ({
			default: 'CREATE TABLE "mt_free_time_boards" ();'
		}));
		vi.doMock('../../../../drizzle/0011_moderation_mutes_bans.sql?raw', () => ({
			default: 'ALTER TABLE "mt_student_profiles" ADD COLUMN IF NOT EXISTS "muted_until" timestamp with time zone;'
		}));
		vi.doMock('../../../../drizzle/0012_moderation_ban_until.sql?raw', () => ({
			default: 'ALTER TABLE "mt_student_profiles" ADD COLUMN IF NOT EXISTS "banned_until" timestamp with time zone;'
		}));
		const { ensureMariToolsSchema } = await import('./bootstrap.js');
		await expect(
			ensureMariToolsSchema('postgresql://x', { createPool: () => /** @type {any} */ (pool) })
		).rejects.toThrow('apply');
		expect(query.mock.calls.some((call) => call[0] === 'ROLLBACK')).toBe(true);
	});

	it('rolls back and ignores pool cleanup failures', async () => {
		const query = vi.fn(async (sql) => {
			const text = String(sql);
			if (text.includes("to_regclass('public.mt_academic_terms')")) {
				return { rows: [{ table_name: null }] };
			}
			if (text === 'BEGIN') return { rows: [] };
			if (text === 'ROLLBACK') throw new Error('rollback');
			throw new Error('apply');
		});
		const client = {
			query,
			release: vi.fn(() => {
				throw new Error('release');
			})
		};
		const pool = {
			connect: vi.fn(async () => client),
			end: vi.fn(async () => {
				throw new Error('end');
			})
		};
		vi.doMock('../../../../drizzle/0008_maritools_persistence.sql?raw', () => ({
			default: 'CREATE TABLE "mt_academic_terms" ();'
		}));
		vi.doMock('../../../../drizzle/0009_google_calendar_grants.sql?raw', () => ({
			default: 'CREATE TABLE "mt_google_calendar_grants" ();'
		}));
		vi.doMock('../../../../drizzle/0010_free_time_boards.sql?raw', () => ({
			default: 'CREATE TABLE "mt_free_time_boards" ();'
		}));
		vi.doMock('../../../../drizzle/0011_moderation_mutes_bans.sql?raw', () => ({
			default: 'ALTER TABLE "mt_student_profiles" ADD COLUMN IF NOT EXISTS "muted_until" timestamp with time zone;'
		}));
		vi.doMock('../../../../drizzle/0012_moderation_ban_until.sql?raw', () => ({
			default: 'ALTER TABLE "mt_student_profiles" ADD COLUMN IF NOT EXISTS "banned_until" timestamp with time zone;'
		}));
		const { ensureMariToolsSchema } = await import('./bootstrap.js');
		await expect(
			ensureMariToolsSchema('postgresql://x', { createPool: () => /** @type {any} */ (pool) })
		).rejects.toThrow('apply');
	});

	it('rejects an empty incremental migration', async () => {
		const query = vi.fn(async () => ({ rows: [{ table_name: null }] }));
		const client = { query, release: vi.fn() };
		const pool = { connect: vi.fn(async () => client), end: vi.fn(async () => undefined) };
		vi.doMock('../../../../drizzle/0008_maritools_persistence.sql?raw', () => ({
			default: '   '
		}));
		vi.doMock('../../../../drizzle/0009_google_calendar_grants.sql?raw', () => ({
			default: 'CREATE TABLE "mt_google_calendar_grants" ();'
		}));
		vi.doMock('../../../../drizzle/0010_free_time_boards.sql?raw', () => ({
			default: 'CREATE TABLE "mt_free_time_boards" ();'
		}));
		vi.doMock('../../../../drizzle/0011_moderation_mutes_bans.sql?raw', () => ({
			default: 'ALTER TABLE "mt_student_profiles" ADD COLUMN IF NOT EXISTS "muted_until" timestamp with time zone;'
		}));
		vi.doMock('../../../../drizzle/0012_moderation_ban_until.sql?raw', () => ({
			default: 'ALTER TABLE "mt_student_profiles" ADD COLUMN IF NOT EXISTS "banned_until" timestamp with time zone;'
		}));
		const { ensureMariToolsSchema } = await import('./bootstrap.js');
		await expect(
			ensureMariToolsSchema('postgresql://x', { createPool: () => /** @type {any} */ (pool) })
		).rejects.toThrow(/empty/);
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
				throw 'unavailable';
			}
		}));
		vi.doMock('./repository.js', () => ({
			createMariToolsRepository: () => ({ seedCommittedTerms: vi.fn() })
		}));

		const { ensureMariToolsBootstrap } = await import('./bootstrap.js');
		await expect(ensureMariToolsBootstrap()).resolves.toBeUndefined();
	});

	it('skips seeding when no database url is configured', async () => {
		vi.doMock('$app/environment', () => ({ building: false }));
		vi.doMock('../config/environment.js', () => ({
			readRuntimeEnvironment: () => ({ databaseUrl: '' })
		}));
		const seedCommittedTerms = vi.fn();
		vi.doMock('./repository.js', () => ({
			createMariToolsRepository: () => ({ seedCommittedTerms })
		}));
		const { ensureMariToolsBootstrap } = await import('./bootstrap.js');
		await expect(ensureMariToolsBootstrap()).resolves.toBeUndefined();
		expect(seedCommittedTerms).not.toHaveBeenCalled();
	});

	it('logs non-error bootstrap failures', async () => {
		vi.doMock('$app/environment', () => ({ building: false }));
		vi.doMock('../config/environment.js', () => ({
			readRuntimeEnvironment: () => ({ databaseUrl: 'postgresql://x' })
		}));
		vi.doMock('./repository.js', () => ({
			createMariToolsRepository: () => ({
				seedCommittedTerms: async () => {
					throw 'nope';
				}
			})
		}));
		const { ensureMariToolsBootstrap } = await import('./bootstrap.js');
		await expect(ensureMariToolsBootstrap()).resolves.toBeUndefined();
	});

	it('releases nothing when connect fails', async () => {
		const pool = {
			connect: vi.fn(async () => {
				throw new Error('connect failed');
			}),
			end: vi.fn(async () => undefined)
		};
		const { ensureMariToolsSchema } = await import('./bootstrap.js');
		await expect(
			ensureMariToolsSchema('postgresql://x', { createPool: () => /** @type {any} */ (pool) })
		).rejects.toThrow('connect failed');
		expect(pool.end).toHaveBeenCalled();
	});

	it('treats a missing sentinel row as absent', async () => {
		const query = vi.fn(async () => ({ rows: [] }));
		const client = { query, release: vi.fn() };
		const pool = { connect: vi.fn(async () => client), end: vi.fn(async () => undefined) };
		vi.doMock('../../../../drizzle/0008_maritools_persistence.sql?raw', () => ({
			default: 'CREATE TABLE "mt_academic_terms" ();'
		}));
		vi.doMock('../../../../drizzle/0009_google_calendar_grants.sql?raw', () => ({
			default: 'CREATE TABLE "mt_google_calendar_grants" ();'
		}));
		vi.doMock('../../../../drizzle/0010_free_time_boards.sql?raw', () => ({
			default: 'CREATE TABLE "mt_free_time_boards" ();'
		}));
		vi.doMock('../../../../drizzle/0011_moderation_mutes_bans.sql?raw', () => ({
			default: 'ALTER TABLE "mt_student_profiles" ADD COLUMN IF NOT EXISTS "muted_until" timestamp with time zone;'
		}));
		vi.doMock('../../../../drizzle/0012_moderation_ban_until.sql?raw', () => ({
			default: 'ALTER TABLE "mt_student_profiles" ADD COLUMN IF NOT EXISTS "banned_until" timestamp with time zone;'
		}));
		const { ensureMariToolsSchema } = await import('./bootstrap.js');
		await ensureMariToolsSchema('postgresql://x', { createPool: () => /** @type {any} */ (pool) });
		expect(query.mock.calls.some((call) => call[0] === 'BEGIN')).toBe(true);
	});

	it('uses the default pg pool factory when none is injected', async () => {
		class FakePool {
			connect() {
				return Promise.reject(new Error('no real database'));
			}
			end() {
				return Promise.resolve();
			}
		}
		vi.doMock('pg', () => ({ default: { Pool: FakePool } }));
		const { ensureMariToolsSchema } = await import('./bootstrap.js');
		await expect(ensureMariToolsSchema('postgresql://x')).rejects.toThrow('no real database');
	});
});
