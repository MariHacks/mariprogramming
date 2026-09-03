const STAFF_EMAIL = 'team@marihacks.com';

/** @param {string | null | undefined} email */
export function isMariHacksTeamAccount(email) {
	return String(email ?? '').trim().toLowerCase() === STAFF_EMAIL;
}

/**
 * @param {string | null | undefined} email
 * @param {string | null | undefined} [role]
 * @returns {boolean}
 */
export function isStaffAccount(email, role = null) {
	if (role === 'staff' || role === 'moderator') return true;
	return isMariHacksTeamAccount(email);
}

/**
 * @typedef {object} CommunityProfile
 * @property {string} userId
 * @property {string} email
 * @property {string | null} studentId
 * @property {string} role
 */

/**
 * @param {CommunityProfile} profile
 * @returns {{ userId: string, email: string, role: string }}
 */
export function publicCommunityView(profile) {
	return {
		userId: profile.userId,
		email: profile.email,
		role: profile.role
	};
}

/**
 * @param {string} studentId
 * @returns {boolean}
 */
export function isCompleteStudentId(studentId) {
	return /^\d{5,8}$/.test(String(studentId ?? '').trim());
}

/**
 * @param {{ email: string, displayName?: string | null, profileImageUrl?: string } | null | undefined} session
 * @param {{ displayName?: string | null, username?: string | null, firstName?: string | null, lastName?: string | null, profileImageDataUrl?: string | null } | null | undefined} profile
 */
export function accountPageView(session, profile) {
	if (!session) return { kind: 'guest' };
	if (!profile) {
		return {
			kind: 'incomplete',
			email: session.email,
			...(session.displayName ? { displayName: session.displayName } : {}),
			...(session.profileImageUrl ? { profileImageDataUrl: session.profileImageUrl } : {})
		};
	}
	return {
		kind: 'complete',
		email: session.email,
		displayName: profile.displayName ?? session.displayName ?? null,
		username: profile.username ?? null,
		firstName: profile.firstName ?? null,
		lastName: profile.lastName ?? null,
		profileImageDataUrl: profile.profileImageDataUrl || session.profileImageUrl || null
	};
}

/**
 * @param {{ email: string } | null | undefined} session
 * @param {{ nimDisclosureAcceptedAt?: Date | string | null } | null | undefined} profile
 */
export function semesterPageView(session, profile) {
	if (!session) return { kind: 'need-sign-in' };
	if (!profile) return { kind: 'need-profile' };
	if (!profile.nimDisclosureAcceptedAt) return { kind: 'need-analysis-confirmation' };
	return { kind: 'ready' };
}
