import { building } from '$app/environment';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { isMaritoolsSession, isStaffSession } from '$lib/server/auth/authorization.js';
import { withRequestAuth } from '$lib/server/auth/runtime.js';
import { ensureMariToolsBootstrap } from '$lib/server/maritools/bootstrap.js';
import { openClubStore } from '$lib/server/maritools/club-store.js';

const AUTH_UNAVAILABLE = 'Authentication service is unavailable';
const AUTH_PATH = '/api/auth';
const STAFF_PATH = '/staff';
const PUBLIC_STAFF_SIGN_IN_PATH = '/staff/sign-in';
const ACCOUNT_PATH = '/tools/account';
const SESSION_COOKIE_NAMES = ['__Secure-mari-staff.session_token', 'mari-staff.session_token'];
const PRIVATE_PAGE_PATHS = [
	'/books/cart',
	'/books/checkout',
	'/books/order-confirmation',
	'/tools/account',
	'/tools/semester'
];
const PRIVATE_HEADERS = Object.freeze({
	'cache-control': 'private, no-store',
	'pragma': 'no-cache',
	'referrer-policy': 'same-origin',
	'x-robots-tag': 'noindex, nofollow'
});

/** @param {Request} request */
function hasStaffSessionCookie(request) {
	const cookie = request.headers.get('cookie') ?? '';
	return cookie
		.split(';')
		.map((part) => {
			const separator = part.indexOf('=');
			return separator < 1 ? '' : part.slice(0, separator).trim();
		})
		.some((name) => SESSION_COOKIE_NAMES.includes(name));
}

/** @param {string} pathname @param {string} prefix */
function isPath(pathname, prefix) {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** @param {string} pathname */
function isPrivatePath(pathname) {
	return (
		isPath(pathname, AUTH_PATH) ||
		isPath(pathname, STAFF_PATH) ||
		isPath(pathname, '/api') ||
		PRIVATE_PAGE_PATHS.some((path) => isPath(pathname, path))
	);
}

/** @param {string} pathname */
function requiresCompletedOnboarding(pathname) {
	return isPath(pathname, '/tools') && pathname !== ACCOUNT_PATH;
}

/** @param {Response} response @param {string} pathname */
function applyRoutePolicy(response, pathname) {
	if (!isPrivatePath(pathname)) return response;
	const secured = new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers
	});
	for (const [name, value] of Object.entries(PRIVATE_HEADERS)) {
		secured.headers.set(name, value);
	}
	return secured;
}

/**
 * @param {{
 *   withAuth?: typeof withRequestAuth,
 *   officialHandler?: typeof svelteKitHandler,
 *   createClubRepository?: typeof openClubStore,
 *   isBuilding?: boolean
 * }} [dependencies]
 */
export function createHandle({
	withAuth = withRequestAuth,
	officialHandler = svelteKitHandler,
	createClubRepository = openClubStore,
	isBuilding = building
} = {}) {
	/** @type {import('@sveltejs/kit').Handle} */
	return async function handle({ event, resolve }) {
		event.locals.staff = null;
		event.locals.maritools = null;
		if (!isBuilding && isPath(event.url.pathname, '/tools')) {
			await ensureMariToolsBootstrap();
		}
		/** @param {Response} response */
		const finalize = (response) => applyRoutePolicy(response, event.url.pathname);
		const authPath = isPath(event.url.pathname, AUTH_PATH);
		const staffPath = isPath(event.url.pathname, STAFF_PATH);
		const publicStaffSignIn = event.url.pathname === PUBLIC_STAFF_SIGN_IN_PATH;
		const sessionCookie = hasStaffSessionCookie(event.request);
		const skipAuth =
			isBuilding ||
			(publicStaffSignIn && !sessionCookie) ||
			(!authPath && !staffPath && !sessionCookie);

		if (skipAuth) {
			return finalize(await resolve(event));
		}

		try {
			/** @param {{ auth: any, findGoogleAccount: (userId: string) => Promise<unknown> }} runtime */
			const authenticate = async ({ auth, findGoogleAccount }) => {
				const current = await auth.api.getSession({ headers: event.request.headers });
				if (current?.user?.id) {
					const account = await findGoogleAccount(current.user.id);
					const identity = { ...current, account };
					event.locals.maritools = isMaritoolsSession(identity);
					event.locals.staff = isStaffSession(identity);
				}

				if (authPath) {
					return officialHandler({
						auth,
						event,
						resolve,
						building: isBuilding
					});
				}
			};

			const authResponse = await withAuth(authenticate);
			if (authPath) return finalize(/** @type {Response} */ (authResponse));
		} catch {
			// Sign-in must stay reachable when a stale cookie meets an auth outage.
			if (!authPath && (!staffPath || publicStaffSignIn)) {
				return finalize(await resolve(event));
			}
			return finalize(
				new Response(AUTH_UNAVAILABLE, {
					status: 503,
					headers: { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' }
				})
			);
		}

		if (event.locals.maritools && requiresCompletedOnboarding(event.url.pathname)) {
			try {
				const membership = await createClubRepository().getMyClubOnboarding(
					event.locals.maritools.userId
				);
				if (!membership?.requiredFormCompletedAt) {
					return finalize(new Response(null, { status: 303, headers: { location: ACCOUNT_PATH } }));
				}
			} catch {
				return finalize(
					new Response(null, { status: 303, headers: { location: ACCOUNT_PATH } })
				);
			}
		}

		return finalize(await resolve(event));
	};
}

export const handle = createHandle();
