import { redirect } from '@sveltejs/kit';

export const STAFF_EMAIL = 'team@marihacks.com';

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Converts a Better Auth session plus its persisted Google account into the student session
 * shape used by MariTools routes. Staff routes still go through isStaffSession.
 *
 * @param {unknown} candidate
 * @param {Date} [now]
 */
export function isMaritoolsSession(candidate, now = new Date()) {
	if (!isRecord(candidate)) return null;
	const { user, session, account } = candidate;
	if (!isRecord(user) || !isRecord(session) || !isRecord(account)) return null;

	const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
	const displayName =
		typeof user.name === 'string' && user.name.trim().length > 0
			? user.name.trim().slice(0, 120)
			: null;
	const expiresAt =
		session.expiresAt instanceof Date ? session.expiresAt : new Date(String(session.expiresAt));

	if (
		typeof user.id !== 'string' ||
		user.id.length === 0 ||
		user.emailVerified !== true ||
		!email ||
		email.length > 255 ||
		!email.includes('@') ||
		typeof session.id !== 'string' ||
		session.id.length === 0 ||
		session.userId !== user.id ||
		Number.isNaN(expiresAt.getTime()) ||
		expiresAt <= now ||
		account.providerId !== 'google' ||
		account.userId !== user.id ||
		typeof account.accountId !== 'string' ||
		account.accountId.length === 0 ||
		account.accountId.length > 255 ||
		account.accountId !== account.accountId.trim()
	) {
		return null;
	}

	return Object.freeze({
		userId: user.id,
		sessionId: session.id,
		email,
		googleSubject: account.accountId,
		expiresAt,
		...(displayName ? { displayName } : {})
	});
}

/**
 * Converts a Better Auth session plus its persisted provider account into the only privileged
 * local shape accepted by staff routes.
 *
 * @param {unknown} candidate
 * @param {Date} [now]
 */
export function isStaffSession(candidate, now = new Date()) {
	const session = isMaritoolsSession(candidate, now);
	if (!session || session.email !== STAFF_EMAIL) return null;
	return Object.freeze({ ...session, email: STAFF_EMAIL });
}

/** @param {{ staff?: ReturnType<typeof isStaffSession> }} locals */
export function requireStaff(locals) {
	if (!locals?.staff) redirect(303, '/staff/sign-in?state=reauthenticate');
	return locals.staff;
}
