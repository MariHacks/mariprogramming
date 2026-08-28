import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth/minimal';
import { and, eq } from 'drizzle-orm';
import { createBetterAuthOptions } from './config.js';
import { createBetterAuthRateLimitStorage } from '../security/rate-limit.js';
import { readRuntimeEnvironment } from '../config/environment.js';
import { account } from '../db/schema';
import * as schema from '../db/schema';
import { createRequestPool, createTransactionDatabase } from '../db/transaction.js';

/**
 * @param {unknown} database
 * @param {string} userId
 */
export async function findPersistedGoogleAccount(database, userId) {
	const rows = await /** @type {any} */ (database)
		.select({
			providerId: account.providerId,
			accountId: account.accountId,
			userId: account.userId
		})
		.from(account)
		.where(and(eq(account.userId, userId), eq(account.providerId, 'google')))
		.limit(1);
	return rows[0] ?? null;
}

/**
 * Creates one Better Auth instance backed by the exact checked-out request connection.
 *
 * @param {unknown} database
 * @param {ReturnType<typeof readRuntimeEnvironment>} environment
 * @param {any} [factories]
 */
export function createRequestAuth(
	database,
	environment,
	{
		createAdapter = drizzleAdapter,
		createAuth = betterAuth,
		createOptions = createBetterAuthOptions,
		createRateLimitStorage = createBetterAuthRateLimitStorage
	} = {}
) {
	const adapter = createAdapter(database, { provider: 'pg', schema });
	const rateLimitStorage = createRateLimitStorage(database, {
		hmacKey: environment.rateLimitHmacKey
	});
	return createAuth(createOptions({ database: adapter, environment, rateLimitStorage }));
}

/**
 * Keeps the checked-out client alive for both the session lookup and the official auth handler,
 * then attempts every cleanup operation without replacing the primary failure.
 *
 * @template Result
 * @param {(runtime: { auth: ReturnType<typeof betterAuth>, findGoogleAccount: (userId: string) => Promise<unknown> }) => Promise<Result>} operation
 * @param {any} [dependencies]
 * @returns {Promise<Result>}
 */
export async function withRequestAuth(
	operation,
	{
		readEnvironment = readRuntimeEnvironment,
		createPool = createRequestPool,
		createDatabase = createTransactionDatabase,
		createAdapter = drizzleAdapter,
		createAuth = betterAuth,
		createOptions = createBetterAuthOptions,
		createRateLimitStorage = createBetterAuthRateLimitStorage,
		findGoogleAccount = findPersistedGoogleAccount
	} = {}
) {
	const environment = readEnvironment();
	const pool = createPool(environment.databaseUrl);
	/** @type {{ release: () => void } | undefined} */
	let client;
	/** @type {unknown} */
	let primaryError;
	let failed = false;
	/** @type {Result | undefined} */
	let result;
	/** @type {unknown[]} */
	const cleanupErrors = [];

	try {
		client = await pool.connect();
		const database = createDatabase(client, environment.databaseUrl);
		const auth = createRequestAuth(database, environment, {
			createAdapter,
			createAuth,
			createOptions,
			createRateLimitStorage
		});
		result = await operation({
			auth,
			findGoogleAccount: (userId) => findGoogleAccount(database, userId)
		});
	} catch (error) {
		failed = true;
		primaryError = error;
	} finally {
		try {
			client?.release();
		} catch (error) {
			cleanupErrors.push(error);
		}

		try {
			await pool.end();
		} catch (error) {
			cleanupErrors.push(error);
		}
	}

	if (failed) {
		if (cleanupErrors.length) {
			throw new globalThis.AggregateError(
				[primaryError, ...cleanupErrors],
				'Authentication request and cleanup failed',
				{ cause: primaryError }
			);
		}
		throw primaryError;
	}
	if (cleanupErrors.length === 1) throw cleanupErrors[0];
	if (cleanupErrors.length > 1)
		throw new globalThis.AggregateError(cleanupErrors, 'Authentication cleanup failed');
	return /** @type {Result} */ (result);
}
