import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	_resetPblSchemaPromise,
	createPblPool,
	ensurePblSchema,
	ensurePblSchemaAvailable
} from './bootstrap.js';

afterEach(() => {
	_resetPblSchemaPromise();
});

function poolHarness(query) {
	const client = {
		query,
		release: vi.fn()
	};
	return {
		client,
		pool: {
			connect: vi.fn(async () => client),
			end: vi.fn(async () => undefined)
		}
	};
}

describe('PBL schema bootstrap', () => {
	it('skips cleanup when connect fails before a client exists', async () => {
		const pool = {
			connect: vi.fn(async () => {
				throw new Error('no connect');
			}),
			end: vi.fn(async () => undefined)
		};
		await expect(
			ensurePblSchema('postgresql://u:p@localhost/db', { createPool: () => pool })
		).rejects.toThrow('no connect');
	});

	it('skips work when pbl_rooms already exists', async () => {
		const query = vi.fn(async (sql) => {
			const text = String(sql);
			if (text.includes("to_regclass('public.pbl_step_submissions')"))
				return { rows: [{ table_name: 'pbl_step_submissions' }] };
			if (text.includes('to_regclass')) return { rows: [{ table_name: 'pbl_rooms' }] };
			if (text.includes('driver_member_id'))
				return { rows: [{ column_name: 'driver_member_id' }] };
			if (text.includes('step_sources')) return { rows: [{ column_name: 'step_sources' }] };
			if (text.includes('yjs_state')) return { rows: [{ column_name: 'yjs_state' }] };
			if (text.includes("table_name = 'pbl_room_members'") || text.includes('user_id'))
				return { rows: [{ column_name: 'user_id' }] };
			return { rows: [] };
		});
		const { pool } = poolHarness(query);
		await ensurePblSchema('postgresql://u:p@localhost/db', { createPool: () => pool });
		expect(query.mock.calls.some((call) => String(call[0]).includes('CREATE TABLE'))).toBe(false);
	});

	it('adds driver_member_id when the rooms table exists without it', async () => {
		const query = vi.fn(async (sql) => {
			if (String(sql).includes('to_regclass')) return { rows: [{ table_name: 'pbl_rooms' }] };
			if (String(sql).includes('information_schema')) return { rows: [] };
			return { rows: [] };
		});
		const { pool } = poolHarness(query);
		await ensurePblSchema('postgresql://u:p@localhost/db', { createPool: () => pool });
		expect(
			query.mock.calls.some(
				(call) => String(call[0]).includes('driver_member_id') && String(call[0]).includes('ALTER')
			)
		).toBe(true);
		expect(
			query.mock.calls.some(
				(call) => String(call[0]).includes('yjs_state') && String(call[0]).includes('ALTER')
			)
		).toBe(true);
	});

	it('still reports the original error if yjs alter rollback fails', async () => {
		const query = vi.fn(async (sql) => {
			if (String(sql).includes('to_regclass')) return { rows: [{ table_name: 'pbl_rooms' }] };
			if (String(sql).includes('driver_member_id'))
				return { rows: [{ column_name: 'driver_member_id' }] };
			if (String(sql).includes('ALTER') && String(sql).includes('yjs_state')) {
				throw new Error('cannot alter');
			}
			if (String(sql) === 'ROLLBACK') throw new Error('rollback failed');
			return { rows: [] };
		});
		const { pool } = poolHarness(query);
		await expect(
			ensurePblSchema('postgresql://u:p@localhost/db', { createPool: () => pool })
		).rejects.toThrow('cannot alter');
	});

	it('rolls back when adding yjs_state fails', async () => {
		const query = vi.fn(async (sql) => {
			if (String(sql).includes('to_regclass')) return { rows: [{ table_name: 'pbl_rooms' }] };
			if (String(sql).includes('driver_member_id'))
				return { rows: [{ column_name: 'driver_member_id' }] };
			if (String(sql).includes('ALTER') && String(sql).includes('yjs_state')) {
				throw new Error('cannot alter');
			}
			return { rows: [] };
		});
		const { pool } = poolHarness(query);
		await expect(
			ensurePblSchema('postgresql://u:p@localhost/db', { createPool: () => pool })
		).rejects.toThrow('cannot alter');
		expect(query).toHaveBeenCalledWith('ROLLBACK');
	});

	it('adds member user_id when rooms already have driver and yjs columns', async () => {
		const query = vi.fn(async (sql) => {
			if (String(sql).includes('to_regclass')) return { rows: [{ table_name: 'pbl_rooms' }] };
			if (String(sql).includes('driver_member_id'))
				return { rows: [{ column_name: 'driver_member_id' }] };
			if (String(sql).includes('yjs_state')) return { rows: [{ column_name: 'yjs_state' }] };
			if (String(sql).includes("table_name = 'pbl_room_members'")) return { rows: [] };
			return { rows: [] };
		});
		const { pool } = poolHarness(query);
		await ensurePblSchema('postgresql://u:p@localhost/db', { createPool: () => pool });
		expect(
			query.mock.calls.some(
				(call) => String(call[0]).includes('user_id') && String(call[0]).includes('ALTER')
			)
		).toBe(true);
	});

	it('adds yjs_state when the rooms table already has a driver column', async () => {
		const query = vi.fn(async (sql) => {
			if (String(sql).includes('to_regclass')) return { rows: [{ table_name: 'pbl_rooms' }] };
			if (String(sql).includes('driver_member_id'))
				return { rows: [{ column_name: 'driver_member_id' }] };
			return { rows: [] };
		});
		const { pool } = poolHarness(query);
		await ensurePblSchema('postgresql://u:p@localhost/db', { createPool: () => pool });
		expect(
			query.mock.calls.some(
				(call) => String(call[0]).includes('yjs_state') && String(call[0]).includes('ALTER')
			)
		).toBe(true);
	});

	it('applies grants when the runtime role exists', async () => {
		const query = vi.fn(async (sql) => {
			if (String(sql).includes('to_regclass')) return { rows: [{ table_name: null }] };
			return { rows: [] };
		});
		const { pool } = poolHarness(query);
		await ensurePblSchema('postgresql://u:p@localhost/db', { createPool: () => pool });
		expect(query).toHaveBeenCalledWith('COMMIT');
		expect(query.mock.calls.some((call) => String(call[0]).includes('GRANT'))).toBe(true);
	});

	it('ignores a non-Error grant failure that names the runtime role', async () => {
		const query = vi.fn(async (sql) => {
			if (String(sql).includes('to_regclass')) return { rows: [{ table_name: null }] };
			if (String(sql).includes('GRANT')) throw 'role mariprogramming_runtime is missing';
			return { rows: [] };
		});
		const { pool } = poolHarness(query);
		await ensurePblSchema('postgresql://u:p@localhost/db', { createPool: () => pool });
		expect(query).toHaveBeenCalledWith('COMMIT');
	});

	it('applies the migration and ignores a missing runtime role', async () => {
		const query = vi.fn(async (sql) => {
			if (String(sql).includes('to_regclass')) return { rows: [{ table_name: null }] };
			if (String(sql).includes('GRANT')) {
				throw new Error('role "mariprogramming_runtime" does not exist');
			}
			return { rows: [] };
		});
		const { pool } = poolHarness(query);
		await ensurePblSchema('postgresql://u:p@localhost/db', { createPool: () => pool });
		expect(query).toHaveBeenCalledWith('COMMIT');
	});

	it('rolls back when a statement fails', async () => {
		const query = vi.fn(async (sql) => {
			if (String(sql).includes('to_regclass')) return { rows: [{ table_name: null }] };
			if (String(sql).includes('CREATE TABLE "pbl_rooms"')) throw new Error('cannot create');
			return { rows: [] };
		});
		const { pool } = poolHarness(query);
		await expect(
			ensurePblSchema('postgresql://u:p@localhost/db', { createPool: () => pool })
		).rejects.toThrow('cannot create');
		expect(query).toHaveBeenCalledWith('ROLLBACK');
	});

	it('uses the migrator URL when present and resets after failure', async () => {
		const applySchema = vi.fn(async () => undefined);
		await ensurePblSchemaAvailable({
			readMigration: () => ({ databaseUrl: 'postgresql://migrator:p@localhost/db' }),
			applySchema
		});
		await ensurePblSchemaAvailable({
			readMigration: () => ({ databaseUrl: 'postgresql://migrator:p@localhost/db' }),
			applySchema
		});
		expect(applySchema).toHaveBeenCalledTimes(1);
		expect(applySchema).toHaveBeenCalledWith('postgresql://migrator:p@localhost/db');
		_resetPblSchemaPromise();
		const failing = vi.fn(async () => {
			throw new Error('down');
		});
		await expect(
			ensurePblSchemaAvailable({
				readMigration: () => {
					throw new Error('no migrator');
				},
				readPbl: () => ({ databaseUrl: 'postgresql://runtime:p@localhost/db' }),
				applySchema: failing
			})
		).rejects.toThrow('down');
		_resetPblSchemaPromise();
		await expect(ensurePblSchemaAvailable({ applySchema: vi.fn() })).rejects.toThrow();
		_resetPblSchemaPromise();
		await expect(
			ensurePblSchemaAvailable({
				readMigration: () => ({ databaseUrl: 'postgresql://u:p@127.0.0.1/missing' })
			})
		).rejects.toThrow();
	});

	it('exports a pool factory', async () => {
		const pool = createPblPool('postgresql://u:p@127.0.0.1/db');
		expect(pool).toBeTruthy();
		await pool.end();
	});

	it('still reports the original error if cleanup fails', async () => {
		const query = vi.fn(async (sql) => {
			if (String(sql).includes('to_regclass')) return { rows: [{ table_name: null }] };
			if (String(sql).includes('CREATE TABLE "pbl_rooms"')) throw new Error('cannot create');
			if (String(sql) === 'ROLLBACK') throw new Error('rollback failed');
			return { rows: [] };
		});
		const client = {
			query,
			release: vi.fn(() => {
				throw new Error('release failed');
			})
		};
		const pool = {
			connect: vi.fn(async () => client),
			end: vi.fn(async () => {
				throw new Error('end failed');
			})
		};
		await expect(
			ensurePblSchema('postgresql://u:p@localhost/db', { createPool: () => pool })
		).rejects.toThrow('cannot create');
	});

	it('rolls back a grant that fails for a reason other than a missing role', async () => {
		const query = vi.fn(async (sql) => {
			if (String(sql).includes('to_regclass')) return { rows: [{ table_name: null }] };
			if (String(sql).includes('GRANT')) throw new Error('permission denied');
			return { rows: [] };
		});
		const { pool } = poolHarness(query);
		await expect(
			ensurePblSchema('postgresql://u:p@localhost/db', { createPool: () => pool })
		).rejects.toThrow('permission denied');
		expect(query).toHaveBeenCalledWith('ROLLBACK');
	});
});
