import { redirect } from '@sveltejs/kit';

export const STAFF_EMAIL = 'team@marihacks.com';

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Converts a Better Auth session plus its persisted provider account into the only privileged
 * local shape accepted by staff routes.
 *
 * @param {unknown} candidate
 * @param {Date} [now]
 */
export function isStaffSession(candidate, now = new Date()) {
	if (!isRecord(candidate)) return null;
	const { user, session, account } = candidate;
	if (!isRecord(user) || !isRecord(session) || !isRecord(account)) return null;

	const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
	const expiresAt =
		session.expiresAt instanceof Date ? session.expiresAt : new Date(String(session.expiresAt));

	if (
		typeof user.id !== 'string' ||
		user.id.length === 0 ||
		user.emailVerified !== true ||
		email !== STAFF_EMAIL ||
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
		email: STAFF_EMAIL,
		googleSubject: account.accountId,
		expiresAt
	});
}

/** @param {{ staff?: ReturnType<typeof isStaffSession> }} locals */
export function requireStaff(locals) {
	if (!locals?.staff) redirect(303, '/staff/sign-in?state=reauthenticate');
	return locals.staff;
}
