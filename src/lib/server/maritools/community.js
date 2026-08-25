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

export const NIM_DISCLOSURE =
	'When you upload a course outline, we send the extracted text to NVIDIA for analysis. NVIDIA trial terms may use that text to improve models. We do not publish the PDF. Sharing structured fields with the catalog is a separate step.';

/**
 * @param {{ email: string } | null | undefined} session
 * @param {{ displayName?: string | null, nimDisclosureAcceptedAt?: Date | string | null } | null | undefined} profile
 */
export function accountPageView(session, profile) {
	if (!session) return { kind: 'guest' };
	if (!profile) return { kind: 'incomplete', email: session.email };
	return {
		kind: 'complete',
		email: session.email,
		displayName: profile.displayName ?? null,
		nimAccepted: Boolean(profile.nimDisclosureAcceptedAt)
	};
}

/**
 * @param {{ email: string } | null | undefined} session
 * @param {{ nimDisclosureAcceptedAt?: Date | string | null } | null | undefined} profile
 */
export function semesterPageView(session, profile) {
	if (!session) return { kind: 'need-sign-in' };
	if (!profile) return { kind: 'need-profile' };
	if (!profile.nimDisclosureAcceptedAt) return { kind: 'need-disclosure' };
	return { kind: 'ready' };
}
