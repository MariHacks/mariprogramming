// The generated SvelteKit declarations are not part of this repository's JS include.
// @ts-ignore
import { env as privateEnvironment } from '$env/dynamic/private';
import { isIP } from 'node:net';

const DNS_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;
const GOOGLE_OAUTH_WEB_CLIENT_ID_PATTERN =
	/^[0-9]+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/u;
const GENERIC_CONFIGURATION_ERROR = 'Server configuration is unavailable';
const MAX_CONFIGURATION_VALUE_LENGTH = 2048;
const MIN_SECRET_LENGTH = 32;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const DISALLOWED_HOST_SUFFIX_LABELS = new Set([
	'alt',
	'arpa',
	'example',
	'home',
	'internal',
	'invalid',
	'lan',
	'local',
	'localdomain',
	'localhost',
	'onion',
	'private',
	'test'
]);

/** @typedef {'coming-soon' | 'live'} BookDeliveryLaunchState */

/**
 * @typedef {{
 *   appOrigin: string,
 *   databaseUrl: string,
 *   betterAuthSecret: string,
 *   betterAuthOrigin: string,
 *   googleClientId: string,
 *   googleClientSecret: string,
 *   stripeSecretKey: string,
 *   stripeWebhookSecret: string,
 *   stripeCheckoutHost: string | null,
 *   launchState: BookDeliveryLaunchState,
 *   rateLimitHmacKey: string,
 *   bookCheckoutCapabilityKey: string,
 *   cronSecret: string,
 *   isVercel: boolean
 * }} RuntimeEnvironment
 */

/** @typedef {{ databaseUrl: string }} MigrationEnvironment */

/** @typedef {{ databaseUrl: string }} OrderConfirmationEnvironment */

/** @typedef {{ appOrigin: string, databaseUrl: string }} OrderConfirmationAccessEnvironment */

/** @typedef {{ appOrigin: string }} StaffSignInEnvironment */

/** @typedef {{ stripeSecretKey: string, stripeMode: 'test' | 'live' }} StaffOrderCancellationEnvironment */

/**
 * @typedef {{
 *   databaseUrl: string,
 *   stripeSecretKey: string,
 *   stripeMode: 'test' | 'live',
 *   cronSecret: string
 * }} BookDeliveryJobEnvironment
 */

/**
 * @typedef {{
 *   databaseUrl: string,
 *   stripeSecretKey: string,
 *   stripeWebhookSecret: string,
 *   stripeMode: 'test' | 'live'
 * }} StripeWebhookEnvironment
 */

/**
 * @typedef {{
 *   appOrigin: string,
 *   databaseUrl: string,
 *   rateLimitHmacKey: string,
 *   approvedHostnames: readonly string[]
 * }} StaffCatalogueEnvironment
 */

/** @typedef {{
 *   databaseUrl: string,
 *   rateLimitHmacKey: string,
 *   appOrigin: string
 * }} BookRequestEnvironment */

/**
 * @typedef {{
 *   appOrigin: string,
 *   databaseUrl: string,
 *   cronSecret: string,
 *   discordWebhookUrl: string | null,
 *   postmarkServerToken: string | null,
 *   bookCheckoutCapabilityKey: string | null
 * }} ClubEventDeliveryEnvironment */

const DISCORD_WEBHOOK_PATH_PATTERN = /^\/api\/webhooks\/[0-9]{17,20}\/[A-Za-z0-9_-]{20,128}$/u;
const POSTMARK_SERVER_TOKEN_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export class ServerConfigurationError extends Error {
	constructor() {
		super(GENERIC_CONFIGURATION_ERROR);
		this.name = 'ServerConfigurationError';
		this.code = 'SERVER_CONFIGURATION_INVALID';
	}
}

/** @returns {never} */
function invalidConfiguration() {
	throw new ServerConfigurationError();
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isEnvironmentRecord(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {Record<string, unknown>} source
 * @param {string} key
 * @param {number} [minimumLength]
 */
function requiredString(source, key, minimumLength = 1) {
	const value = source[key];

	if (
		typeof value !== 'string' ||
		value.length < minimumLength ||
		value.length > MAX_CONFIGURATION_VALUE_LENGTH ||
		value !== value.trim()
	) {
		return invalidConfiguration();
	}

	return value;
}

/**
 * @param {string} value
 */
function postgresUrl(value) {
	let parsed;

	try {
		parsed = new URL(value);
	} catch {
		return invalidConfiguration();
	}

	if (
		!['postgres:', 'postgresql:'].includes(parsed.protocol) ||
		!parsed.hostname ||
		!parsed.username ||
		!parsed.password ||
		parsed.pathname === '/' ||
		parsed.hash
	) {
		return invalidConfiguration();
	}

	return value;
}

/**
 * @param {string} value
 */
function applicationOrigin(value) {
	let parsed;

	try {
		parsed = new URL(value);
	} catch {
		return invalidConfiguration();
	}

	const isHttps = parsed.protocol === 'https:';
	const isLoopbackHttp = parsed.protocol === 'http:' && LOOPBACK_HOSTS.has(parsed.hostname);

	if (
		(!isHttps && !isLoopbackHttp) ||
		!parsed.hostname ||
		parsed.username ||
		parsed.password ||
		parsed.pathname !== '/' ||
		parsed.search ||
		parsed.hash
	) {
		return invalidConfiguration();
	}

	return parsed.origin;
}

/**
 * Rejects both canonical IP literals and the legacy IPv4 spellings normalized by URL clients.
 *
 * @param {string} value
 */
function isIpLiteral(value) {
	try {
		const hostname = new URL(`https://${value}`).hostname;
		return isIP(hostname.startsWith('[') ? hostname.slice(1, -1) : hostname) !== 0;
	} catch {
		return isIP(value) !== 0;
	}
}

/**
 * @param {unknown} value
 */
function optionalStripeCheckoutHost(value) {
	if (value === undefined || value === '') {
		return null;
	}

	if (
		typeof value !== 'string' ||
		value !== value.trim() ||
		value.length > 253 ||
		value !== value.toLowerCase() ||
		isIpLiteral(value)
	) {
		return invalidConfiguration();
	}

	const labels = value.split('.');
	const suffix = /** @type {string} */ (labels.at(-1));
	if (
		labels.length < 3 ||
		DISALLOWED_HOST_SUFFIX_LABELS.has(suffix) ||
		labels.some((label) => label.startsWith('xn--') || !DNS_LABEL_PATTERN.test(label))
	) {
		return invalidConfiguration();
	}

	return value;
}

/** @param {unknown} value */
function approvedCatalogueHostnames(value) {
	if (
		typeof value !== 'string' ||
		value.length === 0 ||
		value.length > MAX_CONFIGURATION_VALUE_LENGTH ||
		value !== value.trim()
	) {
		return invalidConfiguration();
	}

	const hostnames = value.split(',');
	if (
		hostnames.length > 32 ||
		new Set(hostnames).size !== hostnames.length ||
		hostnames.some((hostname) => {
			if (
				!hostname ||
				hostname !== hostname.trim() ||
				hostname !== hostname.toLowerCase() ||
				hostname.length > 253 ||
				isIpLiteral(hostname)
			) {
				return true;
			}
			const labels = hostname.split('.');
			return (
				labels.length < 2 ||
				DISALLOWED_HOST_SUFFIX_LABELS.has(/** @type {string} */ (labels.at(-1))) ||
				labels.some((label) => label.startsWith('xn--') || !DNS_LABEL_PATTERN.test(label))
			);
		})
	) {
		return invalidConfiguration();
	}

	return Object.freeze(hostnames);
}

/**
 * A launch can open only through the one exact value. Every other value stays closed.
 *
 * @param {unknown} value
 * @returns {BookDeliveryLaunchState}
 */
export function resolveBookDeliveryLaunchState(value) {
	return value === 'live' ? 'live' : 'coming-soon';
}

/**
 * Reads only the credentials required by Stripe's independently reachable webhook boundary.
 * Unrelated application, authentication, launch, checkout, and cron configuration cannot prevent
 * a valid signed provider retry from being reduced.
 *
 * @param {unknown} [source]
 * @returns {Readonly<StripeWebhookEnvironment>}
 */
export function readStripeWebhookEnvironment(source = privateEnvironment) {
	if (!isEnvironmentRecord(source)) {
		return invalidConfiguration();
	}

	const stripeSecretKey = requiredString(source, 'STRIPE_SECRET_KEY');
	const stripeKey = /^[sr]k_(test|live)_[A-Za-z0-9]+$/u.exec(stripeSecretKey);
	const stripeWebhookSecret = requiredString(source, 'STRIPE_WEBHOOK_SECRET');
	if (!stripeKey || !/^whsec_[A-Za-z0-9]+$/u.test(stripeWebhookSecret)) {
		return invalidConfiguration();
	}

	return Object.freeze({
		databaseUrl: postgresUrl(requiredString(source, 'DATABASE_URL')),
		stripeSecretKey,
		stripeWebhookSecret,
		stripeMode: /** @type {'test' | 'live'} */ (stripeKey[1])
	});
}

/**
 * Reads only the database credential used by the read-only guest confirmation boundary.
 * Unrelated provider, authentication, launch, and maintenance configuration cannot turn a
 * valid Stripe return into an unavailable page.
 *
 * @param {unknown} [source]
 * @returns {Readonly<OrderConfirmationEnvironment>}
 */
export function readOrderConfirmationEnvironment(source = privateEnvironment) {
	if (!isEnvironmentRecord(source)) {
		return invalidConfiguration();
	}

	return Object.freeze({
		databaseUrl: postgresUrl(requiredString(source, 'DATABASE_URL'))
	});
}

/**
 * Reads only the canonical origin and database used to exchange an emailed confirmation
 * capability for the existing reference-scoped HttpOnly cookie.
 *
 * @param {unknown} [source]
 * @returns {Readonly<OrderConfirmationAccessEnvironment>}
 */
export function readOrderConfirmationAccessEnvironment(source = privateEnvironment) {
	if (!isEnvironmentRecord(source)) invalidConfiguration();
	return Object.freeze({
		appOrigin: applicationOrigin(requiredString(source, 'APP_ORIGIN')),
		databaseUrl: postgresUrl(requiredString(source, 'DATABASE_URL'))
	});
}

/**
 * Keeps the public staff sign-in and recovery page available without reading database, provider,
 * session, payment, launch, or maintenance configuration. Protected auth endpoints still use the
 * complete authentication runtime.
 *
 * @param {unknown} [source]
 * @returns {Readonly<StaffSignInEnvironment>}
 */
export function readStaffSignInEnvironment(source = privateEnvironment) {
	if (!isEnvironmentRecord(source)) invalidConfiguration();
	return Object.freeze({
		appOrigin: applicationOrigin(requiredString(source, 'APP_ORIGIN'))
	});
}

/**
 * Reads only the provider credential required to expire a Session during a protected staff
 * cancellation. Ledger reads and unrelated staff actions do not depend on Stripe configuration.
 *
 * @param {unknown} [source]
 * @returns {Readonly<StaffOrderCancellationEnvironment>}
 */
export function readStaffOrderCancellationEnvironment(source = privateEnvironment) {
	if (!isEnvironmentRecord(source)) invalidConfiguration();
	const stripeSecretKey = requiredString(source, 'STRIPE_SECRET_KEY');
	const match = /^[sr]k_(test|live)_[A-Za-z0-9]+$/u.exec(stripeSecretKey);
	if (!match) invalidConfiguration();
	return Object.freeze({
		stripeSecretKey,
		stripeMode: /** @type {'test' | 'live'} */ (match[1])
	});
}

/**
 * Keeps scheduled recovery and retention independent of Google, Better Auth, catalogue, launch,
 * webhook, capability, and public-origin configuration.
 *
 * @param {unknown} [source]
 * @returns {Readonly<BookDeliveryJobEnvironment>}
 */
export function readBookDeliveryJobEnvironment(source = privateEnvironment) {
	if (!isEnvironmentRecord(source)) invalidConfiguration();
	const stripeSecretKey = requiredString(source, 'STRIPE_SECRET_KEY');
	const match = /^[sr]k_(test|live)_[A-Za-z0-9]+$/u.exec(stripeSecretKey);
	const cronSecret = requiredString(source, 'CRON_SECRET', MIN_SECRET_LENGTH);
	if (!match || cronSecret === stripeSecretKey) invalidConfiguration();
	return Object.freeze({
		databaseUrl: postgresUrl(requiredString(source, 'DATABASE_URL')),
		stripeSecretKey,
		stripeMode: /** @type {'test' | 'live'} */ (match[1]),
		cronSecret
	});
}

/**
 * Keeps staff catalogue requests independent of payment, Google, cron, and launch configuration.
 *
 * @param {unknown} [source]
 * @returns {Readonly<StaffCatalogueEnvironment>}
 */
export function readStaffCatalogueEnvironment(source = privateEnvironment) {
	if (!isEnvironmentRecord(source)) {
		return invalidConfiguration();
	}

	return Object.freeze({
		appOrigin: applicationOrigin(requiredString(source, 'APP_ORIGIN')),
		databaseUrl: postgresUrl(requiredString(source, 'DATABASE_URL')),
		rateLimitHmacKey: requiredString(source, 'RATE_LIMIT_HMAC_KEY', MIN_SECRET_LENGTH),
		approvedHostnames: approvedCatalogueHostnames(source.BOOK_DELIVERY_APPROVED_HOSTNAMES)
	});
}

/**
 * Public book-request boundary. Independent of Stripe, Google, launch, and cron configuration.
 *
 * @param {unknown} [source]
 * @returns {Readonly<BookRequestEnvironment>}
 */
export function readBookRequestEnvironment(source = privateEnvironment) {
	if (!isEnvironmentRecord(source)) {
		return invalidConfiguration();
	}

	return Object.freeze({
		appOrigin: applicationOrigin(requiredString(source, 'APP_ORIGIN')),
		databaseUrl: postgresUrl(requiredString(source, 'DATABASE_URL')),
		rateLimitHmacKey: requiredString(source, 'RATE_LIMIT_HMAC_KEY', MIN_SECRET_LENGTH)
	});
}

export const readBookWorkEnvironment = readBookRequestEnvironment;

/**
 * @param {unknown} source
 * @returns {string | null}
 */
function optionalDiscordWebhookUrl(source) {
	const raw = /** @type {Record<string, unknown>} */ (source).DISCORD_WEBHOOK_URL;
	if (raw === undefined || raw === null || raw === '') {
		return null;
	}
	if (typeof raw !== 'string' || raw !== raw.trim()) return invalidConfiguration();
	try {
		const parsed = new URL(raw);
		if (
			parsed.protocol !== 'https:' ||
			!['discord.com', 'discordapp.com'].includes(parsed.hostname) ||
			parsed.port ||
			parsed.username ||
			parsed.password ||
			parsed.search ||
			parsed.hash ||
			!DISCORD_WEBHOOK_PATH_PATTERN.test(parsed.pathname)
		) {
			return invalidConfiguration();
		}
		return raw;
	} catch {
		return invalidConfiguration();
	}
}

/** @param {unknown} source */
function optionalPostmarkServerToken(source) {
	const raw = /** @type {Record<string, unknown>} */ (source).POSTMARK_SERVER_TOKEN;
	if (raw === undefined || raw === null || raw === '') return null;
	if (typeof raw !== 'string' || raw !== raw.trim() || !POSTMARK_SERVER_TOKEN_PATTERN.test(raw)) {
		return invalidConfiguration();
	}
	return raw;
}

/**
 * Reads only the database and optional Discord incoming webhook used by club-event delivery.
 * A missing URL skips delivery. An invalid non-empty URL is a configuration error for this
 * reader only.
 *
 * @param {unknown} [source]
 * @returns {Readonly<ClubEventDeliveryEnvironment>}
 */
export function readClubEventDeliveryEnvironment(source = privateEnvironment) {
	if (!isEnvironmentRecord(source)) {
		return invalidConfiguration();
	}

	const postmarkServerToken = optionalPostmarkServerToken(source);
	return Object.freeze({
		appOrigin: applicationOrigin(requiredString(source, 'APP_ORIGIN')),
		databaseUrl: postgresUrl(requiredString(source, 'DATABASE_URL')),
		cronSecret: requiredString(source, 'CRON_SECRET', MIN_SECRET_LENGTH),
		discordWebhookUrl: optionalDiscordWebhookUrl(source),
		postmarkServerToken,
		bookCheckoutCapabilityKey: postmarkServerToken
			? requiredString(source, 'BOOK_CHECKOUT_CAPABILITY_KEY', MIN_SECRET_LENGTH)
			: null
	});
}

export const readNotificationRelayEnvironment = readClubEventDeliveryEnvironment;

/**
 * Reads runtime-only credentials. The migration credential has a separate parser so it is
 * not exposed to application code by this interface.
 *
 * @param {unknown} [source]
 * @returns {Readonly<RuntimeEnvironment>}
 */
export function readRuntimeEnvironment(source = privateEnvironment) {
	if (!isEnvironmentRecord(source)) {
		return invalidConfiguration();
	}

	const appOrigin = applicationOrigin(requiredString(source, 'APP_ORIGIN'));
	const betterAuthOrigin = applicationOrigin(requiredString(source, 'BETTER_AUTH_URL'));
	const betterAuthSecret = requiredString(source, 'BETTER_AUTH_SECRET', MIN_SECRET_LENGTH);
	const rateLimitHmacKey = requiredString(source, 'RATE_LIMIT_HMAC_KEY', MIN_SECRET_LENGTH);
	const bookCheckoutCapabilityKey = requiredString(
		source,
		'BOOK_CHECKOUT_CAPABILITY_KEY',
		MIN_SECRET_LENGTH
	);
	const cronSecret = requiredString(source, 'CRON_SECRET', MIN_SECRET_LENGTH);

	if (
		betterAuthOrigin !== appOrigin ||
		new Set([betterAuthSecret, rateLimitHmacKey, bookCheckoutCapabilityKey, cronSecret]).size !== 4
	) {
		return invalidConfiguration();
	}

	const stripeSecretKey = requiredString(source, 'STRIPE_SECRET_KEY');
	const stripeWebhookSecret = requiredString(source, 'STRIPE_WEBHOOK_SECRET');

	if (
		!/^[sr]k_(?:test|live)_[A-Za-z0-9]+$/u.test(stripeSecretKey) ||
		!/^whsec_[A-Za-z0-9]+$/u.test(stripeWebhookSecret) ||
		bookCheckoutCapabilityKey === stripeSecretKey ||
		bookCheckoutCapabilityKey === stripeWebhookSecret
	) {
		return invalidConfiguration();
	}

	const googleClientId = requiredString(source, 'GOOGLE_CLIENT_ID');
	if (!GOOGLE_OAUTH_WEB_CLIENT_ID_PATTERN.test(googleClientId)) {
		return invalidConfiguration();
	}

	return Object.freeze({
		appOrigin,
		databaseUrl: postgresUrl(requiredString(source, 'DATABASE_URL')),
		betterAuthSecret,
		betterAuthOrigin,
		googleClientId,
		googleClientSecret: requiredString(source, 'GOOGLE_CLIENT_SECRET'),
		stripeSecretKey,
		stripeWebhookSecret,
		stripeCheckoutHost: optionalStripeCheckoutHost(source.STRIPE_CHECKOUT_HOST),
		launchState: resolveBookDeliveryLaunchState(source.BOOK_DELIVERY_LAUNCH_STATE),
		rateLimitHmacKey,
		bookCheckoutCapabilityKey,
		cronSecret,
		isVercel: source.VERCEL === '1'
	});
}

/**
 * Reads only the elevated credential used by the controlled migration process.
 *
 * @param {unknown} [source]
 * @returns {Readonly<MigrationEnvironment>}
 */
export function readMigrationEnvironment(source = privateEnvironment) {
	if (!isEnvironmentRecord(source)) {
		return invalidConfiguration();
	}

	return Object.freeze({
		databaseUrl: postgresUrl(requiredString(source, 'MIGRATION_DATABASE_URL'))
	});
}
