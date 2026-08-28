import { describe, expect, it } from 'vitest';
import {
	ServerConfigurationError,
	readBookDeliveryJobEnvironment,
	readBookRequestEnvironment,
	readClubEventDeliveryEnvironment,
	readMigrationEnvironment,
	readNotificationRelayEnvironment,
	readOrderConfirmationAccessEnvironment,
	readBookWorkEnvironment,
	readOrderConfirmationEnvironment,
	readRuntimeEnvironment,
	readStaffCatalogueEnvironment,
	readStaffSignInEnvironment,
	readStaffOrderCancellationEnvironment,
	readStripeWebhookEnvironment,
	resolveBookDeliveryLaunchState
} from './environment.js';

const validEnvironment = Object.freeze({
	APP_ORIGIN: 'https://books.example.com',
	DATABASE_URL:
		'postgresql://runtime-user:runtime-password@runtime.example.com/books?sslmode=require',
	BETTER_AUTH_SECRET: 'better-auth-secret-with-at-least-32-characters',
	BETTER_AUTH_URL: 'https://books.example.com',
	GOOGLE_CLIENT_ID: '123456789012-abcdefghijklmnopqrstuvwxyz.apps.googleusercontent.com',
	GOOGLE_CLIENT_SECRET: 'google-client-secret',
	STRIPE_SECRET_KEY: 'sk_test_foundationexample123',
	STRIPE_WEBHOOK_SECRET: 'whsec_foundationexample123',
	BOOK_DELIVERY_LAUNCH_STATE: 'live',
	RATE_LIMIT_HMAC_KEY: 'rate-limit-key-with-at-least-32-characters',
	BOOK_CHECKOUT_CAPABILITY_KEY: 'book-checkout-capability-key-with-at-least-32-characters',
	CRON_SECRET: 'cron-secret-with-at-least-32-characters',
	VERCEL: '1'
});
const overlongStripeHostnameLabel = `${'a'.repeat(64)}.books.example.com`;
const overlongStripeHostname = `${'a'.repeat(63)}.${'b'.repeat(63)}.${'c'.repeat(63)}.${'d'.repeat(58)}.com`;

/** @param {Record<string, unknown>} overrides */
function withEnvironment(overrides) {
	return { ...validEnvironment, ...overrides };
}

describe('private server environment', () => {
	it('reads only the canonical origin required to render public staff sign-in recovery', () => {
		const configuration = readStaffSignInEnvironment({
			APP_ORIGIN: validEnvironment.APP_ORIGIN,
			DATABASE_URL: 'must-not-be-read',
			GOOGLE_CLIENT_SECRET: 'must-not-be-read'
		});
		expect(configuration).toEqual({ appOrigin: validEnvironment.APP_ORIGIN });
		expect(Object.isFrozen(configuration)).toBe(true);
	});

	it.each([null, {}, { APP_ORIGIN: 'https://club.example.com/path' }])(
		'rejects an invalid public staff sign-in environment %#',
		(source) => {
			expect(() => readStaffSignInEnvironment(source)).toThrow(ServerConfigurationError);
		}
	);

	it.each([
		['test', 'sk_test_foundationexample123'],
		['live', 'sk_live_foundationexample123'],
		['test', 'rk_test_foundationexample123'],
		['live', 'rk_live_foundationexample123']
	])('reads only the scheduled Book Delivery job credentials in %s mode', (stripeMode, key) => {
		const configuration = readBookDeliveryJobEnvironment({
			DATABASE_URL: validEnvironment.DATABASE_URL,
			STRIPE_SECRET_KEY: key,
			CRON_SECRET: validEnvironment.CRON_SECRET,
			GOOGLE_CLIENT_SECRET: 'must-not-be-read'
		});

		expect(configuration).toEqual({
			databaseUrl: validEnvironment.DATABASE_URL,
			stripeSecretKey: key,
			stripeMode,
			cronSecret: validEnvironment.CRON_SECRET
		});
		expect(Object.isFrozen(configuration)).toBe(true);
		expect(configuration).not.toHaveProperty('googleClientSecret');
		expect(configuration).not.toHaveProperty('appOrigin');
	});

	it.each([
		['non-object input', null],
		['missing database URL', { DATABASE_URL: undefined }],
		['invalid database URL', { DATABASE_URL: 'https://db.example.com/books' }],
		['missing Stripe key', { STRIPE_SECRET_KEY: undefined }],
		['invalid Stripe key', { STRIPE_SECRET_KEY: 'sk_preview_invalid' }],
		['missing cron secret', { CRON_SECRET: undefined }],
		['short cron secret', { CRON_SECRET: 'short' }],
		['reused provider secret', { CRON_SECRET: validEnvironment.STRIPE_SECRET_KEY }]
	])('rejects a scheduled-job environment with %s', (_label, overrides) => {
		const source =
			overrides === null
				? null
				: {
						DATABASE_URL: validEnvironment.DATABASE_URL,
						STRIPE_SECRET_KEY: validEnvironment.STRIPE_SECRET_KEY,
						CRON_SECRET: validEnvironment.CRON_SECRET,
						...overrides
					};
		expect(() => readBookDeliveryJobEnvironment(source)).toThrow(ServerConfigurationError);
	});

	it('reads only the values needed by protected staff catalogue requests', () => {
		const configuration = readStaffCatalogueEnvironment({
			APP_ORIGIN: validEnvironment.APP_ORIGIN,
			DATABASE_URL: validEnvironment.DATABASE_URL,
			RATE_LIMIT_HMAC_KEY: validEnvironment.RATE_LIMIT_HMAC_KEY,
			BOOK_DELIVERY_APPROVED_HOSTNAMES: 'shop.example.com,images.example.com'
		});

		expect(configuration).toEqual({
			appOrigin: validEnvironment.APP_ORIGIN,
			databaseUrl: validEnvironment.DATABASE_URL,
			rateLimitHmacKey: validEnvironment.RATE_LIMIT_HMAC_KEY,
			approvedHostnames: ['shop.example.com', 'images.example.com']
		});
		expect(Object.isFrozen(configuration)).toBe(true);
		expect(Object.isFrozen(configuration.approvedHostnames)).toBe(true);
		expect(configuration).not.toHaveProperty('stripeSecretKey');
		expect(configuration).not.toHaveProperty('googleClientSecret');
	});

	it.each([
		['non-object input', null],
		['invalid application origin', { APP_ORIGIN: 'https://club.example.com/path' }],
		['invalid database URL', { DATABASE_URL: 'https://db.example.com/catalogue' }],
		['short rate key', { RATE_LIMIT_HMAC_KEY: 'short' }],
		['missing hostname list', { BOOK_DELIVERY_APPROVED_HOSTNAMES: undefined }],
		[
			'duplicate hostname',
			{ BOOK_DELIVERY_APPROVED_HOSTNAMES: 'shop.example.com,shop.example.com' }
		],
		[
			'spaced hostname',
			{ BOOK_DELIVERY_APPROVED_HOSTNAMES: 'shop.example.com, images.example.com' }
		],
		['unsafe hostname', { BOOK_DELIVERY_APPROVED_HOSTNAMES: '127.0.0.1' }]
	])('rejects a staff catalogue environment with %s', (_label, overrides) => {
		const source =
			overrides === null
				? null
				: {
						APP_ORIGIN: validEnvironment.APP_ORIGIN,
						DATABASE_URL: validEnvironment.DATABASE_URL,
						RATE_LIMIT_HMAC_KEY: validEnvironment.RATE_LIMIT_HMAC_KEY,
						BOOK_DELIVERY_APPROVED_HOSTNAMES: 'shop.example.com,images.example.com',
						...overrides
					};
		expect(() => readStaffCatalogueEnvironment(source)).toThrow(ServerConfigurationError);
	});

	it('reads only the database credential required by order confirmation', () => {
		const configuration = readOrderConfirmationEnvironment({
			DATABASE_URL: validEnvironment.DATABASE_URL
		});

		expect(configuration).toEqual({ databaseUrl: validEnvironment.DATABASE_URL });
		expect(Object.isFrozen(configuration)).toBe(true);
	});

	it('reads only the origin and database required by an emailed confirmation link', () => {
		expect(
			readOrderConfirmationAccessEnvironment({
				APP_ORIGIN: validEnvironment.APP_ORIGIN,
				DATABASE_URL: validEnvironment.DATABASE_URL
			})
		).toEqual({
			appOrigin: validEnvironment.APP_ORIGIN,
			databaseUrl: validEnvironment.DATABASE_URL
		});
	});

	it('rejects a non-object emailed confirmation environment', () => {
		expect(() => readOrderConfirmationAccessEnvironment(null)).toThrow(ServerConfigurationError);
	});

	it.each([
		['test', 'sk_test_foundationexample123'],
		['live', 'sk_live_foundationexample123'],
		['test', 'rk_test_foundationexample123'],
		['live', 'rk_live_foundationexample123']
	])('reads only the Stripe key needed for a staff cancellation in %s mode', (stripeMode, key) => {
		const configuration = readStaffOrderCancellationEnvironment({ STRIPE_SECRET_KEY: key });
		expect(configuration).toEqual({ stripeSecretKey: key, stripeMode });
		expect(Object.isFrozen(configuration)).toBe(true);
		expect(configuration).not.toHaveProperty('stripeWebhookSecret');
		expect(configuration).not.toHaveProperty('databaseUrl');
	});

	it.each([null, {}, { STRIPE_SECRET_KEY: 'sk_preview_invalid' }])(
		'rejects an invalid staff cancellation environment %#',
		(source) => {
			expect(() => readStaffOrderCancellationEnvironment(source)).toThrow(ServerConfigurationError);
		}
	);

	it.each([
		['non-object input', null],
		['missing database URL', {}],
		['invalid database URL', { DATABASE_URL: 'https://db.example.com/books' }]
	])('rejects an order-confirmation environment with %s', (_label, source) => {
		expect(() => readOrderConfirmationEnvironment(source)).toThrow(ServerConfigurationError);
	});

	it.each([
		['test', 'sk_test_foundationexample123'],
		['live', 'sk_live_foundationexample123'],
		['test', 'rk_test_foundationexample123'],
		['live', 'rk_live_foundationexample123']
	])('reads only the three Stripe webhook credentials and derives %s mode', (stripeMode, key) => {
		const configuration = readStripeWebhookEnvironment({
			DATABASE_URL: validEnvironment.DATABASE_URL,
			STRIPE_SECRET_KEY: key,
			STRIPE_WEBHOOK_SECRET: validEnvironment.STRIPE_WEBHOOK_SECRET
		});

		expect(configuration).toEqual({
			databaseUrl: validEnvironment.DATABASE_URL,
			stripeSecretKey: key,
			stripeWebhookSecret: validEnvironment.STRIPE_WEBHOOK_SECRET,
			stripeMode
		});
		expect(Object.isFrozen(configuration)).toBe(true);
	});

	it.each([
		['non-object input', null],
		['missing database URL', { DATABASE_URL: undefined }],
		['invalid database URL', { DATABASE_URL: 'https://db.example.com/books' }],
		['missing Stripe key', { STRIPE_SECRET_KEY: undefined }],
		['invalid Stripe key or mode', { STRIPE_SECRET_KEY: 'sk_preview_not-a-mode' }],
		['missing webhook secret', { STRIPE_WEBHOOK_SECRET: undefined }],
		['invalid webhook secret', { STRIPE_WEBHOOK_SECRET: 'webhook-secret' }]
	])('rejects a webhook environment with %s', (_label, overrides) => {
		const source =
			overrides === null
				? null
				: {
						DATABASE_URL: validEnvironment.DATABASE_URL,
						STRIPE_SECRET_KEY: validEnvironment.STRIPE_SECRET_KEY,
						STRIPE_WEBHOOK_SECRET: validEnvironment.STRIPE_WEBHOOK_SECRET,
						...overrides
					};
		expect(() => readStripeWebhookEnvironment(source)).toThrow(ServerConfigurationError);
	});

	it.each([
		[undefined, 'coming-soon'],
		['', 'coming-soon'],
		['LIVE', 'coming-soon'],
		[' live ', 'coming-soon'],
		['unexpected', 'coming-soon'],
		['coming-soon', 'coming-soon'],
		['live', 'live']
	])('resolves launch value %j to %s', (value, expected) => {
		expect(resolveBookDeliveryLaunchState(value)).toBe(expected);
	});

	it('returns normalized, immutable runtime configuration', () => {
		const configuration = readRuntimeEnvironment(
			withEnvironment({
				APP_ORIGIN: 'https://books.example.com/',
				BETTER_AUTH_URL: 'https://books.example.com/',
				STRIPE_CHECKOUT_HOST: 'pay.books.example.com'
			})
		);

		expect(configuration).toEqual({
			appOrigin: 'https://books.example.com',
			databaseUrl: validEnvironment.DATABASE_URL,
			betterAuthSecret: validEnvironment.BETTER_AUTH_SECRET,
			betterAuthOrigin: 'https://books.example.com',
			googleClientId: validEnvironment.GOOGLE_CLIENT_ID,
			googleClientSecret: validEnvironment.GOOGLE_CLIENT_SECRET,
			stripeSecretKey: validEnvironment.STRIPE_SECRET_KEY,
			stripeWebhookSecret: validEnvironment.STRIPE_WEBHOOK_SECRET,
			stripeCheckoutHost: 'pay.books.example.com',
			launchState: 'live',
			rateLimitHmacKey: validEnvironment.RATE_LIMIT_HMAC_KEY,
			bookCheckoutCapabilityKey: validEnvironment.BOOK_CHECKOUT_CAPABILITY_KEY,
			cronSecret: validEnvironment.CRON_SECRET,
			isVercel: true
		});
		expect(Object.isFrozen(configuration)).toBe(true);
	});

	it('accepts a least-privilege restricted Stripe key at runtime', () => {
		const configuration = readRuntimeEnvironment(
			withEnvironment({ STRIPE_SECRET_KEY: 'rk_test_foundationexample123' })
		);

		expect(configuration.stripeSecretKey).toBe('rk_test_foundationexample123');
	});

	it.each([undefined, '', '0', 'true', ' 1 '])(
		'treats non-exact Vercel deployment flag %j as untrusted',
		(value) => {
			const configuration = readRuntimeEnvironment(withEnvironment({ VERCEL: value }));
			expect(configuration.isVercel).toBe(false);
		}
	);

	it.each([
		'pay.my-books.example.com',
		'alt.pay.example.com',
		'in-addr.pay.example.com',
		'localdomain.pay.example.com',
		'pay.books.salt',
		'pay.books.notarpa',
		'pay.books.mylocaldomain'
	])('accepts unrelated lowercase ASCII custom hostname %j', (hostname) => {
		const configuration = readRuntimeEnvironment(
			withEnvironment({ STRIPE_CHECKOUT_HOST: hostname })
		);

		expect(configuration.stripeCheckoutHost).toBe(hostname);
	});

	it('allows an omitted optional Stripe checkout host and loopback HTTP origins', () => {
		const configuration = readRuntimeEnvironment(
			withEnvironment({
				APP_ORIGIN: 'http://127.0.0.1:5173',
				BETTER_AUTH_URL: 'http://127.0.0.1:5173',
				BOOK_DELIVERY_LAUNCH_STATE: 'invalid',
				STRIPE_CHECKOUT_HOST: ''
			})
		);

		expect(configuration.appOrigin).toBe('http://127.0.0.1:5173');
		expect(configuration.stripeCheckoutHost).toBeNull();
		expect(configuration.launchState).toBe('coming-soon');
	});

	it.each([
		['non-object input', null],
		['missing runtime database URL', withEnvironment({ DATABASE_URL: undefined })],
		['malformed runtime database URL', withEnvironment({ DATABASE_URL: 'postgresql://[' })],
		[
			'database URL without credentials',
			withEnvironment({ DATABASE_URL: 'postgresql://db.example.com/books' })
		],
		[
			'non-Postgres database URL',
			withEnvironment({ DATABASE_URL: 'mysql://user:pass@db.example.com/books' })
		],
		['malformed application origin', withEnvironment({ APP_ORIGIN: 'https://[' })],
		['public HTTP application origin', withEnvironment({ APP_ORIGIN: 'http://books.example.com' })],
		[
			'application URL with a path',
			withEnvironment({ APP_ORIGIN: 'https://books.example.com/path' })
		],
		['mismatched auth origin', withEnvironment({ BETTER_AUTH_URL: 'https://auth.example.com' })],
		['short Better Auth secret', withEnvironment({ BETTER_AUTH_SECRET: 'too-short' })],
		['blank Google client ID', withEnvironment({ GOOGLE_CLIENT_ID: '' })],
		[
			'placeholder Google client ID',
			withEnvironment({ GOOGLE_CLIENT_ID: 'local-dev.apps.googleusercontent.com' })
		],
		[
			'non-numeric Google client ID',
			withEnvironment({ GOOGLE_CLIENT_ID: 'google-client-id.apps.googleusercontent.com' })
		],
		['blank Google client secret', withEnvironment({ GOOGLE_CLIENT_SECRET: '' })],
		['invalid Stripe secret key', withEnvironment({ STRIPE_SECRET_KEY: 'pk_test_not-secret' })],
		['invalid Stripe webhook secret', withEnvironment({ STRIPE_WEBHOOK_SECRET: 'webhook-secret' })],
		['short rate-limit HMAC key', withEnvironment({ RATE_LIMIT_HMAC_KEY: 'too-short' })],
		[
			'short checkout capability key',
			withEnvironment({ BOOK_CHECKOUT_CAPABILITY_KEY: 'too-short' })
		],
		['short cron secret', withEnvironment({ CRON_SECRET: 'too-short' })],
		[
			'reused independent secret',
			withEnvironment({ RATE_LIMIT_HMAC_KEY: validEnvironment.BETTER_AUTH_SECRET })
		],
		[
			'reused checkout capability secret',
			withEnvironment({ BOOK_CHECKOUT_CAPABILITY_KEY: validEnvironment.RATE_LIMIT_HMAC_KEY })
		],
		[
			'checkout capability secret reused as the Stripe API secret',
			withEnvironment({
				STRIPE_SECRET_KEY: 'sk_test_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
				BOOK_CHECKOUT_CAPABILITY_KEY: 'sk_test_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
			})
		],
		[
			'checkout capability secret reused as the Stripe webhook secret',
			withEnvironment({
				STRIPE_WEBHOOK_SECRET: 'whsec_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
				BOOK_CHECKOUT_CAPABILITY_KEY: 'whsec_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
			})
		],
		['malformed Stripe checkout hostname', withEnvironment({ STRIPE_CHECKOUT_HOST: '[.com' })]
	])('rejects %s with one non-sensitive error', (_case, environment) => {
		let thrown;

		try {
			readRuntimeEnvironment(environment);
		} catch (error) {
			thrown = error;
		}

		expect(thrown).toBeInstanceOf(ServerConfigurationError);
		expect(thrown).toMatchObject({
			name: 'ServerConfigurationError',
			code: 'SERVER_CONFIGURATION_INVALID',
			message: 'Server configuration is unavailable'
		});
		expect(JSON.stringify(thrown)).not.toContain(validEnvironment.BETTER_AUTH_SECRET);
		expect(JSON.stringify(thrown)).not.toContain(validEnvironment.STRIPE_SECRET_KEY);
	});

	it.each([
		'..',
		'.evil.com',
		'evil..com',
		'-evil.com',
		'evil-.com',
		'-pay.books.example.com',
		'pay-.books.example.com',
		'pay.-books.example.com',
		'pay.books-.example.com',
		'127.0.0.1',
		'127.000.000.001',
		'127.0.1',
		'0177.0.0.1',
		'0x7f.0.0.1',
		'192.168.1.10',
		'::1',
		'[::1]',
		'[2001:db8::1]',
		'localhost',
		'pay.books.localhost',
		'pay.books.local',
		'pay.books.internal',
		'pay.books.lan',
		'pay.books.home',
		'pay.books.home.arpa',
		'pay.books.alt',
		'pay.books.arpa',
		'pay.books.in-addr.arpa',
		'pay.books.localdomain',
		'pay.books.private',
		'pay.books.example.com.',
		'Pay.Books.Example.com',
		'pay.böoks.example.com',
		'pay.xn--bks-5qa.example.com',
		'stripe.com',
		'https://pay.books.example.com',
		'pay.books.example.com:443',
		'user@pay.books.example.com',
		'pay.books.example.com/path',
		'pay.books.example.com?mode=test',
		'pay.books.example.com#fragment',
		overlongStripeHostnameLabel,
		overlongStripeHostname
	])('rejects non-custom Stripe checkout hostname %j', (hostname) => {
		expect(() =>
			readRuntimeEnvironment(withEnvironment({ STRIPE_CHECKOUT_HOST: hostname }))
		).toThrow(ServerConfigurationError);
	});

	it('reads the migration credential through a separate parser', () => {
		const configuration = readMigrationEnvironment({
			MIGRATION_DATABASE_URL:
				'postgresql://migration-user:migration-password@migration.example.com/books?sslmode=require'
		});

		expect(configuration).toEqual({
			databaseUrl:
				'postgresql://migration-user:migration-password@migration.example.com/books?sslmode=require'
		});
		expect(Object.isFrozen(configuration)).toBe(true);
		expect(configuration).not.toHaveProperty('runtimeDatabaseUrl');
	});

	it.each([
		null,
		{},
		{ MIGRATION_DATABASE_URL: 'postgresql://db.example.com/books' },
		{ MIGRATION_DATABASE_URL: 'https://migration.example.com/books' }
	])('rejects missing or invalid migration credentials without exposing them', (environment) => {
		expect(() => readMigrationEnvironment(environment)).toThrow(ServerConfigurationError);
	});

	it('reads the public book-request boundary without Stripe or Discord credentials', () => {
		const configuration = readBookRequestEnvironment({
			APP_ORIGIN: validEnvironment.APP_ORIGIN,
			DATABASE_URL: validEnvironment.DATABASE_URL,
			RATE_LIMIT_HMAC_KEY: validEnvironment.RATE_LIMIT_HMAC_KEY,
			STRIPE_SECRET_KEY: 'must-not-be-read',
			DISCORD_EVENTS_WEBHOOK_URL: 'must-not-be-read'
		});
		expect(configuration).toEqual({
			appOrigin: validEnvironment.APP_ORIGIN,
			databaseUrl: validEnvironment.DATABASE_URL,
			rateLimitHmacKey: validEnvironment.RATE_LIMIT_HMAC_KEY
		});
		expect(Object.isFrozen(configuration)).toBe(true);
		expect(configuration).not.toHaveProperty('discordWebhookUrl');
	});

	it.each([
		['non-object input', null],
		['invalid origin', { APP_ORIGIN: 'https://club.example.com/path' }],
		['invalid database URL', { DATABASE_URL: 'https://db.example.com/books' }],
		['short rate key', { RATE_LIMIT_HMAC_KEY: 'short' }]
	])('rejects a book-request environment with %s', (_label, overrides) => {
		const source =
			overrides === null
				? null
				: {
						APP_ORIGIN: validEnvironment.APP_ORIGIN,
						DATABASE_URL: validEnvironment.DATABASE_URL,
						RATE_LIMIT_HMAC_KEY: validEnvironment.RATE_LIMIT_HMAC_KEY,
						...overrides
					};
		expect(() => readBookRequestEnvironment(source)).toThrow(ServerConfigurationError);
	});

	it('treats a missing Discord webhook as skipped delivery', () => {
		const configuration = readClubEventDeliveryEnvironment({
			APP_ORIGIN: validEnvironment.APP_ORIGIN,
			DATABASE_URL: validEnvironment.DATABASE_URL,
			CRON_SECRET: validEnvironment.CRON_SECRET
		});
		expect(configuration).toEqual({
			appOrigin: validEnvironment.APP_ORIGIN,
			databaseUrl: validEnvironment.DATABASE_URL,
			cronSecret: validEnvironment.CRON_SECRET,
			discordWebhookUrl: null,
			postmarkServerToken: null,
			bookCheckoutCapabilityKey: null
		});
		expect(Object.isFrozen(configuration)).toBe(true);
	});

	it('treats an empty Discord webhook as skipped delivery', () => {
		expect(
			readClubEventDeliveryEnvironment({
				APP_ORIGIN: validEnvironment.APP_ORIGIN,
				DATABASE_URL: validEnvironment.DATABASE_URL,
				CRON_SECRET: validEnvironment.CRON_SECRET,
				DISCORD_WEBHOOK_URL: ''
			}).discordWebhookUrl
		).toBeNull();
	});

	it('accepts the documented Discord incoming webhook shape', () => {
		const discordWebhookUrl =
			'https://discord.com/api/webhooks/123456789012345678/testdiscordtokenvaluefortests';
		const configuration = readClubEventDeliveryEnvironment({
			APP_ORIGIN: validEnvironment.APP_ORIGIN,
			DATABASE_URL: validEnvironment.DATABASE_URL,
			CRON_SECRET: validEnvironment.CRON_SECRET,
			DISCORD_WEBHOOK_URL: discordWebhookUrl
		});
		expect(configuration.discordWebhookUrl).toBe(discordWebhookUrl);
	});

	it('reads an optional Postmark token with the capability key used for tracking links', () => {
		const configuration = readClubEventDeliveryEnvironment({
			APP_ORIGIN: validEnvironment.APP_ORIGIN,
			DATABASE_URL: validEnvironment.DATABASE_URL,
			CRON_SECRET: validEnvironment.CRON_SECRET,
			POSTMARK_SERVER_TOKEN: '00000000-0000-4000-8000-000000000000',
			BOOK_CHECKOUT_CAPABILITY_KEY: validEnvironment.BOOK_CHECKOUT_CAPABILITY_KEY
		});
		expect(configuration).toMatchObject({
			postmarkServerToken: '00000000-0000-4000-8000-000000000000',
			bookCheckoutCapabilityKey: validEnvironment.BOOK_CHECKOUT_CAPABILITY_KEY
		});
	});

	it.each([
		'not-a-token',
		' 00000000-0000-4000-8000-000000000000',
		'00000000-0000-4000-8000-000000000000 '
	])('rejects an invalid Postmark token without leaking it: %j', (token) => {
		let thrown;
		try {
			readClubEventDeliveryEnvironment({
				APP_ORIGIN: validEnvironment.APP_ORIGIN,
				DATABASE_URL: validEnvironment.DATABASE_URL,
				CRON_SECRET: validEnvironment.CRON_SECRET,
				POSTMARK_SERVER_TOKEN: token,
				BOOK_CHECKOUT_CAPABILITY_KEY: validEnvironment.BOOK_CHECKOUT_CAPABILITY_KEY
			});
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toBeInstanceOf(ServerConfigurationError);
		expect(JSON.stringify(thrown)).not.toContain(token);
	});

	it('requires the capability key only when Postmark delivery is configured', () => {
		expect(() =>
			readClubEventDeliveryEnvironment({
				APP_ORIGIN: validEnvironment.APP_ORIGIN,
				DATABASE_URL: validEnvironment.DATABASE_URL,
				CRON_SECRET: validEnvironment.CRON_SECRET,
				POSTMARK_SERVER_TOKEN: '00000000-0000-4000-8000-000000000000'
			})
		).toThrow(ServerConfigurationError);
	});

	it.each([
		'https://discord.com/api/webhooks/short/token',
		'http://discord.com/api/webhooks/123456789012345678/testdiscordtokenvaluefortests',
		'https://discord.com:8443/api/webhooks/123456789012345678/testdiscordtokenvaluefortests',
		'https://user@discord.com/api/webhooks/123456789012345678/testdiscordtokenvaluefortests',
		'https://discord.com/api/webhooks/123456789012345678/testdiscordtokenvaluefortests?wait=true',
		'https://discord.com/api/webhooks/123456789012345678/testdiscordtokenvaluefortests#fragment',
		'https://evil.example/api/webhooks/123456789012345678/testdiscordtokenvaluefortests',
		'not-a-url'
	])('rejects an invalid Discord webhook without leaking it: %j', (url) => {
		let thrown;
		try {
			readClubEventDeliveryEnvironment({
				APP_ORIGIN: validEnvironment.APP_ORIGIN,
				DATABASE_URL: validEnvironment.DATABASE_URL,
				CRON_SECRET: validEnvironment.CRON_SECRET,
				DISCORD_WEBHOOK_URL: url
			});
		} catch (error) {
			thrown = error;
		}
		expect(thrown).toBeInstanceOf(ServerConfigurationError);
		expect(JSON.stringify(thrown)).not.toContain(url);
	});

	it('accepts the discordapp.com webhook host and aliases the same readers', () => {
		const discordWebhookUrl =
			'https://discordapp.com/api/webhooks/123456789012345678/testdiscordtokenvaluefortests';
		expect(
			readNotificationRelayEnvironment({
				APP_ORIGIN: validEnvironment.APP_ORIGIN,
				DATABASE_URL: validEnvironment.DATABASE_URL,
				CRON_SECRET: validEnvironment.CRON_SECRET,
				DISCORD_WEBHOOK_URL: discordWebhookUrl
			}).discordWebhookUrl
		).toBe(discordWebhookUrl);
		expect(readBookWorkEnvironment).toBe(readBookRequestEnvironment);
		expect(readNotificationRelayEnvironment).toBe(readClubEventDeliveryEnvironment);
	});

	it('rejects a Discord webhook with surrounding whitespace', () => {
		expect(() =>
			readClubEventDeliveryEnvironment({
				APP_ORIGIN: validEnvironment.APP_ORIGIN,
				DATABASE_URL: validEnvironment.DATABASE_URL,
				CRON_SECRET: validEnvironment.CRON_SECRET,
				DISCORD_WEBHOOK_URL:
					' https://discord.com/api/webhooks/123456789012345678/testdiscordtokenvaluefortests'
			})
		).toThrow(ServerConfigurationError);
	});

	it('rejects a non-object club-event environment', () => {
		expect(() => readClubEventDeliveryEnvironment(null)).toThrow(ServerConfigurationError);
		expect(() => readClubEventDeliveryEnvironment(1)).toThrow(ServerConfigurationError);
		expect(() =>
			readClubEventDeliveryEnvironment({
				APP_ORIGIN: validEnvironment.APP_ORIGIN,
				DATABASE_URL: validEnvironment.DATABASE_URL,
				CRON_SECRET: validEnvironment.CRON_SECRET,
				DISCORD_WEBHOOK_URL: 12
			})
		).toThrow(ServerConfigurationError);
	});
});
