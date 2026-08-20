import { memoryAdapter } from 'better-auth/adapters/memory';
import { betterAuth } from 'better-auth/minimal';
import { createBetterAuthOptions } from './src/lib/server/auth/config.js';

const schemaDatabase = {
	user: [],
	session: [],
	account: [],
	verification: []
};

/**
 * CLI-only schema input. The official generator receives the real target through
 * `--adapter drizzle --dialect postgresql`; no runtime credential or connection is used.
 */
export const auth = betterAuth(
	createBetterAuthOptions({
		database: memoryAdapter(schemaDatabase),
		environment: {
			appOrigin: 'https://schema.invalid',
			betterAuthOrigin: 'https://schema.invalid',
			betterAuthSecret: 'schema-only-non-runtime-value-00000000000000000000',
			googleClientId: 'schema-only-client-id',
			googleClientSecret: 'schema-only-client-secret'
		},
		rateLimitStorage: {
			async consume() {
				return { allowed: true, retryAfter: null };
			}
		},
		fetchGoogleProfile: async () => null
	})
);
