import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	assertIsolatedLiveE2EEnvironment,
	createLiveServerDoublesPlugin
} from '../../../../vite.live-e2e.config.js';

describe('live E2E Vite server double resolver', () => {
	it('replaces SvelteKit-resolved transaction and auth runtime modules', () => {
		const plugin = createLiveServerDoublesPlugin();
		assert.match(
			plugin.resolveId('/workspace/src/lib/server/db/transaction.js'),
			/tests\/e2e\/live\/support\/node-postgres-transaction\.js$/u
		);
		assert.match(
			plugin.resolveId('/workspace/src/lib/server/db/transaction'),
			/tests\/e2e\/live\/support\/node-postgres-transaction\.js$/u
		);
		assert.match(
			plugin.resolveId('/workspace/src/lib/server/auth/runtime.js'),
			/tests\/e2e\/live\/support\/auth-runtime-double\.js$/u
		);
		assert.equal(plugin.resolveId('/workspace/src/lib/server/orders/persistence.js'), null);
	});

	it('rejects public origins and non-test provider credentials', () => {
		const isolated = {
			LIVE_E2E_MODE: 'isolated-local',
			LIVE_E2E_BASE_URL: 'http://127.0.0.1:43111',
			APP_ORIGIN: 'http://127.0.0.1:43111',
			BETTER_AUTH_URL: 'http://127.0.0.1:43111',
			DATABASE_URL: 'postgresql://runner:local@127.0.0.1:43112/postgres',
			BOOK_DELIVERY_LAUNCH_STATE: 'live',
			STRIPE_SECRET_KEY: 'sk_test_livee2elocalonly',
			GOOGLE_CLIENT_ID: 'live-e2e-google-client-id',
			GOOGLE_CLIENT_SECRET: 'live-e2e-google-client-secret'
		};

		assert.doesNotThrow(() => assertIsolatedLiveE2EEnvironment(isolated));
		assert.throws(() =>
			assertIsolatedLiveE2EEnvironment({
				...isolated,
				LIVE_E2E_BASE_URL: 'https://preview.example.com',
				APP_ORIGIN: 'https://preview.example.com'
			})
		);
		assert.throws(() =>
			assertIsolatedLiveE2EEnvironment({
				...isolated,
				STRIPE_SECRET_KEY: 'sk_test_not-the-local-double'
			})
		);
	});
});
