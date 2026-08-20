// @vitest-environment node

import { mkdtemp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:net';
import { PgDialect } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth/minimal';
import * as schema from '../db/schema';
import { createBetterAuthOptions } from '../auth/config.js';
import {
	RATE_LIMIT_POLICIES,
	consumeRateLimitInTransaction,
	createBetterAuthRateLimitStorage
} from './rate-limit.js';

const POSTGRES_BIN = '/Applications/Postgres.app/Contents/Versions/latest/bin';
const MIGRATIONS_DIRECTORY = resolve('drizzle');
const dialect = new PgDialect();
const FIXED_NOW = new Date('2026-08-13T16:00:00.000Z');

/** @type {string | undefined} */
let clusterRoot;
/** @type {string | undefined} */
let dataDirectory;
/** @type {string | undefined} */
let socketDirectory;
/** @type {number | undefined} */
let port;
/** @type {string | undefined} */
let runtimeDatabaseUrl;

/** @param {string} name */
function binary(name) {
	return join(POSTGRES_BIN, name);
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {import('node:child_process').SpawnSyncOptionsWithStringEncoding} [options]
 */
function run(command, args, options = { encoding: 'utf8' }) {
	return spawnSync(command, args, {
		env: {
			...process.env,
			PGHOST: socketDirectory,
			PGPORT: String(port),
			PGDATABASE: 'postgres',
			PGUSER: process.env.USER
		},
		...options,
		encoding: 'utf8'
	});
}

/** @param {string} statement */
function query(statement) {
	const result = run(binary('psql'), [
		'--no-psqlrc',
		'--set',
		'ON_ERROR_STOP=1',
		'--tuples-only',
		'--no-align',
		'--command',
		statement
	]);
	if (result.status !== 0) throw new Error(result.stderr || result.stdout);
	return result.stdout.trim();
}

/** @param {string} hmacKey @param {string} address @param {string} path */
function expectedAuthBucketKey(hmacKey, address, path) {
	const digest = createHmac('sha256', hmacKey)
		.update(`rate-limit\0v1\0auth_request\0${address}|${path}`)
		.digest('base64url');
	return `rl:v1:auth_request:${digest}`;
}

async function freePort() {
	return new Promise((resolvePort, reject) => {
		const server = createServer();
		server.once('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				server.close();
				reject(new Error('Could not reserve a PostgreSQL test port'));
				return;
			}
			server.close((error) => (error ? reject(error) : resolvePort(address.port)));
		});
	});
}

/** @param {unknown} drizzleQuery */
async function executeWithPsql(drizzleQuery) {
	const compiled = dialect.sqlToQuery(/** @type {any} */ (drizzleQuery));
	const script = `${compiled.sql}\n\\bind ${compiled.params
		.map(
			(value) =>
				`'${(value instanceof Date ? value.toISOString() : String(value)).replaceAll("'", "''")}'`
		)
		.join(' ')}\n\\g`;
	return new Promise((resolveResult, reject) => {
		const child = spawn(binary('psql'), ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--csv'], {
			env: {
				...process.env,
				PGHOST: socketDirectory,
				PGPORT: String(port),
				PGDATABASE: 'postgres',
				PGUSER: process.env.USER
			},
			stdio: ['pipe', 'pipe', 'pipe']
		});
		let stdout = '';
		let stderr = '';
		child.stdout.on('data', (chunk) => (stdout += chunk));
		child.stderr.on('data', (chunk) => (stderr += chunk));
		child.once('error', reject);
		child.once('exit', (code) => {
			if (code !== 0) {
				reject(new Error(stderr || stdout));
				return;
			}
			const [header, data] = stdout.trim().split('\n');
			const names = header.split(',');
			const values = data.split(',');
			resolveResult({
				rows: [
					Object.fromEntries(
						names.map((name, index) => [
							name,
							name === 'count' ? Number(values[index]) : values[index]
						])
					)
				]
			});
		});
		child.stdin.end(script);
	});
}

/** @param {Parameters<typeof consumeRateLimitInTransaction>[1]} options */
async function consumeFromPostgres(options) {
	try {
		return await consumeRateLimitInTransaction({ execute: executeWithPsql }, options);
	} catch (error) {
		throw /** @type {Error & { cause?: unknown }} */ (error).cause ?? error;
	}
}

describe.sequential('durable rate limiter against disposable PostgreSQL', () => {
	beforeAll(async () => {
		// PostgreSQL Unix-domain socket paths have a small platform limit; keep this disposable
		// integration cluster under a short, explicit temporary prefix.
		clusterRoot = await mkdtemp('/tmp/mpc-rate-limit-');
		dataDirectory = join(clusterRoot, 'data');
		socketDirectory = join(clusterRoot, 'socket');
		await mkdir(socketDirectory);
		port = await freePort();

		const initialized = run(binary('initdb'), [
			'--pgdata',
			dataDirectory,
			'--auth=trust',
			'--no-locale',
			'--encoding=UTF8'
		]);
		if (initialized.status !== 0) throw new Error(initialized.stderr);
		const started = run(binary('pg_ctl'), [
			'--pgdata',
			dataDirectory,
			'--log',
			join(clusterRoot, 'postgres.log'),
			'--options',
			`-F -k ${socketDirectory} -p ${port}`,
			'--wait',
			'start'
		]);
		if (started.status !== 0) throw new Error(started.stderr);

		const migrations = (await readdir(MIGRATIONS_DIRECTORY))
			.filter((name) => name.endsWith('.sql'))
			.sort();
		expect(migrations.length).toBeGreaterThan(0);
		for (const migrationName of migrations) {
			const migration = await readFile(join(MIGRATIONS_DIRECTORY, migrationName), 'utf8');
			const applied = run(binary('psql'), [
				'--no-psqlrc',
				'--set',
				'ON_ERROR_STOP=1',
				'--command',
				migration
			]);
			if (applied.status !== 0) throw new Error(applied.stderr);
		}
		query(`
			CREATE ROLE mariprogramming_runtime LOGIN;
			REVOKE ALL ON SCHEMA public FROM PUBLIC;
			GRANT USAGE ON SCHEMA public TO mariprogramming_runtime;
			GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
				"user", "session", "account", "verification", rate_limit_buckets
			TO mariprogramming_runtime;
			GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO mariprogramming_runtime;
		`);
		runtimeDatabaseUrl = `postgresql://mariprogramming_runtime@127.0.0.1:${port}/postgres`;
	}, 30000);

	afterAll(async () => {
		if (dataDirectory) {
			run(binary('pg_ctl'), ['--pgdata', dataDirectory, '--mode', 'immediate', '--wait', 'stop']);
		}
		if (clusterRoot) await rm(clusterRoot, { recursive: true, force: true });
	});

	it('serializes concurrent production upserts without lost increments', async () => {
		const bucketKey = 'rl:v1:checkout_email:IIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII';
		const options = {
			bucketKey,
			scope: 'checkout_email',
			...RATE_LIMIT_POLICIES.checkout_email,
			now: FIXED_NOW
		};
		const results = await Promise.all(
			Array.from({ length: 20 }, () => consumeFromPostgres(options))
		);

		expect(results.map((result) => result.used).sort((left, right) => left - right)).toEqual(
			Array.from({ length: 20 }, (_, index) => index + 1)
		);
		expect(results.filter((result) => result.allowed)).toHaveLength(10);
		expect(query(`SELECT count FROM rate_limit_buckets WHERE bucket_key = '${bucketKey}'`)).toBe(
			'20'
		);
	});

	it('resets count and expiry at the exact fixed-window boundary', async () => {
		const bucketKey = 'rl:v1:staff_session:JJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ';
		const first = await consumeFromPostgres({
			bucketKey,
			scope: 'staff_session',
			...RATE_LIMIT_POLICIES.staff_session,
			now: FIXED_NOW
		});
		const boundary = new Date(FIXED_NOW.getTime() + RATE_LIMIT_POLICIES.staff_session.windowMs);
		const reset = await consumeFromPostgres({
			bucketKey,
			scope: 'staff_session',
			...RATE_LIMIT_POLICIES.staff_session,
			now: boundary
		});

		expect(first.used).toBe(1);
		expect(reset).toMatchObject({ used: 1, allowed: true });
		expect(reset.resetAt).toBe(
			new Date(boundary.getTime() + RATE_LIMIT_POLICIES.staff_session.windowMs).toISOString()
		);
	});

	it('uses only the least-privilege runtime grants for HMAC-keyed auth initiation and callback buckets', async () => {
		const client = new Client({ connectionString: runtimeDatabaseUrl });
		await client.connect();
		try {
			const database = drizzle(client, { schema });
			const storage = createBetterAuthRateLimitStorage(database, {
				hmacKey: 'integration-rate-limit-key-with-at-least-32-characters',
				now: () => FIXED_NOW
			});
			await expect(
				storage.consume('203.0.113.44|/sign-in/social', { max: 3, window: 10 })
			).resolves.toEqual({ allowed: true, retryAfter: null });
			await expect(
				storage.consume('203.0.113.44|/callback/google', { max: 100, window: 60 })
			).resolves.toEqual({ allowed: true, retryAfter: null });
		} finally {
			await client.end();
		}

		expect(
			query(
				"SELECT count(*) FROM rate_limit_buckets WHERE scope = 'auth_request' AND bucket_key LIKE 'rl:v1:auth_request:%'"
			)
		).toBe('2');
		expect(query("SELECT to_regclass('public.rate_limit') IS NULL")).toBe('t');
		expect(
			query(
				"SELECT has_table_privilege('mariprogramming_runtime', 'rate_limit_buckets', 'SELECT,INSERT,UPDATE,DELETE')"
			)
		).toBe('t');
		expect(query("SELECT has_table_privilege('mariprogramming_runtime', 'orders', 'SELECT')")).toBe(
			'f'
		);
	});

	it('bounds nonexistent real Better Auth paths to one strict fallback row per trusted client', async () => {
		query("DELETE FROM rate_limit_buckets WHERE scope = 'auth_request'");
		const client = new Client({ connectionString: runtimeDatabaseUrl });
		await client.connect();
		const trustedAddress = '198.51.100.60';
		const unknownPaths = Array.from(
			{ length: 5 },
			(_, index) => `/api/auth/not-a-route-${index + 1}`
		);
		try {
			const database = drizzle(client, { schema });
			const rateLimitStorage = createBetterAuthRateLimitStorage(database, {
				hmacKey: 'bounded-auth-rate-limit-key-with-at-least-32-characters',
				now: () => FIXED_NOW
			});
			const origin = 'https://books.example.com';
			const auth = betterAuth(
				createBetterAuthOptions({
					database: drizzleAdapter(database, { provider: 'pg', schema }),
					environment: {
						appOrigin: origin,
						betterAuthOrigin: origin,
						betterAuthSecret: 'integration-better-auth-secret-with-at-least-32-characters',
						googleClientId: 'integration-client-id.apps.googleusercontent.com',
						googleClientSecret: 'integration-google-client-secret',
						isVercel: true
					},
					rateLimitStorage,
					fetchGoogleProfile: async () => null
				})
			);

			const statuses = [];
			for (const [index, path] of unknownPaths.entries()) {
				const response = await auth.handler(
					new Request(`${origin}${path}`, {
						headers: {
							'x-forwarded-for': `203.0.113.${index + 1}`,
							'x-vercel-forwarded-for': trustedAddress
						}
					})
				);
				statuses.push(response.status);
			}
			expect(statuses).toEqual([404, 404, 404, 429, 429]);
		} finally {
			await client.end();
		}

		expect(query("SELECT count(*) FROM rate_limit_buckets WHERE scope = 'auth_request'")).toBe('1');
		expect(query("SELECT count FROM rate_limit_buckets WHERE scope = 'auth_request'")).toBe('5');
		expect(
			query(
				"SELECT extract(epoch FROM (expires_at - window_started_at))::integer FROM rate_limit_buckets WHERE scope = 'auth_request'"
			)
		).toBe('10');
		expect(
			query(
				"SELECT count(*) FROM rate_limit_buckets WHERE bucket_key LIKE '%198.51.100.60%' OR bucket_key LIKE '%203.0.113.%' OR bucket_key LIKE '%not-a-route%'"
			)
		).toBe('0');
	});

	it('uses only trusted Vercel client addresses for real Better Auth initiation and callback quotas', async () => {
		query("DELETE FROM rate_limit_buckets WHERE scope = 'auth_request'");
		const client = new Client({ connectionString: runtimeDatabaseUrl });
		await client.connect();
		const hmacKey = 'real-auth-rate-limit-key-with-at-least-32-characters';
		const trustedAddress = '198.51.100.40';
		const otherTrustedAddress = '198.51.100.41';
		try {
			const database = drizzle(client, { schema });
			const rateLimitStorage = createBetterAuthRateLimitStorage(database, { hmacKey });
			const origin = 'http://127.0.0.1:4173';
			const auth = betterAuth(
				createBetterAuthOptions({
					database: drizzleAdapter(database, { provider: 'pg', schema }),
					environment: {
						appOrigin: origin,
						betterAuthOrigin: origin,
						betterAuthSecret: 'integration-better-auth-secret-with-at-least-32-characters',
						googleClientId: 'integration-client-id.apps.googleusercontent.com',
						googleClientSecret: 'integration-google-client-secret',
						isVercel: true
					},
					rateLimitStorage,
					fetchGoogleProfile: async () => ({
						sub: 'integration-google-subject',
						email: 'team@marihacks.com',
						email_verified: true,
						name: 'Programming Club Team'
					})
				})
			);
			/** @param {string} spoofedAddress @param {string} platformAddress */
			async function initiateSignIn(spoofedAddress, platformAddress) {
				return auth.handler(
					new Request(`${origin}/api/auth/sign-in/social`, {
						method: 'POST',
						headers: {
							'content-type': 'application/json',
							origin,
							'x-forwarded-for': spoofedAddress,
							'x-vercel-forwarded-for': platformAddress
						},
						body: JSON.stringify({
							provider: 'google',
							callbackURL: `${origin}/staff`,
							errorCallbackURL: `${origin}/staff/sign-in?state=unavailable`,
							disableRedirect: true
						})
					})
				);
			}

			const signIn = await initiateSignIn('203.0.113.91', trustedAddress);
			const sameClientWithSpoofedXff = await initiateSignIn('203.0.113.92', trustedAddress);
			const otherClient = await initiateSignIn('203.0.113.91', otherTrustedAddress);
			expect([signIn.status, sameClientWithSpoofedXff.status, otherClient.status]).toEqual([
				200, 200, 200
			]);
			const authorization = new URL((await signIn.json()).url);
			const state = authorization.searchParams.get('state');
			const stateCookie = signIn.headers.get('set-cookie')?.split(';', 1)[0];
			expect(state).toEqual(expect.any(String));
			expect(stateCookie).toEqual(expect.any(String));

			vi.stubGlobal(
				'fetch',
				vi.fn(async (input) => {
					const url = input instanceof Request ? input.url : String(input);
					if (url !== 'https://oauth2.googleapis.com/token') {
						throw new Error('Unexpected external request');
					}
					return Response.json({
						access_token: 'integration-access-token',
						expires_in: 3600,
						token_type: 'Bearer',
						scope: 'email openid profile'
					});
				})
			);
			const callback = await auth.handler(
				new Request(
					`${origin}/api/auth/callback/google?code=integration-code&state=${encodeURIComponent(/** @type {string} */ (state))}`,
					{
						headers: {
							cookie: /** @type {string} */ (stateCookie),
							'x-forwarded-for': '203.0.113.250',
							'x-vercel-forwarded-for': trustedAddress
						}
					}
				)
			);
			expect(callback.status).toBe(302);
			expect(callback.headers.get('set-cookie')).toContain('mari-staff.session_token=');
		} finally {
			vi.unstubAllGlobals();
			await client.end();
		}

		expect(query("SELECT count(*) FROM rate_limit_buckets WHERE scope = 'auth_request'")).toBe('3');
		expect(
			query(
				`SELECT count FROM rate_limit_buckets WHERE bucket_key = '${expectedAuthBucketKey(hmacKey, trustedAddress, '/sign-in/social')}'`
			)
		).toBe('2');
		expect(
			query(
				`SELECT count FROM rate_limit_buckets WHERE bucket_key = '${expectedAuthBucketKey(hmacKey, otherTrustedAddress, '/sign-in/social')}'`
			)
		).toBe('1');
		expect(
			query(
				`SELECT count FROM rate_limit_buckets WHERE bucket_key = '${expectedAuthBucketKey(hmacKey, trustedAddress, '/callback/google')}'`
			)
		).toBe('1');
		expect(
			query(
				"SELECT count(*) FROM rate_limit_buckets WHERE bucket_key LIKE '%203.0.113.%' OR bucket_key LIKE '%198.51.100.%' OR bucket_key LIKE '%sign-in%' OR bucket_key LIKE '%callback%'"
			)
		).toBe('0');
		expect(query('SELECT count(*) FROM "session" WHERE user_id IS NOT NULL')).toBe('1');
	});
});
