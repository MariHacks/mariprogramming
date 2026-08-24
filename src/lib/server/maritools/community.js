const STAFF_EMAIL = 'team@marihacks.com';

/**
 * @param {string | null | undefined} email
 * @param {string | null | undefined} [role]
 * @returns {boolean}
 */
export function isStaffAccount(email, role = null) {
	if (role === 'staff' || role === 'moderator') return true;
	return String(email ?? '').toLowerCase() === STAFF_EMAIL;
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
