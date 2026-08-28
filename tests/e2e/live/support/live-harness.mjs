import { constants, existsSync } from 'node:fs';
import { access, mkdtemp, mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, delimiter, join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';

const REQUIRED_POSTGRES_BINARIES = Object.freeze(['initdb', 'pg_ctl', 'psql']);
const DEFAULT_POSTGRES_BINS = Object.freeze([
	'/Applications/Postgres.app/Contents/Versions/latest/bin',
	'/usr/local/pgsql/bin',
	'/usr/local/bin',
	'/opt/homebrew/bin',
	'/usr/bin'
]);

/** @param {{ baseURL: string, databaseUrl: string }} options */
export function createLiveE2EEnvironment({ baseURL, databaseUrl }) {
	return Object.freeze({
		LIVE_E2E_MODE: 'isolated-local',
		APP_ORIGIN: baseURL,
		BETTER_AUTH_URL: baseURL,
		DATABASE_URL: databaseUrl,
		MIGRATION_DATABASE_URL: databaseUrl,
		BETTER_AUTH_SECRET: 'live-e2e-better-auth-secret-0000000001',
		RATE_LIMIT_HMAC_KEY: 'live-e2e-rate-limit-secret-0000000002',
		BOOK_CHECKOUT_CAPABILITY_KEY: 'live-e2e-checkout-secret-000000000003',
		CRON_SECRET: 'live-e2e-cron-secret-0000000000000004',
		GOOGLE_CLIENT_ID: '123456789012-livee2elocalonly.apps.googleusercontent.com',
		GOOGLE_CLIENT_SECRET: 'live-e2e-google-client-secret',
		STRIPE_SECRET_KEY: 'sk_test_livee2elocalonly',
		STRIPE_WEBHOOK_SECRET: 'whsec_livee2elocalonly',
		STRIPE_CHECKOUT_HOST: 'checkout.mariprogramming.dev',
		BOOK_DELIVERY_LAUNCH_STATE: 'live',
		BOOK_DELIVERY_APPROVED_HOSTNAMES: 'shop.mariprogramming.dev,images.mariprogramming.dev',
		BOOK_DELIVERY_TAX_RATE_BPS: '1498'
	});
}

/** @param {{ port: number, user: string, password: string }} options */
export function postgresConnectionUrl({ port, user, password }) {
	return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:${port}/postgres`;
}

function configuredPostgresBin() {
	const result = spawnSync('pg_config', ['--bindir'], {
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'ignore']
	});
	return result.status === 0 ? result.stdout.trim() : '';
}

function defaultPostgresBins() {
	return [...(process.env.PATH ?? '').split(delimiter), ...DEFAULT_POSTGRES_BINS];
}

/** @param {{ explicitBin?: string, configuredBin?: string, fallbackBins?: string[], isExecutable?: (path: string) => boolean }} [options] */
export function findPostgresBin({
	explicitBin,
	configuredBin = configuredPostgresBin(),
	fallbackBins = defaultPostgresBins(),
	isExecutable = existsSync
} = {}) {
	const candidates = [explicitBin, configuredBin, ...fallbackBins].filter(
		(candidate, index, values) =>
			typeof candidate === 'string' && candidate.length > 0 && values.indexOf(candidate) === index
	);
	for (const candidate of candidates) {
		if (REQUIRED_POSTGRES_BINARIES.every((name) => isExecutable(join(candidate, name)))) {
			return candidate;
		}
	}
	throw new Error(
		'PostgreSQL test binaries were not found. Set LIVE_E2E_POSTGRES_BIN to a directory containing initdb, pg_ctl, and psql.'
	);
}

/** @returns {Promise<number>} */
export async function reserveLoopbackPort() {
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

/** @param {string} command @param {string[]} args @param {NodeJS.ProcessEnv} environment */
function run(command, args, environment) {
	return spawnSync(command, args, {
		env: environment,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe']
	});
}

/**
 * @param {{ postgresBin?: string, migrationsDirectory?: string, seedFile?: string }} [options]
 */
export async function startDisposablePostgres({
	postgresBin = findPostgresBin({ explicitBin: process.env.LIVE_E2E_POSTGRES_BIN }),
	migrationsDirectory = resolve('drizzle'),
	seedFile = resolve('tests/e2e/live/support/seed.sql')
} = {}) {
	const clusterRoot = await mkdtemp(join(tmpdir(), 'mariprogramming-live-e2e-'));
	const dataDirectory = join(clusterRoot, 'data');
	const socketDirectory = join(clusterRoot, 'socket');
	const port = await reserveLoopbackPort();
	const user = process.env.USER || process.env.LOGNAME || 'runner';
	const password = 'live-e2e-local-only';
	await mkdir(socketDirectory);

	const pgEnvironment = {
		...process.env,
		PGHOST: '127.0.0.1',
		PGPORT: String(port),
		PGDATABASE: 'postgres',
		PGUSER: user,
		PGPASSWORD: password
	};
	const binary = (name) => join(postgresBin, name);
	let started = false;

	try {
		const initialized = run(
			binary('initdb'),
			['--pgdata', dataDirectory, '--auth=trust', '--no-locale', '--encoding=UTF8'],
			pgEnvironment
		);
		if (initialized.status !== 0) throw new Error(initialized.stderr || initialized.stdout);

		const startedResult = run(
			binary('pg_ctl'),
			[
				'--pgdata',
				dataDirectory,
				'--log',
				join(clusterRoot, 'postgres.log'),
				'--options',
				`-F -k ${socketDirectory} -h 127.0.0.1 -p ${port}`,
				'--wait',
				'start'
			],
			pgEnvironment
		);
		if (startedResult.status !== 0) {
			throw new Error(startedResult.stderr || startedResult.stdout);
		}
		started = true;

		const migrationNames = (await readdir(migrationsDirectory))
			.filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/u.test(name))
			.sort();
		if (migrationNames.length === 0) throw new Error('No committed database migrations found');
		for (const migrationName of migrationNames) {
			const migrationPath = join(migrationsDirectory, migrationName);
			await readFile(migrationPath, 'utf8');
			const applied = run(
				binary('psql'),
				['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--file', migrationPath],
				pgEnvironment
			);
			if (applied.status !== 0) {
				throw new Error(`Migration ${basename(migrationPath)} failed: ${applied.stderr}`);
			}
		}

		await access(seedFile, constants.R_OK);
		const seeded = run(
			binary('psql'),
			['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--file', seedFile],
			pgEnvironment
		);
		if (seeded.status !== 0) throw new Error(seeded.stderr || seeded.stdout);
	} catch (error) {
		if (started) {
			run(
				binary('pg_ctl'),
				['--pgdata', dataDirectory, '--mode', 'immediate', '--wait', 'stop'],
				pgEnvironment
			);
		}
		await rm(clusterRoot, { recursive: true, force: true });
		throw error;
	}

	let stopped = false;
	return Object.freeze({
		databaseUrl: postgresConnectionUrl({ port, user, password }),
		async stop() {
			if (stopped) return;
			stopped = true;
			run(
				binary('pg_ctl'),
				['--pgdata', dataDirectory, '--mode', 'immediate', '--wait', 'stop'],
				pgEnvironment
			);
			await rm(clusterRoot, { recursive: true, force: true });
		}
	});
}

/** @param {string} command @param {string[]} args @param {NodeJS.ProcessEnv} environment */
export function runChild(command, args, environment) {
	return spawn(command, args, { env: environment, stdio: 'inherit' });
}
