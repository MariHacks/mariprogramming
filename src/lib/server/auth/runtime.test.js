import { describe, expect, it, vi } from 'vitest';
import { createRequestAuth, findPersistedGoogleAccount, withRequestAuth } from './runtime.js';

/** @param {{ connectError?: Error, operationError?: Error, releaseError?: Error, endError?: Error }} [errors] */
function harness({ connectError, operationError, releaseError, endError } = {}) {
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
	const createPool = vi.fn(() => ({ connect, end }));
	const database = { marker: 'request-database' };
	const createDatabase = vi.fn(() => database);
	const adapter = vi.fn(() => ({ marker: 'adapter' }));
	const createAdapter = vi.fn(() => adapter);
	const auth = { api: { getSession: vi.fn() }, handler: vi.fn(), options: {} };
	const createAuth = vi.fn(() => auth);
	const environment = {
		databaseUrl: 'postgresql://runtime:secret@database.example/app',
		appOrigin: 'https://club.example.com',
		betterAuthOrigin: 'https://club.example.com',
		betterAuthSecret: 'a'.repeat(32),
		googleClientId: 'google-client-id',
		googleClientSecret: 'google-client-secret',
		rateLimitHmacKey: 'rate-limit-key-with-at-least-32-characters'
	};
	const readEnvironment = vi.fn(() => environment);
	const createOptions = vi.fn(() => ({ database: adapter }));
	const rateLimitStorage = { consume: vi.fn() };
	const createRateLimitStorage = vi.fn(() => rateLimitStorage);
	const findGoogleAccount = vi.fn(async () => ({
		providerId: 'google',
		accountId: 'google-subject-123',
		userId: 'user-123'
	}));

	return {
		adapter,
		auth,
		client,
		connect,
		createAdapter,
		createAuth,
		createDatabase,
		createOptions,
		createPool,
		createRateLimitStorage,
		database,
		end,
		environment,
		findGoogleAccount,
		readEnvironment,
		rateLimitStorage,
		release,
		operationError
	};
}

describe('request-scoped Better Auth runtime', () => {
	it.each([
		[
			'returns the provider account',
			[{ providerId: 'google', accountId: 'subject', userId: 'user-123' }]
		],
		['returns null when no Google account exists', []]
	])('%s through the production account query', async (_case, rows) => {
		const limit = vi.fn(async () => rows);
		const where = vi.fn(() => ({ limit }));
		const from = vi.fn(() => ({ where }));
		const select = vi.fn(() => ({ from }));
		await expect(findPersistedGoogleAccount({ select }, 'user-123')).resolves.toEqual(
			rows[0] ?? null
		);
		expect(select).toHaveBeenCalledWith({
			providerId: expect.anything(),
			accountId: expect.anything(),
			userId: expect.anything()
		});
		expect(limit).toHaveBeenCalledWith(1);
	});
	it('initializes the exact Drizzle adapter and one auth instance on one checked-out client', async () => {
		const setup = harness();
		const operation = vi.fn(async (runtime) => runtime.auth);

		await expect(withRequestAuth(operation, setup)).resolves.toBe(setup.auth);
		expect(setup.readEnvironment).toHaveBeenCalledOnce();
		expect(setup.createPool).toHaveBeenCalledWith(setup.environment.databaseUrl);
		expect(setup.connect).toHaveBeenCalledOnce();
		expect(setup.createDatabase).toHaveBeenCalledWith(setup.client);
		expect(setup.createAdapter).toHaveBeenCalledWith(setup.database, {
			provider: 'pg',
			schema: expect.objectContaining({ account: expect.anything(), session: expect.anything() })
		});
		expect(setup.createRateLimitStorage).toHaveBeenCalledWith(setup.database, {
			hmacKey: setup.environment.rateLimitHmacKey
		});
		expect(setup.createOptions).toHaveBeenCalledWith({
			database: expect.any(Function),
			environment: setup.environment,
			rateLimitStorage: setup.rateLimitStorage
		});
		expect(setup.createAuth).toHaveBeenCalledWith({ database: setup.adapter });
		expect(operation).toHaveBeenCalledWith({
			auth: setup.auth,
			findGoogleAccount: expect.any(Function)
		});
		expect(setup.release).toHaveBeenCalledOnce();
		expect(setup.end).toHaveBeenCalledOnce();
	});

	it('queries the persisted Google account for the current Better Auth user', async () => {
		const setup = harness();
		await withRequestAuth(async ({ findGoogleAccount }) => {
			await expect(findGoogleAccount('user-123')).resolves.toMatchObject({
				providerId: 'google',
				accountId: 'google-subject-123'
			});
		}, setup);
		expect(setup.findGoogleAccount).toHaveBeenCalledWith(setup.database, 'user-123');
	});

	it.each([
		['connection', { connectError: new Error('database secret connect') }],
		['operation', { operationError: new Error('database secret operation') }]
	])('closes resources and preserves the primary %s failure', async (_case, errors) => {
		const setup = harness(errors);
		const operation = async () => {
			if (setup.operationError) throw setup.operationError;
		};
		const expected = 'connectError' in errors ? errors.connectError : errors.operationError;
		await expect(withRequestAuth(operation, setup)).rejects.toBe(expected);
		expect(setup.release).toHaveBeenCalledTimes('connectError' in errors ? 0 : 1);
		expect(setup.end).toHaveBeenCalledOnce();
	});

	it('keeps the primary error first when cleanup also fails', async () => {
		const primary = new Error('database secret operation');
		const release = new Error('release failed');
		const end = new Error('end failed');
		const setup = harness({ operationError: primary, releaseError: release, endError: end });
		const failure = await withRequestAuth(async () => {
			throw primary;
		}, setup).catch((error) => error);
		expect(failure).toBeInstanceOf(globalThis.AggregateError);
		expect(failure.errors).toEqual([primary, release, end]);
		expect(failure.cause).toBe(primary);
	});

	it.each([
		['release', { releaseError: new Error('release failed') }],
		['pool shutdown', { endError: new Error('end failed') }]
	])('reports a lone %s failure after successful auth work', async (_case, errors) => {
		const setup = harness(errors);
		const expected = 'releaseError' in errors ? errors.releaseError : errors.endError;
		await expect(withRequestAuth(async () => 'ok', setup)).rejects.toBe(expected);
		expect(setup.end).toHaveBeenCalledOnce();
	});

	it('aggregates both cleanup failures after successful auth work', async () => {
		const release = new Error('release failed');
		const end = new Error('end failed');
		const setup = harness({ releaseError: release, endError: end });
		const failure = await withRequestAuth(async () => 'ok', setup).catch((error) => error);
		expect(failure).toBeInstanceOf(globalThis.AggregateError);
		expect(failure.errors).toEqual([release, end]);
	});

	it('builds the production runtime factories without module-global credentials', () => {
		expect(createRequestAuth).toEqual(expect.any(Function));
	});
});
