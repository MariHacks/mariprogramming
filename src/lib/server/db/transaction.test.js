import { describe, expect, it, vi } from 'vitest';
import {
	createRequestPool,
	createTransactionDatabase,
	withDatabaseTransaction
} from './transaction';

/**
 * @param {{ connectError?: Error, operationError?: Error, releaseError?: Error, endError?: Error }} [errors]
 */
function harness({ connectError, operationError, releaseError, endError } = {}) {
	/** @param {(transaction: { connection: string }) => Promise<unknown>} callback */
	const transaction = vi.fn(async (callback) => {
		if (operationError) throw operationError;
		return callback({ connection: 'checked-out-client' });
	});
	const database = { transaction };
	const createDatabase = vi.fn(() => database);
	const release = vi.fn(() => {
		if (releaseError) throw releaseError;
	});
	const client = { release };
	const connect = vi.fn(async () => {
		if (connectError) throw connectError;
		return client;
	});
	const end = vi.fn(async () => {
		if (endError) throw endError;
	});
	const pool = { connect, end };
	const createPool = vi.fn(() => pool);

	return { client, connect, createDatabase, createPool, database, end, pool, release, transaction };
}

describe('request-scoped database transactions', () => {
	it('builds the production Neon WebSocket pool and Drizzle database adapters', async () => {
		const pool = createRequestPool('postgresql://runtime:secret@database.example/app');
		expect(pool.options.connectionString).toBe('postgresql://runtime:secret@database.example/app');
		await pool.end();

		const database = createTransactionDatabase(
			/** @type {import('@neondatabase/serverless').PoolClient} */ ({})
		);
		expect(database.transaction).toEqual(expect.any(Function));
	});

	it('uses direct PostgreSQL only for the explicit isolated local mode', async () => {
		const previousMode = process.env.LIVE_E2E_MODE;
		process.env.LIVE_E2E_MODE = 'isolated-local';
		try {
			const pool = createRequestPool('postgresql://local:secret@127.0.0.1:5432/app');
			expect(pool.constructor.name).toBe('BoundPool');
			expect(pool.options.connectionString).toBe(
				'postgresql://local:secret@127.0.0.1:5432/app'
			);
			await pool.end();

			const database = createTransactionDatabase(/** @type {any} */ ({}));
			expect(database.transaction).toEqual(expect.any(Function));
		} finally {
			if (previousMode === undefined) delete process.env.LIVE_E2E_MODE;
			else process.env.LIVE_E2E_MODE = previousMode;
		}
	});

	it('uses one checked-out client for the callback, then releases and closes in order', async () => {
		/** @type {string[]} */
		const calls = [];
		const setup = harness();
		setup.release.mockImplementation(() => {
			calls.push('release');
		});
		setup.end.mockImplementation(async () => {
			calls.push('end');
		});
		/** @param {{ connection: string }} transaction */
		const operation = vi.fn(async (transaction) => {
			calls.push('operation');
			return transaction.connection;
		});

		await expect(
			withDatabaseTransaction(operation, {
				databaseUrl: 'postgresql://runtime:secret@database.example/app',
				createPool: setup.createPool,
				createDatabase: setup.createDatabase
			})
		).resolves.toBe('checked-out-client');

		expect(setup.createPool).toHaveBeenCalledOnce();
		expect(setup.createPool).toHaveBeenCalledWith(
			'postgresql://runtime:secret@database.example/app'
		);
		expect(setup.connect).toHaveBeenCalledOnce();
		expect(setup.createDatabase).toHaveBeenCalledWith(setup.client);
		expect(setup.transaction).toHaveBeenCalledOnce();
		expect(operation).toHaveBeenCalledOnce();
		expect(calls).toEqual(['operation', 'release', 'end']);
	});

	it('rolls back through the database transaction and always releases on callback failure', async () => {
		const operationError = new Error('operation failed');
		const setup = harness({ operationError });

		await expect(
			withDatabaseTransaction(vi.fn(), {
				databaseUrl: 'postgresql://runtime:secret@database.example/app',
				createPool: setup.createPool,
				createDatabase: setup.createDatabase
			})
		).rejects.toBe(operationError);

		expect(setup.release).toHaveBeenCalledOnce();
		expect(setup.end).toHaveBeenCalledOnce();
	});

	it('closes the request pool when checkout fails before a client exists', async () => {
		const connectError = new Error('connect failed');
		const setup = harness({ connectError });

		await expect(
			withDatabaseTransaction(vi.fn(), {
				databaseUrl: 'postgresql://runtime:secret@database.example/app',
				createPool: setup.createPool,
				createDatabase: setup.createDatabase
			})
		).rejects.toBe(connectError);

		expect(setup.createDatabase).not.toHaveBeenCalled();
		expect(setup.release).not.toHaveBeenCalled();
		expect(setup.end).toHaveBeenCalledOnce();
	});

	it('still closes the pool if releasing the client fails', async () => {
		const releaseError = new Error('release failed');
		const setup = harness({ releaseError });

		await expect(
			withDatabaseTransaction(vi.fn(), {
				databaseUrl: 'postgresql://runtime:secret@database.example/app',
				createPool: setup.createPool,
				createDatabase: setup.createDatabase
			})
		).rejects.toBe(releaseError);
		expect(setup.end).toHaveBeenCalledOnce();
	});

	it('propagates pool-close failure after a successful operation', async () => {
		const endError = new Error('end failed');
		const setup = harness({ endError });

		await expect(
			withDatabaseTransaction(vi.fn(), {
				databaseUrl: 'postgresql://runtime:secret@database.example/app',
				createPool: setup.createPool,
				createDatabase: setup.createDatabase
			})
		).rejects.toBe(endError);
		expect(setup.release).toHaveBeenCalledOnce();
	});

	it('preserves the operation error inside combined failure when release also fails', async () => {
		const operationError = new Error('operation failed');
		const releaseError = new Error('release failed');
		const setup = harness({ operationError, releaseError });

		const failure = await withDatabaseTransaction(vi.fn(), {
			databaseUrl: 'postgresql://runtime:secret@database.example/app',
			createPool: setup.createPool,
			createDatabase: setup.createDatabase
		}).catch((error) => error);
		expect(failure.errors).toEqual([operationError, releaseError]);
		expect(failure.cause).toBe(operationError);
		expect(setup.end).toHaveBeenCalledOnce();
	});

	it('attaches both cleanup failures while retaining the operation error first', async () => {
		const operationError = new Error('operation failed');
		const releaseError = new Error('release failed');
		const endError = new Error('end failed');
		const setup = harness({ operationError, releaseError, endError });

		const failure = await withDatabaseTransaction(vi.fn(), {
			databaseUrl: 'postgresql://runtime:secret@database.example/app',
			createPool: setup.createPool,
			createDatabase: setup.createDatabase
		}).catch((error) => error);
		expect(failure.errors).toEqual([operationError, releaseError, endError]);
		expect(failure.cause).toBe(operationError);
	});

	it('preserves the operation error inside combined failure when pool shutdown fails', async () => {
		const operationError = new Error('operation failed');
		const endError = new Error('end failed');
		const setup = harness({ operationError, endError });

		const failure = await withDatabaseTransaction(vi.fn(), {
			databaseUrl: 'postgresql://runtime:secret@database.example/app',
			createPool: setup.createPool,
			createDatabase: setup.createDatabase
		}).catch((error) => error);
		expect(failure.errors).toEqual([operationError, endError]);
		expect(failure.cause).toBe(operationError);
		expect(setup.release).toHaveBeenCalledOnce();
	});

	it('preserves the connection error inside combined failure when pool shutdown fails', async () => {
		const connectError = new Error('connect failed');
		const endError = new Error('end failed');
		const setup = harness({ connectError, endError });

		const failure = await withDatabaseTransaction(vi.fn(), {
			databaseUrl: 'postgresql://runtime:secret@database.example/app',
			createPool: setup.createPool,
			createDatabase: setup.createDatabase
		}).catch((error) => error);
		expect(failure.errors).toEqual([connectError, endError]);
		expect(failure.cause).toBe(connectError);
		expect(setup.release).not.toHaveBeenCalled();
	});

	it('reports both cleanup failures after a successful operation', async () => {
		const releaseError = new Error('release failed');
		const endError = new Error('end failed');
		const setup = harness({ releaseError, endError });

		const failure = await withDatabaseTransaction(vi.fn(), {
			databaseUrl: 'postgresql://runtime:secret@database.example/app',
			createPool: setup.createPool,
			createDatabase: setup.createDatabase
		}).catch((error) => error);

		expect(failure).toBeInstanceOf(globalThis.AggregateError);
		expect(failure.errors).toEqual([releaseError, endError]);
		expect(setup.release).toHaveBeenCalledOnce();
		expect(setup.end).toHaveBeenCalledOnce();
	});

	it('keeps an existing primary-error cause when cleanup also fails', async () => {
		const originalCause = new Error('upstream failed');
		const operationError = new Error('operation failed', { cause: originalCause });
		const releaseError = new Error('release failed');
		const setup = harness({ operationError, releaseError });

		const failure = await withDatabaseTransaction(vi.fn(), {
			databaseUrl: 'postgresql://runtime:secret@database.example/app',
			createPool: setup.createPool,
			createDatabase: setup.createDatabase
		}).catch((error) => error);

		expect(failure).toBeInstanceOf(globalThis.AggregateError);
		expect(failure.errors).toEqual([operationError, releaseError]);
		expect(failure.cause).toBe(operationError);
		expect(operationError.cause).toBe(originalCause);
	});

	it('preserves a frozen primary error and its stack when cleanup fails', async () => {
		const connectError = Object.freeze(new Error('connect failed'));
		const originalStack = connectError.stack;
		const endError = new Error('end failed');
		const setup = harness({ connectError, endError });

		const failure = await withDatabaseTransaction(vi.fn(), {
			databaseUrl: 'postgresql://runtime:secret@database.example/app',
			createPool: setup.createPool,
			createDatabase: setup.createDatabase
		}).catch((error) => error);

		expect(failure).toBeInstanceOf(globalThis.AggregateError);
		expect(failure.errors).toEqual([connectError, endError]);
		expect(failure.cause).toBe(connectError);
		expect(failure.errors[0].stack).toBe(originalStack);
	});
});
