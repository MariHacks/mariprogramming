import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const supportFile = (name) =>
	fileURLToPath(new URL(`./tests/e2e/live/support/${name}`, import.meta.url));

export function createLiveServerDoublesPlugin() {
	return {
		name: 'live-e2e-server-doubles',
		enforce: 'pre',
		resolveId(source) {
			const moduleId = source.split('?', 1)[0].replaceAll('\\', '/');
			if (/\/src\/lib\/server\/db\/transaction(?:\.js)?$/u.test(moduleId)) {
				return supportFile('node-postgres-transaction.js');
			}
			if (/\/src\/lib\/server\/auth\/runtime(?:\.js)?$/u.test(moduleId)) {
				return supportFile('auth-runtime-double.js');
			}
			return null;
		}
	};
}

/** @param {unknown} source */
export function assertIsolatedLiveE2EEnvironment(source) {
	if (source === null || typeof source !== 'object' || Array.isArray(source)) {
		throw new Error('The live E2E server is not isolated');
	}
	const environment = /** @type {Record<string, unknown>} */ (source);
	let appOrigin;
	let databaseUrl;
	try {
		appOrigin = new URL(String(environment.APP_ORIGIN));
		databaseUrl = new URL(String(environment.DATABASE_URL));
	} catch {
		throw new Error('The live E2E server is not isolated');
	}
	if (
		environment.LIVE_E2E_MODE !== 'isolated-local' ||
		environment.LIVE_E2E_BASE_URL !== appOrigin.origin ||
		environment.BETTER_AUTH_URL !== appOrigin.origin ||
		environment.BOOK_DELIVERY_LAUNCH_STATE !== 'live' ||
		appOrigin.protocol !== 'http:' ||
		appOrigin.hostname !== '127.0.0.1' ||
		!appOrigin.port ||
		!['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
		databaseUrl.hostname !== '127.0.0.1' ||
		!databaseUrl.port ||
		environment.STRIPE_SECRET_KEY !== 'sk_test_livee2elocalonly' ||
		environment.GOOGLE_CLIENT_ID !== 'live-e2e-google-client-id' ||
		environment.GOOGLE_CLIENT_SECRET !== 'live-e2e-google-client-secret'
	) {
		throw new Error('The live E2E server is not isolated');
	}
}

export default defineConfig(() => {
	assertIsolatedLiveE2EEnvironment(process.env);
	return {
		plugins: [createLiveServerDoublesPlugin(), sveltekit()],
		resolve: {
			alias: [
				{
					find: 'stripe',
					replacement: supportFile('stripe-sdk-double.js')
				},
				{
					find: /^\$lib\/server\/auth\/runtime(?:\.js)?$/u,
					replacement: supportFile('auth-runtime-double.js')
				},
				{
					find: /^(?:\$lib\/server\/db\/transaction|\.\.\/db\/transaction)(?:\.js)?$/u,
					replacement: supportFile('node-postgres-transaction.js')
				}
			]
		}
	};
});
