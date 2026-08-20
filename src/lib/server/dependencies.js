/**
 * @template Database
 * @template StripeClient
 * @template AuthenticatedLocals
 * @typedef {{
 *   createDatabase: (event: unknown) => Database | Promise<Database>,
 *   createStripe: () => StripeClient,
 *   getAuthenticatedLocals: (locals: unknown) => AuthenticatedLocals | null
 * }} ServerDependencies
 */

/**
 * Defines the three external boundaries used by server services without adding a route,
 * environment switch, or production default that could bypass authorization.
 *
 * @template Database
 * @template StripeClient
 * @template AuthenticatedLocals
 * @param {unknown} dependencies
 * @returns {Readonly<ServerDependencies<Database, StripeClient, AuthenticatedLocals>>}
 */
export function defineServerDependencies(dependencies) {
	if (
		dependencies === null ||
		typeof dependencies !== 'object' ||
		Array.isArray(dependencies) ||
		!('createDatabase' in dependencies) ||
		!('createStripe' in dependencies) ||
		!('getAuthenticatedLocals' in dependencies) ||
		typeof dependencies.createDatabase !== 'function' ||
		typeof dependencies.createStripe !== 'function' ||
		typeof dependencies.getAuthenticatedLocals !== 'function'
	) {
		throw new TypeError('Server dependency configuration is invalid');
	}

	return Object.freeze(
		/** @type {ServerDependencies<Database, StripeClient, AuthenticatedLocals>} */ ({
			createDatabase: dependencies.createDatabase,
			createStripe: dependencies.createStripe,
			getAuthenticatedLocals: dependencies.getAuthenticatedLocals
		})
	);
}
