import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	createLiveE2EEnvironment,
	findPostgresBin,
	postgresConnectionUrl,
	reserveLoopbackPort
} from './live-harness.mjs';

describe('live E2E harness configuration', () => {
	it('builds an isolated live environment without accepting caller credentials', () => {
		const environment = createLiveE2EEnvironment({
			baseURL: 'http://127.0.0.1:4174',
			databaseUrl: 'postgresql://runner:local-only@127.0.0.1:55432/postgres'
		});

		assert.equal(environment.LIVE_E2E_MODE, 'isolated-local');
		assert.equal(environment.APP_ORIGIN, 'http://127.0.0.1:4174');
		assert.equal(environment.BETTER_AUTH_URL, environment.APP_ORIGIN);
		assert.equal(environment.BOOK_DELIVERY_LAUNCH_STATE, 'live');
		assert.equal(environment.DATABASE_URL, environment.MIGRATION_DATABASE_URL);
		assert.match(environment.STRIPE_SECRET_KEY, /^sk_test_/u);
		assert.equal(environment.STRIPE_CHECKOUT_HOST, 'checkout.mariprogramming.dev');
		assert.equal('GOOGLE_APPLICATION_CREDENTIALS' in environment, false);
		assert.equal('VERCEL' in environment, false);
	});

	it('encodes the disposable database user and password', () => {
		assert.equal(
			postgresConnectionUrl({
				port: 55432,
				user: 'local runner',
				password: 'not/a secret'
			}),
			'postgresql://local%20runner:not%2Fa%20secret@127.0.0.1:55432/postgres'
		);
	});

	it('reserves a valid ephemeral loopback port for each live application run', async () => {
		const port = await reserveLoopbackPort();
		assert.equal(Number.isSafeInteger(port), true);
		assert.equal(port > 0 && port <= 65535, true);
	});

	it('prefers the explicit PostgreSQL binary directory and rejects incomplete candidates', () => {
		const calls = [];
		const found = findPostgresBin({
			explicitBin: '/opt/postgres/bin',
			configuredBin: '',
			fallbackBins: ['/fallback/bin'],
			isExecutable(path) {
				calls.push(path);
				return !path.includes('/opt/postgres/bin/psql');
			}
		});

		assert.equal(found, '/fallback/bin');
		assert.deepEqual(calls, [
			'/opt/postgres/bin/initdb',
			'/opt/postgres/bin/pg_ctl',
			'/opt/postgres/bin/psql',
			'/fallback/bin/initdb',
			'/fallback/bin/pg_ctl',
			'/fallback/bin/psql'
		]);
	});

	it('uses the PostgreSQL directory reported by pg_config before platform fallbacks', () => {
		const found = findPostgresBin({
			configuredBin: '/usr/lib/postgresql/17/bin',
			fallbackBins: ['/usr/bin'],
			isExecutable: (path) => path.startsWith('/usr/lib/postgresql/17/bin/')
		});

		assert.equal(found, '/usr/lib/postgresql/17/bin');
	});
});
