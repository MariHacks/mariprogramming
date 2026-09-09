export const MEMBER_COOKIE = 'pbl_member';
const MEMBER_PATTERN = /(?:^|;\s*)pbl_member=([0-9a-f]{32})/u;

/** @param {unknown} cookieHeader */
export function readMemberId(cookieHeader) {
	if (typeof cookieHeader !== 'string' || cookieHeader.length === 0) return null;
	const match = MEMBER_PATTERN.exec(cookieHeader);
	return match?.[1] ?? null;
}

/**
 * @param {string} memberId
 * @param {{ secure?: boolean }} [options]
 */
export function memberCookie(memberId, options = {}) {
	const parts = [
		`${MEMBER_COOKIE}=${memberId}`,
		'Path=/',
		'HttpOnly',
		'SameSite=Lax',
		'Max-Age=604800'
	];
	if (options.secure) parts.push('Secure');
	return parts.join('; ');
}
